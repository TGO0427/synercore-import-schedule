// Notification routes - preferences and history
import express from 'express';
import pool from '../db/connection.js';
import { authenticateToken } from './auth.js';
import EmailService from '../services/emailService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications/preferences - Get user's notification preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const prefs = await EmailService.getPreferences(req.user.id);
    res.json(prefs);
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * PUT /api/notifications/preferences - Update user's notification preferences
 */
router.put('/preferences', async (req, res) => {
  try {
    const preferences = req.body;

    const updated = await EmailService.updatePreferences(req.user.id, preferences);

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: updated
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * GET /api/notifications/history - Get notification log for user
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, eventType = null } = req.query;

    let query = 'SELECT * FROM notification_log WHERE user_id = $1';
    const params = [req.user.id];

    if (eventType) {
      query += ' AND event_type = $2';
      params.push(eventType);
    }

    query += ' ORDER BY sent_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM notification_log WHERE user_id = $1';
    if (eventType) {
      countQuery += ' AND event_type = $2';
    }

    const countResult = await pool.query(countQuery, eventType ? [req.user.id, eventType] : [req.user.id]);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      notifications: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

/**
 * GET /api/notifications/history/:id - Get specific notification
 */
router.get('/history/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_log WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting notification:', error);
    res.status(500).json({ error: 'Failed to get notification' });
  }
});

/**
 * DELETE /api/notifications/history/:id - Delete notification
 */
router.delete('/history/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notification_log WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * POST /api/notifications/test - Send test email
 */
router.post('/test', async (req, res) => {
  try {
    const prefs = await EmailService.getPreferences(req.user.id);
    const emailAddress = prefs.email_address || (await EmailService.getUserEmail(req.user.id));

    if (!emailAddress) {
      return res.status(400).json({ error: 'No email address configured' });
    }

    const result = await EmailService.sendEmail(
      emailAddress,
      '🧪 Test Email from Synercore',
      `<h2>Test Email</h2><p>This is a test email to confirm your notification settings are working.</p>`
    );

    if (result.success) {
      await EmailService.logNotification(
        req.user.id,
        'test_email',
        'Test Email',
        'Test email sent successfully',
        null,
        'sent'
      );

      res.json({ message: 'Test email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ error: 'Failed to send test email', details: result.error });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * GET /api/notifications/stats - Get notification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Count by event type
    const typeResult = await pool.query(
      `SELECT event_type, COUNT(*) as count,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM notification_log
       WHERE user_id = $1
       GROUP BY event_type
       ORDER BY count DESC`,
      [req.user.id]
    );

    // Get total counts
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM notification_log
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      total: parseInt(totalResult.rows[0].total),
      sent: parseInt(totalResult.rows[0].sent),
      failed: parseInt(totalResult.rows[0].failed),
      byType: typeResult.rows
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

export default router;
