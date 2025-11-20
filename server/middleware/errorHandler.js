/**
 * Centralized error handling middleware
 * Converts all errors to consistent AppError format and returns proper JSON responses
 */

import { AppError } from '../utils/AppError.js';
import { logError, logWarn } from '../utils/logger.js';

/**
 * Express error handler middleware
 * Must be placed after all other middleware and routes
 * Signature: (err, req, res, next) - Express requires 4 parameters even if next is unused
 */
export const errorHandler = (err, req, res, next) => {
  // Prevent response from being sent twice
  if (res.headersSent) {
    return next(err);
  }

  // Convert to AppError if not already
  let error = err instanceof AppError ? err : convertToAppError(err);

  // Log the error
  logErrorWithContext(error, req);

  // Determine if we should expose error details to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldExposeDetails = isDevelopment || error.code === 'VALIDATION_ERROR';

  // Build response
  const response = {
    error: error.message,
    code: error.code,
    ...(shouldExposeDetails && error.details && { details: error.details }),
    ...(isDevelopment && { stack: error.stack })
  };

  // Send response
  res.status(error.statusCode).json(response);
};

/**
 * Convert various error types to AppError
 */
function convertToAppError(err) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    return AppError.badRequest('Validation failed', {
      fields: errors.map(e => ({
        field: e.param,
        message: e.msg,
        value: e.value
      }))
    });
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return AppError.badRequest('Invalid JSON in request body');
  }

  // Handle database errors
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL integrity constraint violations
    return AppError.unprocessable('Database constraint violation');
  }

  if (err.code === '42P01') {
    // PostgreSQL undefined table
    return AppError.internal('Database table not found', 'DB_TABLE_NOT_FOUND');
  }

  if (err.code && err.code.startsWith('42')) {
    // PostgreSQL syntax/permission errors
    return AppError.internal('Database error', 'DB_ERROR');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return AppError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return AppError.unauthorized('Token expired');
  }

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return AppError.badRequest('File too large');
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return AppError.badRequest('Too many files');
  }

  if (err.code === 'INVALID_MIME_TYPE' || err.code === 'INVALID_EXTENSION') {
    return AppError.badRequest(err.message);
  }

  // Default: treat as internal server error
  return AppError.internal(
    isDevelopment ? err.message : 'An unexpected error occurred',
    err.code || 'UNHANDLED_ERROR'
  );
}

/**
 * Log error with request context
 */
function logErrorWithContext(error, req) {
  const context = {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    errorCode: error.code,
    requestId: req.id || 'unknown'
  };

  if (error.statusCode >= 500) {
    logError(error.message, error, context);
  } else if (error.statusCode >= 400) {
    logWarn(error.message, context);
  }
}

/**
 * Async error wrapper for route handlers
 * Wraps async route handlers to catch errors and pass them to error middleware
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  errorHandler,
  asyncHandler
};
