/**
 * Request ID middleware
 * Adds a unique ID to each request for tracking through logs
 * Helps trace requests through the entire request/response lifecycle
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Generate a simple random string for request IDs
 */
function generateRandomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a request ID
 * Format: {timestamp}-{random} for human-readable tracking
 */
function generateRequestId(): string {
  const timestamp = Date.now();
  const random = generateRandomString(8);
  return `${timestamp}-${random}`;
}

/**
 * Extend Express Request to include our custom properties
 */
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware to add request ID to all requests
 * Stores it in req.id and response header
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if request already has an ID (from header or previous middleware)
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  // Store on request object
  req.id = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  // Add to res.locals for template use (if needed)
  res.locals.requestId = requestId;

  // Capture original res.json to track response
  const originalJson = res.json.bind(res);
  res.json = function(data: any): Response {
    // Return response
    return originalJson(data);
  };

  next();
}

/**
 * Get request ID from request object
 * Useful for logging in route handlers
 */
export function getRequestId(req: Request): string {
  return req.id || 'unknown';
}

/**
 * Helper function to add request ID to context objects for logging
 */
export function withRequestId(req: Request, additionalContext: Record<string, any> = {}): Record<string, any> {
  return {
    requestId: getRequestId(req),
    ...additionalContext
  };
}

export default {
  requestIdMiddleware,
  getRequestId,
  withRequestId
};
