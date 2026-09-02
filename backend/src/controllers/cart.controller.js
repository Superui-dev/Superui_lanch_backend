const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const { ProductImage, ProductTechStack } = require('../models/ProductSubCollections');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');

class CartController {
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart) {
      cart = await Cart.create({ userId, status: 'active' });
    }
    return cart;
  }

  async getCart(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { cart: null, items: [] }, 'Guest cart is empty');
      }
      const cart = await this.getOrCreateCart(req.user._id);
      const items = await CartItem.find({ cartId: cart._id })
        .populate('productId', 'name slug sellingPrice originalPrice discountPercent currency thumbnail status productId')
        .lean();

      const activeItems = items.filter(item => item.productId && item.productId.status === 'published');
      for (const item of activeItems) {
        if (item.productId) {
          item.productId.price = item.productId.sellingPrice;
          item.productId.compareAtPrice = item.productId.originalPrice;
        }
      }

      return sendSuccess(res, { cart, items: activeItems }, 'Cart details retrieved');
    } catch (error) {
      return next(error);
    }
  }

  async addToCart(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { guest: true }, 'Guest cart updated locally');
      }
      const { productId, quantity = 1 } = req.body;

      const product = await Product.read.findOne({ _id: productId, status: 'published' });
      if (!product) {
        throw new NotFoundError('Product not found or unavailable');
      }

      const cart = await this.getOrCreateCart(req.user._id);

      let cartItem = await CartItem.findOne({ cartId: cart._id, productId });
      if (cartItem) {
        cartItem.quantity += parseInt(quantity, 10);
        await cartItem.save();
      } else {
        cartItem = await CartItem.create({
          cartId: cart._id,
          productId,
          quantity: parseInt(quantity, 10)
        });
      }

      return sendSuccess(res, cartItem, 'Item added to cart successfully', 201);
    } catch (error) {
      return next(error);
    }
  }

  async updateCartItem(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { guest: true }, 'Guest cart updated locally');
      }
      const { productId } = req.params;
      const { quantity } = req.body;

      if (quantity <= 0) {
        throw new BadRequestError('Quantity must be greater than 0. Use DELETE to remove item.');
      }

      const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
      if (!cart) {
        throw new NotFoundError('Active cart not found');
      }

      const cartItem = await CartItem.findOneAndUpdate(
        { cartId: cart._id, productId },
        { quantity: parseInt(quantity, 10) },
        { new: true }
      );

      if (!cartItem) {
        throw new NotFoundError('Item not found in cart');
      }

      return sendSuccess(res, cartItem, 'Cart item updated successfully');
    } catch (error) {
      return next(error);
    }
  }

  async removeFromCart(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { guest: true }, 'Guest cart item removed locally');
      }
      const { productId } = req.params;
      const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
      if (!cart) {
        return new sendSuccess(res, null, 'Cart not found');
      }

      const result = await CartItem.deleteOne({ cartId: cart._id, productId });
      if (result.deletedCount === 0) {
        throw new NotFoundError('Item not found in cart');
      }

      return sendSuccess(res, null, 'Item removed from cart successfully');
    } catch (error) {
      return next(error);
    }
  }

  async clearCart(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { guest: true }, 'Guest cart cleared locally');
      }
      const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
      if (!cart) {
        throw new NotFoundError('Active cart not found');
      }

      await CartItem.deleteMany({ cartId: cart._id });
      return sendSuccess(res, null, 'Cart cleared successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new CartController();

