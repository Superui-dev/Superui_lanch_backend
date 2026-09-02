const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const SiteSettings = require('../models/SiteSettings');
const HeroImage = require('../models/HeroImage');
const Wishlist = require('../models/Wishlist');
const PageView = require('../models/PageView');
const Testimonial = require('../models/Testimonial');
const { ProductImage, ProductTechStack, ProductFeature } = require('../models/ProductSubCollections');
const { NotFoundError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');

async function hydrateProduct(product) {
  if (!product) return product;
  const id = product._id;
  try {
    const hasImages = Array.isArray(product.images) && product.images.length > 0;
    const hasTech = (Array.isArray(product.techStack) && product.techStack.length > 0) || (Array.isArray(product.technologies) && product.technologies.length > 0);
    const hasFeatures = Array.isArray(product.features) && product.features.length > 0;

    if (!hasImages || !hasTech || !hasFeatures) {
      const [images, techStack, features] = await Promise.all([
        hasImages ? Promise.resolve([]) : ProductImage.findAllForProduct(id).catch(() => []),
        hasTech ? Promise.resolve([]) : ProductTechStack.findAllForProduct(id).catch(() => []),
        hasFeatures ? Promise.resolve([]) : ProductFeature.findAllForProduct(id).catch(() => [])
      ]);
      if (!hasImages && images.length > 0) {
        product.images = images.map(img => ({ url: img.url, alt: img.alt, order: img.sortOrder }));
      }
      if (!hasTech && techStack.length > 0) {
        product.techStack = techStack;
      }
      if (!hasFeatures && features.length > 0) {
        product.features = features.map(f => ({ title: f.title, description: f.description }));
      }
    }
  } catch (e) {}

  if (!product.price && product.sellingPrice) product.price = product.sellingPrice;
  if (!product.compareAtPrice && product.originalPrice) product.compareAtPrice = product.originalPrice;
  if (!product.technologies && product.techStack) {
    product.technologies = product.techStack.map(t => ({ name: t.name, icon: t.icon }));
  }
  return product;
}

class PublicController {
  // Get all visible categories (includes auto-synced service cards)
  async getCategories(req, res, next) {
    try {
      // Auto-sync DB4 services into Category collection (best-effort, non-blocking)
      try {
        const Service = require('../models/Service');
        await Service.seedDefaultsIfEmpty();
        const services = await Service.find({ visible: true }).sort({ order: 1 }).lean();
        if (Array.isArray(services) && services.length > 0) {
          for (let i = 0; i < services.length; i++) {
            const s = services[i];
            if (!s.title) continue;
            const slug = (s.slug || s.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '')).toLowerCase();
            try {
              await Category.findOneAndUpdate(
                { slug },
                {
                  $set: {
                    name: s.title,
                    description: s.description || '',
                    visible: s.visible !== false,
                    order: s.order || i + 1,
                    productType: 'website-template'
                  },
                  $setOnInsert: { slug }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            } catch (upsertErr) {
              // Ignore individual upsert errors (e.g., immutable field conflict)
            }
          }
        }
      } catch (syncErr) {
        // Service sync failure should never block category fetch
      }

      const categories = await Category.read.find({ visible: true }, { sort: { order: 1 } });

      // Attach the count of products created in each category
      const enriched = await Promise.all((categories || []).map(async (cat) => {
        let productCount = 0;
        try {
          productCount = await Product.read.countDocuments({ categoryId: cat._id });
        } catch (e) { /* ignore count errors, default to 0 */ }
        return { ...cat, productCount };
      }));

      return sendSuccess(res, enriched, 'Categories fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get all visible testimonials
  async getTestimonials(req, res, next) {
    try {
      const testimonials = await Testimonial.find({ visible: true }).sort({ order: 1, createdAt: -1 }).lean();
      return sendSuccess(res, testimonials, 'Testimonials fetched successfully');
    } catch (error) {
      return sendSuccess(res, [], 'Testimonials empty fallback');
    }
  }

  // Get all published products (with filtering, search, pagination)
  async getProducts(req, res, next) {
    try {
      const { category, search, featured, page = 1, limit = 12 } = req.query;
      const query = { status: 'published' };

      if (category) {
        const cat = await Category.read.findOne({ slug: category });
        if (cat) {
          query.categoryId = cat._id;
        }
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { shortDescription: { $regex: search, $options: 'i' } }
        ];
      }

      if (featured === 'true') {
        query.featured = true;
      }

      const parsedPage = parseInt(page, 10) || 1;
      const parsedLimit = parseInt(limit, 10) || 12;
      const skip = (parsedPage - 1) * parsedLimit;

      const allMatching = await Product.read.find(query, { skip: 0, limit: skip + parsedLimit });
      const products = allMatching
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(skip, skip + parsedLimit);

      const productsWithStats = await Promise.all(products.map(async (prod) => {
        const [watchlistCount, viewsCount] = await Promise.all([
          Wishlist.countDocuments({ productIds: prod._id }).catch(() => 0),
          PageView.countDocuments({ page: `/products/${prod.slug}` }).catch(() => 0)
        ]);
        await hydrateProduct(prod);
        return {
          ...prod,
          watchlistCount,
          viewsCount
        };
      }));

      const total = await Product.read.countDocuments(query);

      return sendSuccess(res, {
        products: productsWithStats,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          pages: Math.ceil(total / parsedLimit)
        }
      }, 'Products fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get single product by slug
  async getProductBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const product = await Product.read.findOne({ slug, status: 'published' });

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      const [watchlistCount, viewsCount] = await Promise.all([
        Wishlist.countDocuments({ productIds: product._id }).catch(() => 0),
        PageView.countDocuments({ page: `/products/${product.slug}` }).catch(() => 0)
      ]);

      const productWithStats = {
        ...product,
        watchlistCount,
        viewsCount
      };

      await hydrateProduct(productWithStats);

      return sendSuccess(res, productWithStats, 'Product details fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get approved reviews for a product
  async getProductReviews(req, res, next) {
    try {
      const { productId } = req.params;
      const reviews = await Review.find({ productId, status: 'approved' })
        .populate('userId', 'name avatar')
        .sort({ createdAt: -1 })
        .lean();

      return sendSuccess(res, reviews, 'Product reviews fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get site settings (public fields only)
  async getSiteSettings(req, res, next) {
    try {
      let settings = await SiteSettings.findOne({ _id: 'site_settings' }).lean();
      if (!settings) {
        settings = {
          branding: { logoText: 'SuperUI', showLogoText: true },
          navbar: { menuItems: [] },
          footer: { copyright: 'SuperUI' }
        };
      }
      return sendSuccess(res, settings, 'Site settings fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  async getHeroImages(req, res, next) {
    try {
      const images = await HeroImage.find({ visible: true }).sort({ order: 1, createdAt: -1 }).limit(10).lean();
      return sendSuccess(res, images, 'Hero images fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Handles anti-inspection / DevTools alerts from live website and admin panel
  async handleInspectAlert(req, res, next) {
    try {
      const { page, details, clientIp } = req.body;
      const getRealIp = require('../utils/getRealIp');
      const ip = (clientIp && clientIp !== '127.0.0.1') ? clientIp : getRealIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown Browser';

      const telegramService = require('../services/telegram.service');
      await telegramService.sendSecurityAlert({
        event: 'DEVTOOLS_INSPECT_DETECTED',
        page: page || '/admin',
        details: details || 'DevTools / Inspect Element opened on live page',
        ip,
        userAgent
      });

      return sendSuccess(res, { alertSent: true }, 'Security alert logged');
    } catch (error) {
      return sendSuccess(res, { alertSent: false }, 'Security alert warning handled');
    }
  }

  // Handles Telegram alerts for ALL admin login attempts (valid, invalid, or hacker emails)
  async handleLoginAttempt(req, res, next) {
    try {
      const { email, status = 'ATTEMPTED', errorReason, clientIp } = req.body;
      const getRealIp = require('../utils/getRealIp');
      const ip = (clientIp && clientIp !== '127.0.0.1') ? clientIp : getRealIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown Browser';

      const telegramService = require('../services/telegram.service');
      await telegramService.sendLoginAttemptAlert({
        email: email || 'Unknown Email',
        status,
        errorReason,
        ip,
        userAgent
      });

      try {
        const AdminLog = require('../models/AdminLog');
        const User = require('../models/User');
        const existingUser = email ? await User.findOne({ email: email.toLowerCase().trim() }).lean() : null;

        await AdminLog.create({
          adminUserId: existingUser?._id || null,
          action: 'ADMIN_LOGIN_ATTEMPT',
          resource: 'auth',
          metadata: {
            email: email || 'Unknown Email',
            ip,
            userAgent,
            status: (status === 'SUCCESS' || status === 'ATTEMPTED') ? 'success' : 'failed',
            errorReason
          }
        });
      } catch (logErr) {
        // Warning handled
      }

      return sendSuccess(res, { alertLogged: true }, 'Login attempt alert logged');
    } catch (error) {
      return sendSuccess(res, { alertLogged: false }, 'Login attempt alert warning handled');
    }
  }

  // Submit Customer Feedback & Store in MongoDB
  async submitFeedback(req, res, next) {
    try {
      const { name, email, rating, comment, recommend, orderId, productId } = req.body;
      const Feedback = require('../models/Feedback');
      
      const feedback = await Feedback.create({
        name: name || 'Valued Customer',
        email: email || 'customer@superui.in',
        rating: Number(rating) || 5,
        comment: comment || 'Great experience!',
        recommend: recommend !== undefined ? Boolean(recommend) : true,
        orderId: orderId || '',
        productId: productId || null,
        status: 'approved'
      });

      return sendSuccess(res, feedback, 'Feedback submitted and stored in MongoDB successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  // Raise Customer Support Issue & Store in MongoDB
  async submitIssue(req, res, next) {
    try {
      const { name, email, issueType, subject, description, orderId, priority } = req.body;
      const Issue = require('../models/Issue');

      const issue = await Issue.create({
        name: name || 'Valued Customer',
        email,
        issueType: issueType || 'Download Issue',
        subject: subject || 'Customer Support Issue',
        description,
        orderId: orderId || '',
        priority: priority || 'high',
        status: 'open'
      });

      return sendSuccess(res, issue, 'Support issue raised and ticket created successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  // Book Project Discovery Call & Notify Admin
  async bookCall(req, res, next) {
    try {
      const { name, email, instagramId, phone, date, time, message } = req.body;
      const Booking = require('../models/Booking');

      const booking = await Booking.create({
        name,
        email,
        instagramId: instagramId || '',
        phone: phone || '',
        date,
        time,
        message: message || '',
        status: 'scheduled'
      });

      // Send Telegram notification alert
      try {
        const telegramService = require('../services/telegram.service');
        const telegramText = `
📅 <b>New Project Discovery Call Scheduled</b>
👤 <b>Name:</b> ${name}
✉️ <b>Email:</b> ${email}
📱 <b>Instagram ID:</b> ${instagramId || 'N/A'}
📞 <b>Cell Number:</b> ${phone || 'N/A'}
📅 <b>Date:</b> ${date}
⏰ <b>Time:</b> ${time} (IST)
💬 <b>Message / Explanation:</b>
<i>${message || 'N/A'}</i>
        `;
        telegramService.sendMessage(telegramText.trim());
      } catch (telegramErr) {
        // Safe warning suppression
      }

      // Send Email notification alert to hello.superui@gmail.com
      try {
        const emailService = require('../services/email.service');
        const emailSubject = `📅 New Discovery Call Scheduled: ${name}`;
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #fcfcfc;">
            <h2 style="color: #ff5100; border-bottom: 2px solid #ff5100; padding-bottom: 10px; margin-top: 0;">New Discovery Call Scheduled</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 35%; color: #555;">Full Name:</td>
                <td style="padding: 8px 0; color: #111;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Email Address:</td>
                <td style="padding: 8px 0; color: #111;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Instagram ID:</td>
                <td style="padding: 8px 0; color: #111;">${instagramId || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Main Cell Number:</td>
                <td style="padding: 8px 0; color: #111;">${phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Scheduled Date:</td>
                <td style="padding: 8px 0; color: #111; font-weight: bold;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Scheduled Time:</td>
                <td style="padding: 8px 0; color: #111; font-weight: bold;">${time} (IST)</td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
              <h4 style="margin: 0 0 8px 0; color: #555;">Note / Explanation:</h4>
              <p style="margin: 0; font-style: italic; color: #333; line-height: 1.5; background-color: #f7f7f7; padding: 12px; border-radius: 8px;">
                ${message ? message.replace(/\n/g, '<br/>') : 'No additional notes provided.'}
              </p>
            </div>
            <p style="margin-top: 25px; font-size: 11px; color: #888; text-align: center; border-top: 1px dashed #ddd; padding-top: 15px;">
              This is an automated booking alert sent by your SuperUI backend.
            </p>
          </div>
        `;
        
        await emailService.sendManualEmail(emailSubject, emailHtml, 'hello.superui@gmail.com');
      } catch (emailErr) {
        logger.error(`Booking email alert dispatch failed: ${emailErr.message}`);
      }

      return sendSuccess(res, booking, 'Project discovery call scheduled successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  // Get booked slots to prevent scheduling collisions
  async getBookedSlots(req, res, next) {
    try {
      const Booking = require('../models/Booking');
      const booked = await Booking.find({ status: 'scheduled' }).select('date time').lean();
      return sendSuccess(res, booked, 'Booked slots retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Proxy Instagram profile picture requests to bypass browser adblockers and CORS
  async getInstagramAvatar(req, res, next) {
    try {
      const { username } = req.params;
      const axios = require('axios');
      
      const avatarUrl = `https://unavatar.io/instagram/${username}`;
      
      // Allow browser embedding/loading of this resource cross-origin
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      
      const response = await axios({
        method: 'get',
        url: avatarUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 6500
      });
      
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      response.data.pipe(res);
    } catch (error) {
      // Allow browser embedding on fallback redirect
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      // Redirect to a real high-quality human profile image on failure or rate limits
      return res.redirect('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150&h=150');
    }
  }
}

module.exports = new PublicController();

