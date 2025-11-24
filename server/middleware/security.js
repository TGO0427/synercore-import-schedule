// server/middleware/security.js
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { authenticateToken } from '../routes/auth.js';

// Rate limiting configuration
export const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs, // Time window in milliseconds
    max, // Max requests per window
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
};

// Strict rate limiter for auth endpoints
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 20); // 20 requests per 15 minutes

// General API rate limiter
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes

// Helmet security headers configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      // Allow API connections from Vercel frontend
      connectSrc: [
        "'self'",
        'https://synercore-import-schedule.vercel.app',
        'https://synercore-import-schedule-*.vercel.app' // Preview deployments
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  crossOriginResourcePolicy: false, // Disable to allow our custom CORS headers
});

// Export authenticateToken for convenience
export { authenticateToken };

// Optional authentication middleware (allows requests without token for public endpoints)
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without user context
    req.user = null;
    return next();
  }

  // Token provided, verify it
  authenticateToken(req, res, next);
};

// Admin-only middleware (requires authentication and admin role)
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
