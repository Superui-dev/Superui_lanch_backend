function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * Standardized API Error Response Formatter
 */
function sendError(res, message = 'An error occurred', statusCode = 500, details = null, options = {}) {
  const errorId = options.id || `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      id: errorId,
      code: options.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'API_ERROR'),
      category: options.category || (statusCode >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR'),
      severity: options.severity || (statusCode >= 500 ? 'CRITICAL' : 'ERROR'),
      message: message,
      userMessage: options.userMessage || message,
      httpStatus: statusCode,
      suggestedFix: options.suggestedFix || 'Refer to API documentation or check request parameters.',
      ...(details && { details })
    }
  });
}

module.exports = {
  sendSuccess,
  sendError
};
