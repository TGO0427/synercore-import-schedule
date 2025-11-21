/**
 * Authentication and authorization middleware
 * Provides JWT verification, role-based access control, and permission checks
 */

import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';

// Token expiry configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 // 7 days in seconds
};

/**
 * Verify JWT secret is configured
 */
if (!JWT_SECRET) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Application cannot start without it.'
  );
}

/**
 * Generate access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId) {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify access token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
}

/**
 * Required authentication middleware
 * Verifies JWT token and extracts user information
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const error = AppError.unauthorized('Access token required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    const error = AppError.unauthorized('Invalid or expired token');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  req.user = payload;
  next();
};

/**
 * Optional authentication middleware
 * Allows requests without token but extracts user info if token is provided
 */
export const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without user context
    next();
    return;
  }

  const payload = verifyAccessToken(token);

  if (payload) {
    req.user = payload;
  }

  next();
};

/**
 * Admin-only middleware
 * Requires authentication and admin role
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    const error = AppError.unauthorized('Authentication required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  if (req.user.role !== 'admin') {
    const error = AppError.forbidden('Admin access required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  next();
};

/**
 * Supplier-only middleware
 * Requires authentication and supplier role
 */
export const requireSupplier = (req, res, next) => {
  if (!req.user) {
    const error = AppError.unauthorized('Authentication required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  if (req.user.role !== 'supplier') {
    const error = AppError.forbidden('Supplier access required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  next();
};

/**
 * Role-based access control middleware
 * Allows multiple roles
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = AppError.unauthorized('Authentication required');
      res.status(error.statusCode).json(error.toJSON());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const error = AppError.forbidden(
        `Access requires one of the following roles: ${allowedRoles.join(', ')}`
      );
      res.status(error.statusCode).json(error.toJSON());
      return;
    }

    next();
  };
};

/**
 * Same user or admin middleware
 * Allows user to access their own resources or admins to access any
 */
export const requireSameUserOrAdmin = (req, res, next) => {
  if (!req.user) {
    const error = AppError.unauthorized('Authentication required');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  const targetUserId = req.params.id;

  if (req.user.id !== targetUserId && req.user.role !== 'admin') {
    const error = AppError.forbidden('You can only access your own resources');
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  next();
};

export default {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireSupplier,
  requireRole,
  requireSameUserOrAdmin,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TOKEN_CONFIG
};
