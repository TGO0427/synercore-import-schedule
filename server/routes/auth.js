import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/connection.js';
import {
  validateUserUpdate,
  validateResetPassword,
  validateId,
  validateRegister,
  validateLogin,
  validateChangePassword
} from '../middleware/validation.js';

const router = express.Router();

// JWT secrets (MUST be set in environment variables)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';

// Validate JWT_SECRET is configured
if (!JWT_SECRET) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Application cannot start without it.');
}

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// Helper function to create and store refresh token
async function createRefreshToken(userId, ipAddress = null, userAgent = null) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

  try {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, refreshToken, expiresAt, ipAddress, userAgent]
    );
    return refreshToken;
  } catch (error) {
    // If table doesn't exist yet, skip storing but still return token
    // (for backward compatibility during migration)
    if (error.code === '42P01') {
      return refreshToken;
    }
    throw error;
  }
}

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification failed:', {
        error: err.message,
        tokenLength: token?.length,
        hasJWTSecret: !!JWT_SECRET
      });
      return res.status(403).json({ error: 'Invalid or expired token', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/setup - Initial admin setup (only works when no users exist)
router.post('/setup', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if any users exist
    const userCount = await pool.query('SELECT COUNT(*) FROM users');

    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(403).json({ error: 'Setup already completed. Users exist in the system.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [id, username, email || null, passwordHash, fullName || null, 'admin', true]
    );

    const user = result.rows[0];

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Create and store refresh token
    const refreshToken = await createRefreshToken(
      user.id,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      },
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error in setup:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// POST /api/auth/register - Register new user
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [id, username, email || null, passwordHash, fullName || null, 'user', true]
    );

    const user = result.rows[0];

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Create and store refresh token
    const refreshToken = await createRefreshToken(
      user.id,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      },
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Create and store refresh token
    const refreshToken = await createRefreshToken(
      user.id,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    console.log('[AUTH] Login successful for user:', user.username, {
      tokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      expiresIn: ACCESS_TOKEN_EXPIRY
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      },
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Error in get current user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/auth/admin/create-user - Create user (admin only)
router.post('/admin/create-user', authenticateToken, validateRegister, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, email, password, fullName, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [id, username, email || null, passwordHash, fullName || null, role, true]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /api/auth/admin/users - List all users (admin only)
router.get('/admin/users', authenticateToken, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(result.rows.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    })));
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// PUT /api/auth/admin/users/:id - Update user (admin only)
router.put('/admin/users/:id', authenticateToken, validateUserUpdate, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { username, email, fullName, role, isActive } = req.body;

    // Validate inputs
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "user" or "admin"' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username/email is already taken by another user
    const duplicateCheck = await pool.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
      [username, email, id]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Update user
    const result = await pool.query(
      `UPDATE users
       SET username = $1, email = $2, full_name = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, email || null, fullName || null, role || 'user', isActive !== undefined ? isActive : true, id]
    );

    const user = result.rows[0];

    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/auth/admin/users/:id/reset-password - Reset user password (admin only)
router.post('/admin/users/:id/reset-password', authenticateToken, validateResetPassword, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/auth/admin/users/:id - Delete user (admin only)
router.delete('/admin/users/:id', authenticateToken, validateId, async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/auth/refresh - Refresh access token using refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Check if refresh token exists and is valid (not expired or revoked)
    try {
      const tokenResult = await pool.query(
        `SELECT user_id, expires_at, revoked_at FROM refresh_tokens
         WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [refreshToken]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const userId = tokenResult.rows[0].user_id;

      // Get user data
      const userResult = await pool.query(
        'SELECT id, username, role FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const user = userResult.rows[0];

      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      res.json({
        accessToken: newAccessToken,
        expiresIn: 900 // 15 minutes in seconds
      });
    } catch (error) {
      // If refresh_tokens table doesn't exist, allow legacy token refresh
      if (error.code === '42P01') {
        return res.status(501).json({ error: 'Token refresh not yet available. Please log in again.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// POST /api/auth/logout - Revoke refresh token
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.json({ message: 'Logged out successfully' });
    }

    // Revoke the refresh token
    try {
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
         WHERE token = $1 AND user_id = $2`,
        [refreshToken, req.user.id]
      );
    } catch (error) {
      // If table doesn't exist, just proceed
      if (error.code !== '42P01') {
        throw error;
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// POST /api/auth/change-password - Change own password
router.post('/change-password', authenticateToken, validateChangePassword, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user from database
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, username FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success (security: don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    }

    const user = result.rows[0];

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expiry = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [resetTokenHash, resetTokenExpiry, user.id]
    );

    // TODO: Send email with reset link
    // In production, you would integrate with an email service (SendGrid, Mailgun, etc.)
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    // await sendResetEmail(email, user.username, resetLink);

    console.log(`[Auth] Password reset requested for ${email}`);
    console.log(`[DEV ONLY] Reset token: ${resetToken}`); // Remove in production

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (error) {
    console.error('[Auth] Error requesting password reset:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password - Complete password reset with token
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      return res.status(400).json({ error: 'Email, token, and password are required' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'Password must contain uppercase, lowercase, and number' });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, reset_token, reset_token_expiry FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify reset token
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    if (!user.reset_token || user.reset_token !== resetTokenHash) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (new Date() > user.reset_token_expiry) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    console.log(`[Auth] Password reset completed for ${email}`);

    res.json({ message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('[Auth] Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
