const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/responses');

/**
 * Global Express Error Handling Middleware with End-to-End Classification
 */
function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error using Winston logger
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  // 1. Custom Operational AppErrors
  if (err instanceof AppError && err.isOperational) {
    return sendError(res, err.message, err.statusCode, null, {
      code: err.code,
      category: err.category,
      severity: err.severity,
      userMessage: err.userMessage,
      suggestedFix: err.suggestedFix
    });
  }

  // 2. Zod Validation Errors
  if (err.name === 'ZodError') {
    const formattedErrors = err.errors.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    return sendError(res, 'Validation failed', 400, formattedErrors, {
      code: 'VALIDATION_ERROR',
      category: 'VALIDATION',
      severity: 'WARNING',
      userMessage: 'Form or request validation failed. Please check field inputs.',
      suggestedFix: 'Review request payload against API Zod schema definitions.'
    });
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, `Invalid resource identifier: ${err.value}`, 400, null, {
      code: 'INVALID_OBJECT_ID',
      category: 'DATABASE_ERROR',
      severity: 'WARNING',
      userMessage: 'The provided resource ID is malformed.',
      suggestedFix: 'Check that 24-character hexadecimal MongoDB ObjectId is passed.'
    });
  }

  // 4. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `A resource with this ${field} already exists.`, 409, null, {
      code: 'DUPLICATE_KEY_ERROR',
      category: 'DATABASE_ERROR',
      severity: 'WARNING',
      userMessage: `A record with this ${field} already exists in the database.`,
      suggestedFix: `Use a unique value for ${field}.`
    });
  }

  // 5. Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return sendError(res, `Validation Error: ${messages.join(', ')}`, 400, null, {
      code: 'SCHEMA_VALIDATION_ERROR',
      category: 'DATABASE_ERROR',
      severity: 'WARNING',
      suggestedFix: 'Verify document field constraints in Mongoose models.'
    });
  }

  // 6. Generic Internal Server Error
  const isProduction = process.env.NODE_ENV === 'production';
  return sendError(
    res,
    isProduction ? 'Internal Server Error' : err.message,
    err.statusCode || 500,
    isProduction ? null : err.stack,
    {
      code: 'UNHANDLED_SERVER_EXCEPTION',
      category: 'BACKEND_EXCEPTION',
      severity: 'CRITICAL',
      userMessage: 'An unexpected backend server error occurred.',
      suggestedFix: 'Check Winston logs and stack trace to diagnose root cause.'
    }
  );
}

module.exports = errorHandler;
