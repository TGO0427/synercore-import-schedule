/**
 * Request ID middleware
 * Adds a unique ID to each request for tracking through logs
 * Helps trace requests through the entire request/response lifecycle
 */

// Lazy import to avoid circular dependencies
let logDebug;
async function initLogger() {
  if (!logDebug) {
    try {
      const logger = await import('../utils/logger.js');
      logDebug = logger.logDebug;
    } catch (e) {
      logDebug = () => {}; // Fallback no-op
    }
  }
}

/**
 * Generate a simple random string for request IDs
 */
function generateRandomString(length = 8) {
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
function generateRequestId() {
  const timestamp = Date.now();
  const random = generateRandomString(8);
  return `${timestamp}-${random}`;
}

/**
 * Middleware to add request ID to all requests
 * Stores it in req.id and response header
 */
export function requestIdMiddleware(req, res, next) {
  // Initialize logger if not already done
  if (!logDebug) {
    logDebug = () => {}; // Use no-op if logger not available yet
  }

  // Check if request already has an ID (from header or previous middleware)
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Store on request object
  req.id = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  // Add to res.locals for template use (if needed)
  res.locals.requestId = requestId;

  // Log request start (with fallback)
  try {
    if (typeof logDebug === 'function') {
      logDebug('Request started', {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')?.substring(0, 50)
      });
    }
  } catch (e) {
    // Silent fail if logging fails
  }

  // Store start time for duration calculation
  const startTime = Date.now();

  // Capture original res.json to add requestId to responses
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log request completion (with fallback)
    try {
      if (typeof logDebug === 'function') {
        logDebug('Request completed', {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          durationMs: duration
        });
      }
    } catch (e) {
      // Silent fail if logging fails
    }

    // Return response
    return originalJson(data);
  };

  next();
}

/**
 * Get request ID from request object
 * Useful for logging in route handlers
 */
export function getRequestId(req) {
  return req.id || 'unknown';
}

/**
 * Helper function to add request ID to context objects for logging
 */
export function withRequestId(req, additionalContext = {}) {
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
