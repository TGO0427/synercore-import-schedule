/**
 * Authentication and authorization middleware
 * Provides JWT verification, role-based access control, and permission checks
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types/index.js';
import { AppError } from '../utils/AppError.ts';

/**
 * Extend Express Request with user authentication
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

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
export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY
  } as any);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY } as any
  );
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { id: string; type: string } | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { id: string; type: string };
  } catch {
    return null;
  }
}

/**
 * Required authentication middleware
 * Verifies JWT token and extracts user information
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
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
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
export const requireSupplier = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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
export const requireSameUserOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
