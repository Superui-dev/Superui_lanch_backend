const express = require('express');
const router = express.Router();
const Issue = require('../../models/Issue');
const { sendSuccess } = require('../../utils/responses');
const { NotFoundError } = require('../../utils/errors');

// GET /api/admin/issues - Fetch all customer raised issues
router.get('/', async (req, res, next) => {
  try {
    const { search, status, issueType, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (issueType) {
      query.issueType = issueType;
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;
    const skip = (parsedPage - 1) * parsedLimit;

    const issues = await Issue.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Issue.countDocuments(query);
    const openCount = await Issue.countDocuments({ status: 'open' });
    const inProgressCount = await Issue.countDocuments({ status: 'in_progress' });
    const resolvedCount = await Issue.countDocuments({ status: 'resolved' });

    return sendSuccess(res, {
      issues,
      stats: {
        total,
        openCount,
        inProgressCount,
        resolvedCount
      },
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    }, 'Issues fetched successfully');
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/admin/issues/:id/status - Update issue status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const issue = await Issue.findById(id);
    if (!issue) throw new NotFoundError('Issue not found');

    if (status) issue.status = status;
    await issue.save();

    return sendSuccess(res, issue, `Issue status updated to ${status}`);
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/issues/:id - Delete issue entry
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const issue = await Issue.findByIdAndDelete(id);
    if (!issue) throw new NotFoundError('Issue not found');
    return sendSuccess(res, issue, 'Issue deleted successfully');
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
