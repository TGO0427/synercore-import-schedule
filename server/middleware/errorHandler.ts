/**
 * Centralized error handling middleware
 * Converts all errors to consistent AppError format and returns proper JSON responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { logError, logWarn } from '../utils/logger.js';

interface ValidationError {
  array(): Array<{ param: string; msg: string; value?: any }>;
}

interface SyntaxErrorWithStatus extends SyntaxError {
  status?: number;
}

/**
 * Express error handler middleware
 * Must be placed after all other middleware and routes
 * Signature: (err, req, res, next) - Express requires 4 parameters even if next is unused
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Prevent response from being sent twice
  if (res.headersSent) {
    return;
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
function convertToAppError(err: unknown): AppError {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Handle validation errors from express-validator
  if (isValidationError(err)) {
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
  if (
    err instanceof SyntaxError &&
    (err as SyntaxErrorWithStatus).status === 400 &&
    'body' in err
  ) {
    return AppError.badRequest('Invalid JSON in request body');
  }

  // Handle database errors
  if (isDbError(err)) {
    const dbErr = err as any;

    if (dbErr.code && dbErr.code.startsWith('23')) {
      // PostgreSQL integrity constraint violations
      return AppError.unprocessable('Database constraint violation');
    }

    if (dbErr.code === '42P01') {
      // PostgreSQL undefined table
      return AppError.internal('Database table not found', 'DB_TABLE_NOT_FOUND');
    }

    if (dbErr.code && dbErr.code.startsWith('42')) {
      // PostgreSQL syntax/permission errors
      return AppError.internal('Database error', 'DB_ERROR');
    }
  }

  // Handle JWT errors
  if (isJwtError(err)) {
    const jwtErr = err as any;

    if (jwtErr.name === 'JsonWebTokenError') {
      return AppError.unauthorized('Invalid token');
    }

    if (jwtErr.name === 'TokenExpiredError') {
      return AppError.unauthorized('Token expired');
    }
  }

  // Handle file upload errors
  if (isFileUploadError(err)) {
    const uploadErr = err as any;

    if (uploadErr.code === 'LIMIT_FILE_SIZE') {
      return AppError.badRequest('File too large');
    }

    if (uploadErr.code === 'LIMIT_FILE_COUNT') {
      return AppError.badRequest('Too many files');
    }

    if (uploadErr.code === 'INVALID_MIME_TYPE' || uploadErr.code === 'INVALID_EXTENSION') {
      return AppError.badRequest(uploadErr.message);
    }
  }

  // Handle generic Error objects
  if (err instanceof Error) {
    return AppError.internal(
      isDevelopment ? err.message : 'An unexpected error occurred',
      'UNHANDLED_ERROR'
    );
  }

  // Handle unknown error types
  return AppError.internal('An unexpected error occurred', 'UNKNOWN_ERROR');
}

/**
 * Type guard for validation errors
 */
function isValidationError(err: unknown): err is ValidationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'array' in err &&
    typeof (err as any).array === 'function'
  );
}

/**
 * Type guard for database errors
 */
function isDbError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as any).code === 'string'
  );
}

/**
 * Type guard for JWT errors
 */
function isJwtError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (
      (err as any).name === 'JsonWebTokenError' ||
      (err as any).name === 'TokenExpiredError'
    )
  );
}

/**
 * Type guard for file upload errors
 */
function isFileUploadError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (
      (err as any).code === 'LIMIT_FILE_SIZE' ||
      (err as any).code === 'LIMIT_FILE_COUNT' ||
      (err as any).code === 'INVALID_MIME_TYPE' ||
      (err as any).code === 'INVALID_EXTENSION'
    )
  );
}

/**
 * Log error with request context
 */
function logErrorWithContext(error: AppError, req: Request): void {
  const context = {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    errorCode: error.code,
    requestId: (req as any).id || 'unknown'
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
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => (req: Request, res: Response, next: NextFunction): void => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  errorHandler,
  asyncHandler
};
