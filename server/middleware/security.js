// server/middleware/security.js
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { authenticateToken, optionalAuth, requireAdmin } from './auth.ts';

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

// Re-export auth middleware for convenience
export { authenticateToken, optionalAuth, requireAdmin };
