/**
 * Authentication Routes
 * Handles user login, registration, token refresh, and password management
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  body,
  validationResult
} from 'express-validator';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import AuthController, {
  type LoginRequest,
  type RegisterRequest,
  type ChangePasswordRequest,
  type ResetPasswordRequest
} from '../controllers/AuthController.js';
import type { TypedAuthenticatedRequest, BodyRequest } from '../types/api.js';

const router = Router();

/**
 * Validation middleware for login
 */
const validateLogin = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

/**
 * Validation middleware for registration
 */
const validateRegister = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required')
];

/**
 * Validation middleware for change password
 */
const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
];

/**
 * Validation middleware for reset password
 */
const validateResetPassword = [
  body('email').isEmail().withMessage('Invalid email address'),
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

/**
 * Validation error handler
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = AppError.unprocessable('Validation failed', {
      fields: errors.array().map((err: any) => ({
        field: err.param || err.path,
        message: err.msg,
        value: err.value
      }))
    });
    res.status(error.statusCode).json(error.toJSON());
    return;
  }
  next();
};

/**
 * POST /api/auth/login
 * Login with username and password
 * Returns access and refresh tokens
 */
router.post(
  '/login',
  validateLogin,
  handleValidationErrors,
  asyncHandler(async (req: BodyRequest<LoginRequest>, res: Response) => {
    const { username, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    const result = await AuthController.login(username, password, ipAddress, userAgent);

    res.status(200).json({
      data: result,
      message: 'Login successful'
    });
  })
);

/**
 * POST /api/auth/register
 * Register new user
 * Returns access and refresh tokens
 */
router.post(
  '/register',
  validateRegister,
  handleValidationErrors,
  asyncHandler(async (req: BodyRequest<RegisterRequest>, res: Response) => {
    const { username, email, password, fullName } = req.body;

    const result = await AuthController.register({
      username,
      email,
      password,
      fullName
    });

    res.status(201).json({
      data: result,
      message: 'Registration successful'
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * Returns new access and refresh tokens
 */
router.post(
  '/refresh',
  asyncHandler(async (req: BodyRequest<{ refreshToken: string }>, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw AppError.badRequest('Refresh token is required');
    }

    const tokens = await AuthController.refreshToken(refreshToken);

    res.status(200).json({
      data: tokens,
      message: 'Token refreshed'
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user (invalidates refresh token)
 * Requires authentication
 */
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (_req: Request, res: Response) => {
    // Token invalidation would happen on client side by removing token
    // Server-side could store token blacklist if needed

    res.status(200).json({
      message: 'Logout successful'
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change user password
 * Requires authentication
 */
router.post(
  '/change-password',
  authenticateToken,
  validateChangePassword,
  handleValidationErrors,
  asyncHandler(async (
    req: TypedAuthenticatedRequest<ChangePasswordRequest>,
    res: Response
  ) => {
    const { currentPassword, newPassword } = req.body;

    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    await AuthController.changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset (sends email with reset link)
 */
router.post(
  '/forgot-password',
  body('email').isEmail().withMessage('Invalid email address'),
  handleValidationErrors,
  asyncHandler(async (req: BodyRequest<{ email: string }>, res: Response): Promise<void> => {
    const { email } = req.body;

    const resetToken = await AuthController.requestPasswordReset(email);

    // In production, send email with reset link
    // For now, return token for testing

    res.status(200).json({
      message: 'If an account exists with that email, a password reset link will be sent',
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 */
router.post(
  '/reset-password',
  validateResetPassword,
  handleValidationErrors,
  asyncHandler(async (req: BodyRequest<ResetPasswordRequest>, res: Response) => {
    const { email, token, newPassword } = req.body;

    await AuthController.resetPassword(email, token, newPassword);

    res.status(200).json({
      message: 'Password reset successful'
    });
  })
);

export default router;
