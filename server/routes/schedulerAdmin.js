// Admin routes for notification scheduler management
import express from 'express';
import { authenticateToken } from './auth.js';
import NotificationScheduler from '../jobs/notificationScheduler.js';
import pool from '../db/connection.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Middleware to check if user is admin
 */
async function requireAdmin(req, res, next) {
  try {
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * GET /api/admin/scheduler/status - Get status of all notification jobs
 */
router.get('/status', requireAdmin, (req, res) => {
  try {
    const jobs = NotificationScheduler.getJobStatus();
    res.json({
      jobs,
      count: jobs.length,
      message: 'Scheduler status retrieved'
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

/**
 * POST /api/admin/scheduler/trigger/:jobName - Manually trigger a job
 */
router.post('/trigger/:jobName', requireAdmin, async (req, res) => {
  try {
    const { jobName } = req.params;

    const validJobs = ['daily-digest', 'weekly-digest', 'delayed-check', 'cleanup'];
    if (!validJobs.includes(jobName)) {
      return res.status(400).json({
        error: 'Invalid job name',
        validJobs
      });
    }

    const result = await NotificationScheduler.triggerJob(jobName);

    res.json({
      message: `Job '${jobName}' triggered successfully`,
      result
    });
  } catch (error) {
    console.error(`Error triggering job ${req.params.jobName}:`, error);
    res.status(500).json({
      error: `Failed to trigger job: ${error.message}`
    });
  }
});

/**
 * GET /api/admin/scheduler/logs - Get notification scheduler logs
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, eventType = null } = req.query;

    let query = `
      SELECT id, user_id, event_type, shipment_id, subject, status, sent_at
      FROM notification_log
      WHERE event_type IN ('daily_digest', 'weekly_digest', 'delayed_shipment_check', 'test_email')
    `;

    const params = [];

    if (eventType) {
      query += ` AND event_type = $${params.length + 1}`;
      params.push(eventType);
    }

    query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      logs: result.rows,
      count: result.rows.length,
      limit
    });
  } catch (error) {
    console.error('Error getting scheduler logs:', error);
    res.status(500).json({ error: 'Failed to get scheduler logs' });
  }
});

/**
 * GET /api/admin/scheduler/stats - Get notification statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Total notifications sent
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM notification_log`
    );

    // Breakdown by event type
    const byTypeResult = await pool.query(
      `SELECT event_type, COUNT(*) as count,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM notification_log
       GROUP BY event_type
       ORDER BY count DESC`
    );

    // Users with notifications enabled
    const usersWithEmailResult = await pool.query(
      `SELECT COUNT(*) as count FROM notification_preferences WHERE email_enabled = true`
    );

    // Users by frequency preference
    const byFrequencyResult = await pool.query(
      `SELECT email_frequency, COUNT(*) as count
       FROM notification_preferences
       WHERE email_enabled = true
       GROUP BY email_frequency`
    );

    // Recent activity (last 7 days)
    const recentResult = await pool.query(
      `SELECT DATE(sent_at) as date, COUNT(*) as count,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM notification_log
       WHERE sent_at > NOW() - INTERVAL '7 days'
       GROUP BY DATE(sent_at)
       ORDER BY date DESC`
    );

    res.json({
      total: {
        total: parseInt(totalResult.rows[0].total),
        sent: parseInt(totalResult.rows[0].sent),
        failed: parseInt(totalResult.rows[0].failed)
      },
      byType: byTypeResult.rows,
      usersWithEmailEnabled: parseInt(usersWithEmailResult.rows[0].count),
      byFrequency: byFrequencyResult.rows,
      last7Days: recentResult.rows
    });
  } catch (error) {
    console.error('Error getting scheduler stats:', error);
    res.status(500).json({ error: 'Failed to get scheduler statistics' });
  }
});

/**
 * POST /api/admin/scheduler/preferences/bulk - Bulk update notification preferences
 */
router.post('/preferences/bulk', requireAdmin, async (req, res) => {
  try {
    const { targetUsers, updates } = req.body;

    if (!targetUsers || !updates) {
      return res.status(400).json({
        error: 'targetUsers and updates required'
      });
    }

    const userList = Array.isArray(targetUsers) ? targetUsers : [targetUsers];

    let updated = 0;

    for (const userId of userList) {
      try {
        await pool.query(
          `INSERT INTO notification_preferences
           (user_id, notify_shipment_arrival, notify_inspection_failed, notify_inspection_passed,
            notify_warehouse_capacity, notify_delayed_shipment, notify_post_arrival_update,
            notify_workflow_assigned, email_enabled, email_frequency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id) DO UPDATE SET
            notify_shipment_arrival = COALESCE($2, notification_preferences.notify_shipment_arrival),
            notify_inspection_failed = COALESCE($3, notification_preferences.notify_inspection_failed),
            notify_inspection_passed = COALESCE($4, notification_preferences.notify_inspection_passed),
            notify_warehouse_capacity = COALESCE($5, notification_preferences.notify_warehouse_capacity),
            notify_delayed_shipment = COALESCE($6, notification_preferences.notify_delayed_shipment),
            notify_post_arrival_update = COALESCE($7, notification_preferences.notify_post_arrival_update),
            notify_workflow_assigned = COALESCE($8, notification_preferences.notify_workflow_assigned),
            email_enabled = COALESCE($9, notification_preferences.email_enabled),
            email_frequency = COALESCE($10, notification_preferences.email_frequency),
            updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            updates.notify_shipment_arrival,
            updates.notify_inspection_failed,
            updates.notify_inspection_passed,
            updates.notify_warehouse_capacity,
            updates.notify_delayed_shipment,
            updates.notify_post_arrival_update,
            updates.notify_workflow_assigned,
            updates.email_enabled,
            updates.email_frequency
          ]
        );
        updated++;
      } catch (err) {
        console.error(`Error updating preferences for user ${userId}:`, err);
      }
    }

    res.json({
      message: `Updated preferences for ${updated}/${userList.length} users`,
      updated,
      total: userList.length
    });
  } catch (error) {
    console.error('Error bulk updating preferences:', error);
    res.status(500).json({ error: 'Failed to bulk update preferences' });
  }
});

export default router;
