/**
 * Custom AppError class for consistent error handling
 * Provides structured error responses with proper HTTP status codes
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace, excluding constructor call from stack
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Validation error (400)
   */
  static badRequest(message, details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  /**
   * Authentication required error (401)
   */
  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Authorization error (403)
   */
  static forbidden(message = 'Access denied') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  /**
   * Resource not found (404)
   */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  /**
   * Conflict error (409)
   */
  static conflict(message = 'Resource already exists') {
    return new AppError(message, 409, 'CONFLICT');
  }

  /**
   * Unprocessable entity (422)
   */
  static unprocessable(message, details = null) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  /**
   * Internal server error (500)
   */
  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, code);
  }

  /**
   * Service unavailable (503)
   */
  static unavailable(message = 'Service unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Convert to response object
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details })
    };
  }
}

export default AppError;
