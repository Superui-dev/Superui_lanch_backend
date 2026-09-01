class AppError extends Error {
  constructor(
    message,
    statusCode,
    options = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.code = options.code || (statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'APPLICATION_ERROR');
    this.category = options.category || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR');
    this.severity = options.severity || (statusCode >= 500 ? 'CRITICAL' : 'ERROR');
    this.userMessage = options.userMessage || message;
    this.suggestedFix = options.suggestedFix || 'Check request payload, routing parameters, and credentials.';

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', options = {}) {
    super(message, 400, {
      code: 'INVALID_REQUEST',
      category: 'VALIDATION_ERROR',
      severity: 'WARNING',
      suggestedFix: 'Check request body parameters and formatting.',
      ...options
    });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', options = {}) {
    super(message, 401, {
      code: 'AUTHENTICATION_ERROR',
      category: 'AUTHENTICATION',
      severity: 'ERROR',
      suggestedFix: 'Provide a valid Bearer token in Authorization header.',
      ...options
    });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden action', options = {}) {
    super(message, 403, {
      code: 'AUTHORIZATION_ERROR',
      category: 'AUTHORIZATION',
      severity: 'ERROR',
      suggestedFix: 'Ensure user account has required roles or MFA status.',
      ...options
    });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', options = {}) {
    super(message, 404, {
      code: 'RESOURCE_NOT_FOUND',
      category: 'HTTP_ERROR',
      severity: 'WARNING',
      suggestedFix: 'Verify resource ObjectId or slug in URL path.',
      ...options
    });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', options = {}) {
    super(message, 409, {
      code: 'DUPLICATE_RESOURCE',
      category: 'DATABASE_ERROR',
      severity: 'WARNING',
      suggestedFix: 'Ensure unique attributes (email, slug, code) are not duplicated.',
      ...options
    });
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', options = {}) {
    super(message, 500, {
      isOperational: false,
      code: 'INTERNAL_SERVER_ERROR',
      category: 'BACKEND_EXCEPTION',
      severity: 'CRITICAL',
      suggestedFix: 'Check backend server logs for unhandled exception or database failure.',
      ...options
    });
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError
};
