const Wishlist = require('../models/Wishlist');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError } = require('../utils/errors');

class WishlistController {
  async getWishlist(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { productIds: [] }, 'Guest wishlist is empty');
      }
      let wishlist = null;
      try {
        wishlist = await Wishlist.findOne({ userId: req.user._id })
          .populate('productIds', 'name slug price sellingPrice originalPrice thumbnail categoryId status')
          .lean();
      } catch (e) {
        wishlist = await Wishlist.findOne({ userId: req.user._id }).lean();
      }

      if (!wishlist) {
        wishlist = await Wishlist.create({ userId: req.user._id, productIds: [] });
      }

      return sendSuccess(res, wishlist, 'Wishlist fetched successfully');
    } catch (error) {
      return sendSuccess(res, { productIds: [] }, 'Wishlist empty');
    }
  }

  async addToWishlist(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { productIds: [] }, 'User not logged in');
      }
      const { productId } = req.params;
      
      let wishlist = await Wishlist.findOne({ userId: req.user._id });
      if (!wishlist) {
        wishlist = await Wishlist.create({ userId: req.user._id, productIds: [productId] });
      } else {
        if (!wishlist.productIds.includes(productId)) {
          wishlist.productIds.push(productId);
          await wishlist.save();
        }
      }

      try {
        await wishlist.populate('productIds', 'name slug price sellingPrice originalPrice thumbnail categoryId status');
      } catch (e) {}

      return sendSuccess(res, wishlist, 'Product added to wishlist');
    } catch (error) {
      return next(error);
    }
  }

  async removeFromWishlist(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { productIds: [] }, 'User not logged in');
      }
      const { productId } = req.params;
      
      const wishlist = await Wishlist.findOne({ userId: req.user._id });
      if (wishlist) {
        wishlist.productIds = wishlist.productIds.filter(id => id.toString() !== productId);
        await wishlist.save();
        try {
          await wishlist.populate('productIds', 'name slug price sellingPrice originalPrice thumbnail categoryId status');
        } catch (e) {}
      }

      return sendSuccess(res, wishlist || { productIds: [] }, 'Product removed from wishlist');
    } catch (error) {
      return next(error);
    }
  }

  async clearWishlist(req, res, next) {
    try {
      if (!req.user?._id) {
        return sendSuccess(res, { productIds: [] }, 'Wishlist cleared');
      }
      const wishlist = await Wishlist.findOne({ userId: req.user._id });
      if (wishlist) {
        wishlist.productIds = [];
        await wishlist.save();
      }
      return sendSuccess(res, { productIds: [] }, 'Wishlist cleared');
    } catch (error) {
      return sendSuccess(res, { productIds: [] }, 'Wishlist cleared');
    }
  }
}

module.exports = new WishlistController();
