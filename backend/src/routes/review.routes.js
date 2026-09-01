const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const zod = require('zod');

const submitReviewSchema = zod.object({
  productId: zod.string(),
  rating: zod.number().int().min(1).max(5),
  comment: zod.string().min(3, 'Comment must be at least 3 characters long')
});

router.post('/', authenticate, validate({ body: submitReviewSchema }), reviewController.submitReview);

module.exports = router;

