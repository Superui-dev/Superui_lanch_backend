const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');

class OrderController {
  // Get history of orders for currently logged in customer
  async getMyOrders(req, res, next) {
    try {
      const orders = await Order.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .lean();

      return sendSuccess(res, orders, 'Orders fetched successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Get single order details (populated with order items)
  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const order = await Order.findById(id).lean();

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Security Check: customer can only read their own orders
      if (req.user.role !== 'admin' && order.userId.toString() !== req.user._id.toString()) {
        throw new ForbiddenError('You are not authorized to view this order');
      }

      const items = await OrderItem.find({ orderId: order._id })
        .populate('productId', 'name slug thumbnail')
        .lean();

      return sendSuccess(res, { order, items }, 'Order details retrieved');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new OrderController();

