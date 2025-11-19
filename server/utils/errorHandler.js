/**
 * Standardized Error Handling Utility
 * Ensures consistent error responses across the application
 */

/**
 * Error class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

/**
 * Standardized error response format
 * @param {Error|AppError} error - The error to format
 * @param {boolean} isProduction - Whether to hide sensitive details
 * @returns {Object} Formatted error response
 */
export const formatError = (error, isProduction = true) => {
  // Determine status code
  const statusCode = error.statusCode || 500;

  // Determine error code
  const code = error.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  // Build error response
  const response = {
    error: isProduction ? getPublicMessage(error, statusCode) : error.message,
    code,
  };

  // Add details in development mode only
  if (!isProduction && error.details) {
    response.details = error.details;
  }

  return response;
};

/**
 * Get appropriate public message based on status code
 * Prevents leaking sensitive information in production
 */
const getPublicMessage = (error, statusCode) => {
  // Custom message if available
  if (error.message && !error.message.includes('database') && !error.message.includes('ENOENT')) {
    return error.message;
  }

  // Generic messages for common status codes
  const messages = {
    400: 'Invalid request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Resource not found',
    409: 'Conflict',
    422: 'Unprocessable entity',
    429: 'Too many requests',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
  };

  return messages[statusCode] || 'An error occurred';
};

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {Error|AppError} error - The error to send
 * @param {string} logContext - Context for logging (e.g., function name)
 */
export const sendError = (res, error, logContext = '') => {
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = error.statusCode || 500;

  // Always log errors server-side
  const logMessage = logContext ? `[${logContext}]` : '';
  if (statusCode >= 500) {
    console.error(`${logMessage} Server Error:`, error);
  } else {
    console.warn(`${logMessage} Client Error (${statusCode}):`, error.message);
  }

  // Send formatted error response
  const errorResponse = formatError(error, isProduction);
  res.status(statusCode).json(errorResponse);
};

/**
 * Catch-all error handler for routes
 * Wrap this around async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Convert standard Error to AppError if needed
      if (!(error instanceof AppError)) {
        const isProduction = process.env.NODE_ENV === 'production';
        const appError = new AppError(
          isProduction ? 'Internal server error' : error.message,
          500,
          'INTERNAL_ERROR'
        );
        sendError(res, appError, 'asyncHandler');
        return;
      }
      sendError(res, error, 'asyncHandler');
    });
  };
};

/**
 * Common error types (ready-to-use)
 */
export const Errors = {
  NotFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  Unauthorized: () =>
    new AppError('Unauthorized access', 401, 'UNAUTHORIZED'),

  Forbidden: () =>
    new AppError('Access forbidden', 403, 'FORBIDDEN'),

  BadRequest: (message = 'Invalid request') =>
    new AppError(message, 400, 'BAD_REQUEST'),

  Conflict: (message = 'Resource already exists') =>
    new AppError(message, 409, 'CONFLICT'),

  ValidationError: (details) =>
    new AppError('Validation failed', 422, 'VALIDATION_ERROR', details),

  DatabaseError: (operation = 'database operation', isProduction = process.env.NODE_ENV === 'production') =>
    new AppError(
      isProduction ? 'A database error occurred' : `Failed to complete ${operation}`,
      500,
      'DATABASE_ERROR'
    ),

  InternalError: (message = 'An internal error occurred', details = null) =>
    new AppError(message, 500, 'INTERNAL_ERROR', details),
};

/**
 * Validate required fields in request
 * @param {Object} data - The data to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {boolean} True if all required fields present
 * @throws {AppError} If any field is missing
 */
export const validateRequired = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw Errors.BadRequest(`Missing required fields: ${missing.join(', ')}`);
  }
  return true;
};
