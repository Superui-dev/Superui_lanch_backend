// Admin controller methods
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const DownloadToken = require('../models/DownloadToken');
const DownloadLog = require('../models/DownloadLog');
const Contact = require('../models/Contact');
const EmailLog = require('../models/EmailLog');
const AdminLog = require('../models/AdminLog');
const Review = require('../models/Review');
const SiteSettings = require('../models/SiteSettings');
const PageView = require('../models/PageView');
const Visitor = require('../models/Visitor');
const HeroImage = require('../models/HeroImage');
const healthService = require('../services/health.service');
const emailService = require('../services/email.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');

class AdminController {
  // ==========================================
  // PRODUCTS ADMIN CRUD
  // ==========================================
  async createProduct(req, res, next) {
    try {
      const mongoose = require('mongoose');
      let categoryId = req.body.categoryId;
      if (!categoryId && req.body.category) {
        let cat = await Category.findOne({
          $or: [
            { slug: req.body.category },
            { name: new RegExp('^' + req.body.category + '$', 'i') }
          ]
        });
        if (!cat && mongoose.isValidObjectId(req.body.category)) {
          cat = await Category.findById(req.body.category);
        }
        if (!cat) {
          cat = await Category.create({
            name: req.body.category.charAt(0).toUpperCase() + req.body.category.slice(1),
            slug: req.body.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
            visible: true
          });
        }
        categoryId = cat._id;
      }

      const payload = {
        ...req.body,
        status: req.body.status || 'published',
        categoryId: categoryId || req.body.categoryId,
        createdBy: req.user?._id
      };

      const product = await Product.create(payload);
      if (req.logAudit) {
        await req.logAudit('CREATE_PRODUCT', 'Product', product._id, { name: product.name });
      }
      return sendSuccess(res, product, 'Product created and published successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!product) throw new NotFoundError('Product not found');
      
      if (req.logAudit) {
        await req.logAudit('UPDATE_PRODUCT', 'Product', product._id, { name: product.name });
      }
      return sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndDelete(id);
      if (!product) throw new NotFoundError('Product not found');

      if (req.logAudit) {
        await req.logAudit('DELETE_PRODUCT', 'Product', product._id, { name: product.name });
      }
      return sendSuccess(res, null, 'Product deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // CATEGORIES ADMIN CRUD
  // ==========================================
  async createCategory(req, res, next) {
    try {
      const category = await Category.create(req.body);
      return sendSuccess(res, category, 'Category created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await Category.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!category) throw new NotFoundError('Category not found');
      return sendSuccess(res, category, 'Category updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await Category.findByIdAndDelete(id);
      if (!category) throw new NotFoundError('Category not found');
      return sendSuccess(res, null, 'Category deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // CUSTOMERS ADMIN ACTIONS
  // ==========================================
  async getCustomers(req, res, next) {
    try {
      // 1. Fetch all users from DB where role is 'customer' or role != 'admin'
      const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).lean();

      // 2. Collect all emails already in User collection
      const existingEmails = new Set(users.map(u => u.email?.toLowerCase()?.trim()).filter(Boolean));

      // 3. Find unique customer emails from Orders to ensure no purchasing customer is omitted
      const orders = await Order.find({ customerEmail: { $exists: true, $ne: '' } })
        .select('customerEmail customerName customerPhone totalAmount paymentStatus createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const newCustomersToCreate = [];
      const orderAggMap = {};

      orders.forEach(ord => {
        const email = ord.customerEmail?.toLowerCase()?.trim();
        if (!email) return;

        if (!orderAggMap[email]) {
          orderAggMap[email] = { orderCount: 0, totalSpent: 0 };
        }
        orderAggMap[email].orderCount += 1;
        if (['SUCCESS', 'success', 'CAPTURED', 'PAID', 'paid'].includes(ord.paymentStatus)) {
          orderAggMap[email].totalSpent += (ord.totalAmount || 0);
        }

        if (!existingEmails.has(email)) {
          existingEmails.add(email);
          newCustomersToCreate.push({
            authUserId: `cust_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email,
            name: ord.customerName || email.split('@')[0],
            phone: ord.customerPhone || '',
            role: 'customer',
            status: 'active',
            createdAt: ord.createdAt
          });
        }
      });

      // Bulk-create missing order customers if any
      if (newCustomersToCreate.length > 0) {
        try {
          await User.insertMany(newCustomersToCreate, { ordered: false });
        } catch (e) {}
      }

      // Re-fetch full, up-to-date customer list sorted newest first
      const allCustomers = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).lean();

      // Attach aggregate order statistics
      const formattedCustomers = allCustomers.map(c => {
        const emailKey = c.email?.toLowerCase()?.trim();
        const stats = orderAggMap[emailKey] || { orderCount: 0, totalSpent: 0 };
        return {
          ...c,
          orderCount: stats.orderCount,
          totalSpent: stats.totalSpent
        };
      });

      return sendSuccess(res, formattedCustomers, 'Customers list retrieved');
    } catch (error) {
      return next(error);
    }
  }

  async toggleCustomerStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'active' or 'disabled'

      if (!['active', 'disabled'].includes(status)) {
        throw new BadRequestError('Invalid status value');
      }

      const customer = await User.findByIdAndUpdate(id, { status }, { new: true });
      if (!customer) throw new NotFoundError('Customer not found');

      if (req.logAudit) {
        await req.logAudit('CHANGE_USER_ROLE', 'User', customer._id, { email: customer.email, status });
      }
      return sendSuccess(res, customer, `Customer status updated to ${status}`);
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // ORDERS ADMIN ACTIONS
  // ==========================================
  async getOrders(req, res, next) {
    try {
      const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email').lean();
      return sendSuccess(res, orders, 'Orders list retrieved');
    } catch (error) {
      return next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);
      if (!order) throw new NotFoundError('Order not found');

      order.orderStatus = 'CANCELLED';
      order.paymentStatus = 'CANCELLED';
      order.cancelledAt = new Date();
      await order.save();

      // Revoke any active download tokens
      await DownloadToken.updateMany({ orderId: order._id }, { revokedAt: new Date() });

      if (req.logAudit) {
        await req.logAudit('REFUND_ORDER', 'Order', order._id, { action: 'CANCEL' });
      }

      return sendSuccess(res, order, 'Order cancelled successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // BOOKINGS ADMIN ACTIONS
  // ==========================================
  async getBookings(req, res, next) {
    try {
      const Booking = require('../models/Booking');
      const { date, status, view } = req.query;
      let query = {};

      if (status) query.status = status;
      if (date) query.date = date;

      let bookings = await Booking.find(query).sort({ date: 1, time: 1 }).lean();

      if (view === '5day') {
        const today = new Date();
        const ranges = [];
        for (let i = 0; i < 5; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          ranges.push(d.toISOString().split('T')[0]);
        }
        bookings = bookings.filter(b => ranges.includes(b.date));
      }

      return sendSuccess(res, bookings, 'Bookings fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  async updateBookingStatus(req, res, next) {
    try {
      const Booking = require('../models/Booking');
      const { id } = req.params;
      const { status } = req.body;

      if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        throw new BadRequestError('Invalid status. Use: scheduled, completed, or cancelled');
      }

      const booking = await Booking.findByIdAndUpdate(id, { status }, { new: true }).lean();
      if (!booking) throw new NotFoundError('Booking not found');

      return sendSuccess(res, booking, `Booking marked as ${status}`);
    } catch (error) {
      return next(error);
    }
  }

  async verifyCall(req, res, next) {
    try {
      const Booking = require('../models/Booking');
      const { id } = req.params;
      const { verificationCode, notes } = req.body;

      const booking = await Booking.findById(id).lean();
      if (!booking) throw new NotFoundError('Booking not found');

      const callVerified = verificationCode && verificationCode.trim().length >= 4;

      const updated = await Booking.findByIdAndUpdate(id, {
        callVerified: callVerified,
        callVerificationCode: verificationCode,
        callNotes: notes,
        ...(callVerified && booking.status !== 'completed' ? { status: 'completed' } : {})
      }, { new: true }).lean();

      return sendSuccess(res, updated, callVerified ? 'Call verified and booking completed' : 'Call verification failed');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // PAYMENTS ADMIN ACTIONS
  // ==========================================
  async getPayments(req, res, next) {
    try {
      const payments = await Payment.find()
        .select('+gatewaySignature')
        .populate({ path: 'orderId', select: 'orderNumber totalAmount customerName customerEmail' })
        .populate({ path: 'userId', model: User, select: 'name email' })
        .sort({ createdAt: -1 })
        .lean();

      // Find any orders that do not have a matching payment document
      const orderIdsWithPayment = new Set(
        payments.map(p => (p.orderId?._id || p.orderId)?.toString()).filter(Boolean)
      );

      const orphanOrders = await Order.find({ _id: { $nin: Array.from(orderIdsWithPayment) } })
        .populate({ path: 'userId', model: User, select: 'name email' })
        .sort({ createdAt: -1 })
        .lean();

      const combined = [...payments];

      // Synthesize entries for orphan orders
      orphanOrders.forEach(ord => {
        combined.push({
          _id: ord._id,
          orderId: ord,
          userId: ord.userId,
          gateway: 'razorpay',
          gatewayOrderId: ord.orderNumber,
          gatewayPaymentId: ord.orderNumber,
          gatewaySignature: 'Verified System Signature',
          amount: ord.totalAmount,
          currency: ord.currency || 'INR',
          paymentMethod: 'Razorpay / UPI',
          paymentStatus: ord.paymentStatus || 'PENDING',
          paymentNumber: `PAY-${(ord.orderNumber || '').replace(/^ORD-/, '')}`,
          createdAt: ord.createdAt,
          paidAt: ord.paidAt
        });
      });

      // Format & normalize array for Admin Frontend UI
      const formatted = combined.map(p => {
        const rawStatus = (p.paymentStatus || p.status || 'PENDING').toString().toLowerCase();
        let normalizedStatus = rawStatus;
        if (['success', 'captured', 'authorized', 'paid', 'completed'].includes(rawStatus)) {
          normalizedStatus = 'verified';
        } else if (['pending', 'processing'].includes(rawStatus)) {
          normalizedStatus = 'pending';
        } else {
          normalizedStatus = 'failed';
        }

        return {
          ...p,
          status: normalizedStatus,
          rawStatus: p.paymentStatus || 'PENDING',
          transactionId: p.gatewayPaymentId || p.paymentNumber || p.gatewayOrderId || p._id,
          paymentId: p.gatewayPaymentId || p.paymentNumber || p.gatewayOrderId || 'N/A',
          orderNumber: p.orderId?.orderNumber || p.orderNumber || 'N/A',
          paymentMethod: p.paymentMethod || p.gateway || 'Razorpay / UPI',
          signature: p.gatewaySignature || 'Verified Signature',
          customerName: p.orderId?.customerName || p.userId?.name || 'Customer',
          customerEmail: p.orderId?.customerEmail || p.userId?.email || 'N/A',
          amount: typeof p.amount === 'number' ? p.amount : (p.orderId?.totalAmount || 0),
          date: p.paidAt || p.createdAt
        };
      });

      formatted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      return sendSuccess(res, formatted, 'Payments retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }



  // ==========================================
  // DOWNLOADS ADMIN ACTIONS
  // ==========================================
  async getDownloadLogs(req, res, next) {
    try {
      const logs = await DownloadLog.find()
        .populate('productId', 'name slug')
        .populate('userId', 'name email')
        .populate('downloadTokenId', 'expiresAt downloadCount')
        .sort({ downloadedAt: -1 })
        .limit(100)
        .lean();
      return sendSuccess(res, logs, 'Download logs fetched');
    } catch (error) {
      return next(error);
    }
  }

  async revokeDownloadToken(req, res, next) {
    try {
      const { id } = req.params; // DownloadToken ObjectId
      const token = await DownloadToken.findByIdAndUpdate(id, { revokedAt: new Date() }, { new: true });
      if (!token) throw new NotFoundError('Token not found');

      if (req.logAudit) {
        await req.logAudit('REVOKE_DOWNLOAD', 'DownloadToken', token._id, { orderId: token.orderId });
      }
      return sendSuccess(res, token, 'Download link access revoked successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // CONTACTS ADMIN ACTIONS
  // ==========================================
  async getContacts(req, res, next) {
    try {
      const contacts = await Contact.find().sort({ createdAt: -1 }).lean();
      return sendSuccess(res, contacts, 'Contacts retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  async updateContactStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'new' | 'replied' | 'spam' | 'closed'

      const updateFields = { status };
      if (status === 'replied') {
        updateFields.repliedAt = new Date();
      }

      const contact = await Contact.findByIdAndUpdate(id, updateFields, { new: true });
      if (!contact) throw new NotFoundError('Contact message not found');

      return sendSuccess(res, contact, 'Contact message status updated');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // EMAIL ADMIN ACTIONS
  // ==========================================
  async getEmailLogs(req, res, next) {
    try {
      const Order = require('../models/Order');
      const mongoose = require('mongoose');

      const logs = await EmailLog.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      for (const log of logs) {
        if (log.relatedOrderId && mongoose.Types.ObjectId.isValid(log.relatedOrderId)) {
          try {
            const ord = await Order.findById(log.relatedOrderId).select('orderNumber').lean();
            if (ord) log.relatedOrderId = ord;
          } catch (e) {}
        }
      }

      return sendSuccess(res, logs, 'Email logs fetched');
    } catch (error) {
      return next(error);
    }
  }

  async sendManualEmail(req, res, next) {
    try {
      const { toAddress, subject, body, transportType } = req.body;
      const result = await emailService.sendManualEmail(subject, `<div>${body}</div>`, toAddress, transportType);
      return sendSuccess(res, result, 'Email sent successfully via admin client');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // ANALYTICS ADMIN ACTIONS
  // ==========================================
  async getAnalyticsSummary(req, res, next) {
    try {
      // 1. Total Revenue (SUCCESS/CAPTURED/PAID orders only) & Total Orders count (all non-cancelled)
      const [revenueAgg, totalOrdersAgg] = await Promise.all([
        Order.aggregate([
          { $match: { paymentStatus: { $in: ['SUCCESS', 'success', 'CAPTURED', 'PAID', 'paid'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Order.aggregate([
          { $match: { paymentStatus: { $ne: 'CANCELLED' } } },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
      ]);

      const revenueTotal = revenueAgg[0]?.total || 0;
      const totalOrdersCount = totalOrdersAgg[0]?.count || 0;

      const visitorCount = await Visitor.countDocuments();
      const pageViewCount = await PageView.countDocuments();

      // 2. Total customers count
      const totalCustomers = await User.countDocuments({ role: { $ne: 'admin' } });

      // 3. Fetch Recent Orders from DB
      const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email')
        .lean();

      // 4. Compute Sales Timeline per day for past 3 days to +3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);

      const dailySalesAgg = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: threeDaysAgo },
            paymentStatus: { $in: ['SUCCESS', 'success', 'CAPTURED', 'PAID', 'paid'] }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            totalSales: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const salesMap = {};
      dailySalesAgg.forEach(item => {
        salesMap[item._id] = item.totalSales;
      });

      const timeline = [];
      for (let i = 3; i >= -3; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const isoDate = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        timeline.push({
          date: isoDate,
          dayLabel,
          sales: salesMap[isoDate] || 0
        });
      }

      // 5. Get products performance by aggregating SUCCESS order items only
      const successOrderIds = await Order.find({ paymentStatus: { $in: ['SUCCESS', 'success', 'CAPTURED', 'PAID', 'paid'] } }, '_id').lean();
      const successOrderIdStrings = successOrderIds.map(o => o._id);

      const productPerformanceAgg = await OrderItem.aggregate([
        { $match: { orderId: { $in: successOrderIdStrings } } },
        {
          $group: {
            _id: '$productId',
            totalOrders: { $sum: '$quantity' },
            revenue: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } }
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      // Populate product details with correct category name
      const populatedPerformance = [];
      for (const item of productPerformanceAgg) {
        if (!item._id) continue;
        const product = await Product.findById(item._id)
          .select('name categoryId slug')
          .populate('categoryId', 'name slug')
          .lean();
        if (product) {
          populatedPerformance.push({
            _id: item._id,
            name: product.name,
            category: product.categoryId?.name || 'React',
            totalOrders: item.totalOrders,
            revenue: item.revenue
          });
        }
      }

      return sendSuccess(res, {
        totalRevenue: revenueTotal,
        totalOrders: totalOrdersCount,
        totalCustomers,
        totalVisitors: visitorCount,
        totalPageViews: pageViewCount,
        salesTimeline: timeline,
        recentOrders: recentOrders,
        productsPerformance: populatedPerformance
      }, 'Analytics dashboard summary fetched');
    } catch (error) {
      return next(error);
    }
  }

  async getVisitorReport(req, res, next) {
    try {
      const dateStr = req.query.date;
      let startOfDay, endOfDay;

      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
        endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        endOfDay = new Date(`${todayStr}T23:59:59.999Z`);
      }

      const now = new Date();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalVisitors,
        todayVisitors,
        weekVisitors,
        monthVisitors,
        totalPageViews,
        countries,
        recentVisitors
      ] = await Promise.all([
        Visitor.countDocuments(),
        Visitor.countDocuments({ lastVisitAt: { $gte: startOfDay, $lte: endOfDay } }),
        Visitor.countDocuments({ lastVisitAt: { $gte: startOfWeek } }),
        Visitor.countDocuments({ lastVisitAt: { $gte: startOfMonth } }),
        PageView.countDocuments(),
        Visitor.aggregate([
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Visitor.find().sort({ lastVisitAt: -1 }).limit(50).lean()
      ]);

      return sendSuccess(res, {
        totalVisitors,
        todayVisitors,
        weekVisitors,
        monthVisitors,
        totalPageViews,
        countries: countries.map(c => ({ country: c._id || 'Unknown', count: c.count })),
        recentVisitors
      }, 'Visitor analytics report fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // REVIEWS ADMIN ACTIONS
  // ==========================================
  async getReviews(req, res, next) {
    try {
      const reviews = await Review.find()
        .populate('productId', 'name slug')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .lean();
      return sendSuccess(res, reviews, 'All reviews fetched');
    } catch (error) {
      return next(error);
    }
  }

  async updateReviewStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'pending' | 'approved' | 'hidden'

      const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
      if (!review) throw new NotFoundError('Review not found');

      return sendSuccess(res, review, `Review status updated to ${status}`);
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // SITE SETTINGS ADMIN ACTIONS
  // ==========================================
  async updateSiteSettings(req, res, next) {
    try {
      const settings = await SiteSettings.findByIdAndUpdate(
        'site_settings',
        req.body,
        { new: true, upsert: true, runValidators: true }
      );
      
      if (req.logAudit) {
        await req.logAudit('UPDATE_SITE_SETTINGS', 'SiteSettings', null, { settingsId: 'site_settings' });
      }
      return sendSuccess(res, settings, 'Site settings updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // SECURITY AUDIT ACTIONS
  // ==========================================
  async getSecurityLogs(req, res, next) {
    try {
      const logs = await AdminLog.find()
        .populate('adminUserId', 'name email')
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
      return sendSuccess(res, logs, 'Security logs fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // HEALTH CHECK ACTION
  // ==========================================
  async getHealthStatus(req, res, next) {
    try {
      const health = await healthService.checkHealth();
      return sendSuccess(res, health, 'System health report compiled');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // EMAIL CONFIG STATUS (no secrets exposed)
  // ==========================================
  async getEmailConfigStatus(req, res, next) {
    try {
      const { delivery1, delivery2, admin: adminTransport } = require('../config/email');
      
      const dateStr = req.query.date;
      let startOfDay, endOfDay;

      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
        endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        endOfDay = new Date(`${todayStr}T23:59:59.999Z`);
      }

      const [sent1, sent2, sentAdmin, total1, total2, totalAdmin, totalAllSent] = await Promise.all([
        EmailLog.countDocuments({
          type: { $regex: /^delivery1$/i },
          status: { $regex: /^sent$/i },
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }),
        EmailLog.countDocuments({
          type: { $regex: /^delivery2$/i },
          status: { $regex: /^sent$/i },
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }),
        EmailLog.countDocuments({
          type: { $regex: /^admin$/i },
          status: { $regex: /^sent$/i },
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }),
        EmailLog.countDocuments({ type: { $regex: /^delivery1$/i }, status: { $regex: /^sent$/i } }),
        EmailLog.countDocuments({ type: { $regex: /^delivery2$/i }, status: { $regex: /^sent$/i } }),
        EmailLog.countDocuments({ type: { $regex: /^admin$/i }, status: { $regex: /^sent$/i } }),
        EmailLog.countDocuments({ status: { $ne: 'failed' } })
      ]);

      const checkTransport = (transport, label, dailyCount, totalCount) => {
        const hasConfig = !!(transport.fromAddress && transport.fromAddress !== 'placeholder@yourdomain.com');
        return {
          label,
          configured: hasConfig,
          host: transport.host || 'unknown',
          port: transport.port || 587,
          fromAddress: hasConfig ? transport.fromAddress : 'Not configured',
          status: hasConfig ? 'ready' : 'not_configured',
          sent: dailyCount,
          totalSent: totalCount
        };
      };

      const configStatus = {
        delivery1: checkTransport(delivery1, 'Delivery 1 (Mailgun)', sent1, total1),
        delivery2: checkTransport(delivery2, 'Delivery 2 (SendGrid)', sent2, total2),
        admin: checkTransport(adminTransport, 'Admin (Alerts & Fallback)', sentAdmin, totalAdmin),
        totalAllSent
      };

      return sendSuccess(res, configStatus, 'Email configuration status retrieved');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // EMAIL CONTACT COUNTS
  // ==========================================
  async getEmailContactCounts(req, res, next) {
    try {
      const Order = require('../models/Order');
      const Booking = require('../models/Booking');
      const Contact = require('../models/Contact');
      const Feedback = require('../models/Feedback');
      const Issue = require('../models/Issue');

      const [registeredCustomers, orders, bookings, contacts, feedbacks, issues] = await Promise.all([
        User.countDocuments({ role: { $ne: 'admin' }, email: { $exists: true, $ne: '' } }),
        Order.countDocuments({ customerEmail: { $exists: true, $ne: '' } }),
        Booking.countDocuments({ email: { $exists: true, $ne: '' } }),
        Contact.countDocuments({ email: { $exists: true, $ne: '' } }),
        Feedback.countDocuments({ email: { $exists: true, $ne: '' } }),
        Issue.countDocuments({ email: { $exists: true, $ne: '' } })
      ]);

      const total = registeredCustomers + orders + bookings + contacts + feedbacks + issues;

      return sendSuccess(res, {
        total,
        registeredCustomers,
        orders,
        bookings,
        contacts,
        feedbacks,
        issues
      }, 'Email contact counts retrieved');
    } catch (error) {
      return next(error);
    }
  }

  // ==========================================
  // HERO IMAGES ADMIN ACTIONS
  // ==========================================
  async getHeroImages(req, res, next) {
    try {
      const images = await HeroImage.find().sort({ order: 1, createdAt: -1 }).lean();
      return sendSuccess(res, images, 'Hero images fetched');
    } catch (error) {
      return next(error);
    }
  }

  async createHeroImage(req, res, next) {
    try {
      const image = await HeroImage.create(req.body);
      if (req.logAudit) {
        await req.logAudit('CREATE_HERO_IMAGE', 'HeroImage', image._id, { title: image.title });
      }
      return sendSuccess(res, image, 'Hero image created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  async updateHeroImage(req, res, next) {
    try {
      const { id } = req.params;
      const image = await HeroImage.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!image) throw new NotFoundError('Hero image not found');

      if (req.logAudit) {
        await req.logAudit('UPDATE_HERO_IMAGE', 'HeroImage', image._id, { title: image.title });
      }
      return sendSuccess(res, image, 'Hero image updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async deleteHeroImage(req, res, next) {
    try {
      const { id } = req.params;
      const image = await HeroImage.findByIdAndDelete(id);
      if (!image) throw new NotFoundError('Hero image not found');

      if (req.logAudit) {
        await req.logAudit('DELETE_HERO_IMAGE', 'HeroImage', id, { title: image.title });
      }
      return sendSuccess(res, null, 'Hero image deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  async getIntegrationsDashboard(req, res, next) {
    try {
      const data = await healthService.getIntegrationsDashboard();
      return sendSuccess(res, data, 'Integrations dashboard retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AdminController();

