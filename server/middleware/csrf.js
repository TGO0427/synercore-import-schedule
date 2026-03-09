// server/middleware/csrf.js
// Defense-in-depth CSRF protection for SPA
//
// Since the app uses JWT via Authorization header (not cookies),
// traditional CSRF is not the primary risk. This middleware adds
// an extra layer by requiring state-changing requests to include
// either an Authorization header or the X-Requested-With header,
// neither of which browsers auto-attach on cross-origin requests.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Auth endpoints that are called before the user has a token
// These are inherently CSRF-safe (no session cookie to exploit)
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/setup',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

export function csrfProtection(req, res, next) {
  // Safe (read-only) methods are exempt
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Pre-auth endpoints are exempt (no cookie-based session to exploit)
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const hasAuth = !!req.headers['authorization'];
  const hasXhr = req.headers['x-requested-with'] === 'XMLHttpRequest';

  if (hasAuth || hasXhr) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    code: 'CSRF_VALIDATION_FAILED',
    message: 'State-changing requests must include an Authorization or X-Requested-With header.',
  });
}
