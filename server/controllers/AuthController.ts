/**
 * Authentication Controller
 * Handles all authentication-related operations
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { User, AuthTokens } from '../types/index.js';
import { AppError } from '../utils/AppError.js';
import { userRepository } from '../db/repositories/index.js';
import { query, queryOne } from '../db/connection.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TOKEN_CONFIG
} from '../middleware/auth.js';

/**
 * Login request body
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Register request body
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

/**
 * Change password request body
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Reset password request body
 */
export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

/**
 * Authentication Controller Class
 */
export class AuthController {
  /**
   * Login user
   */
  static async login(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    user: Omit<User, 'password_hash'>;
    tokens: AuthTokens;
  }> {
    // Find user by username
    const user = await userRepository.findByUsername(username);

    if (!user) {
      throw AppError.unauthorized('Invalid username or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw AppError.unauthorized('Invalid username or password');
    }

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken, ipAddress, userAgent);

    // Return user and tokens (without password)
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900 // 15 minutes in seconds
      }
    };
  }

  /**
   * Register new user
   */
  static async register(data: RegisterRequest): Promise<{
    user: Omit<User, 'password_hash'>;
    tokens: AuthTokens;
  }> {
    // Check if username exists
    if (await userRepository.usernameExists(data.username)) {
      throw AppError.conflict('Username already exists');
    }

    // Check if email exists
    if (await userRepository.emailExists(data.email)) {
      throw AppError.conflict('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user = await userRepository.create({
      id: userId,
      username: data.username,
      email: data.email,
      password_hash: passwordHash,
      full_name: data.fullName,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date()
    } as Partial<User>);

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    // Return user and tokens (without password)
    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900
      }
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      throw AppError.unauthorized('Invalid refresh token');
    }

    // Get user
    const user = await userRepository.findById(payload.id);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    const newRefreshToken = generateRefreshToken(user.id);

    // Store new refresh token
    await this.storeRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    };
  }

  /**
   * Change password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user
    const user = await userRepository.findById(userId);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      throw AppError.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await userRepository.updatePassword(userId, newPasswordHash);
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<string> {
    // Find user by email
    const user = await userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists for security
      return '';
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    const sql = `
      INSERT INTO password_resets (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, $4)
    `;

    try {
      await query(sql, [user.id, resetTokenHash, expiresAt, new Date()]);
    } catch (error) {
      // Table might not exist, continue anyway
      if ((error as any).code !== '42P01') {
        throw error;
      }
    }

    return resetToken;
  }

  /**
   * Reset password using token
   */
  static async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    // Find user by email
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Hash token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Verify reset token
    const resetRequest = await queryOne<{ user_id: string; expires_at: Date }>(
      `SELECT user_id, expires_at FROM password_resets
       WHERE user_id = $1 AND token = $2`,
      [user.id, tokenHash]
    );

    if (!resetRequest) {
      throw AppError.badRequest('Invalid reset token');
    }

    if (new Date() > resetRequest.expires_at) {
      throw AppError.badRequest('Reset token has expired');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await userRepository.updatePassword(user.id, newPasswordHash);

    // Delete reset token
    await query(
      `DELETE FROM password_resets WHERE user_id = $1 AND token = $2`,
      [user.id, tokenHash]
    );
  }

  /**
   * Store refresh token
   */
  private static async storeRefreshToken(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY * 1000
    );

    const sql = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    try {
      await query(sql, [userId, refreshToken, expiresAt, ipAddress, userAgent, new Date()]);
    } catch (error) {
      // Table might not exist, continue anyway (backward compatibility)
      if ((error as any).code !== '42P01') {
        throw error;
      }
    }
  }
}

export default AuthController;
