const express = require('express');
const router = express.Router();
const Feedback = require('../../models/Feedback');
const { sendSuccess } = require('../../utils/responses');
const { NotFoundError } = require('../../utils/errors');

// GET /api/admin/feedback - Fetch all customer feedbacks with stats
router.get('/', async (req, res, next) => {
  try {
    const { search, rating, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { comment: { $regex: search, $options: 'i' } }
      ];
    }

    if (rating) {
      query.rating = Number(rating);
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;
    const skip = (parsedPage - 1) * parsedLimit;

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Feedback.countDocuments(query);
    const totalAll = await Feedback.countDocuments({});

    const avgRatingResult = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const avgRating = avgRatingResult[0]?.avgRating ? Number(avgRatingResult[0].avgRating.toFixed(1)) : 5.0;

    const recommendCount = await Feedback.countDocuments({ recommend: true });
    const recommendPercentage = totalAll > 0 ? Math.round((recommendCount / totalAll) * 100) : 100;

    return sendSuccess(res, {
      feedbacks,
      stats: {
        total: totalAll,
        avgRating,
        recommendPercentage
      },
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    }, 'Feedbacks fetched successfully');
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/feedback/:id - Delete feedback entry
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findByIdAndDelete(id);
    if (!feedback) throw new NotFoundError('Feedback entry not found');
    return sendSuccess(res, feedback, 'Feedback deleted successfully');
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/admin/feedback/:id/toggle-feature - Toggle featured status
router.patch('/:id/toggle-feature', async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id);
    if (!feedback) throw new NotFoundError('Feedback entry not found');
    
    feedback.featured = !feedback.featured;
    await feedback.save();
    return sendSuccess(res, feedback, `Feedback ${feedback.featured ? 'marked as featured' : 'unfeatured'}`);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
