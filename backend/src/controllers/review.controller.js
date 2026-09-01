const Review = require('../models/Review');
const Product = require('../models/Product');
const { NotFoundError } = require('../utils/errors');
const { sendSuccess } = require('../utils/responses');

class ReviewController {
  // Submit review for a product
  async submitReview(req, res, next) {
    try {
      const { productId, rating, comment } = req.body;
      const userId = req.user._id;

      const product = await Product.findById(productId);
      if (!product) {
        throw new NotFoundError('Product not found');
      }

      // Create review with 'pending' status by default (awaits admin approval)
      const review = await Review.create({
        productId,
        userId,
        rating,
        comment,
        status: 'pending'
      });

      return sendSuccess(res, review, 'Review submitted successfully and is awaiting approval', 201);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ReviewController();

