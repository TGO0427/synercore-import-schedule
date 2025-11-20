/**
 * Custom AppError class for consistent error handling
 * Provides structured error responses with proper HTTP status codes
 */

import type { ErrorResponse } from '../types/index.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
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
  static badRequest(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  /**
   * Authentication required error (401)
   */
  static unauthorized(message: string = 'Authentication required'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Authorization error (403)
   */
  static forbidden(message: string = 'Access denied'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  /**
   * Resource not found (404)
   */
  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  /**
   * Conflict error (409)
   */
  static conflict(message: string = 'Resource already exists'): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }

  /**
   * Unprocessable entity (422)
   */
  static unprocessable(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  /**
   * Internal server error (500)
   */
  static internal(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, code);
  }

  /**
   * Service unavailable (503)
   */
  static unavailable(message: string = 'Service unavailable'): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Convert to response object
   */
  toJSON(): ErrorResponse {
    return {
      error: this.message,
      code: this.code,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details })
    };
  }
}

export default AppError;
