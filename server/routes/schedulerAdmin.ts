/**
 * Scheduler Admin Routes
 * Routes for managing notification scheduler and job execution
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { AppError } from '../utils/AppError.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import NotificationScheduler from '../jobs/notificationScheduler.js';
import db from '../db/connection.ts';
import type { TypedAuthenticatedRequest } from '../types/api.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Middleware to check if user is admin
 */
async function requireAdmin(req: TypedAuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) {
      throw AppError.unauthorized('User not authenticated');
    }

    const userResult = await db.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult[0] || userResult[0].role !== 'admin') {
      throw AppError.forbidden('Admin access required');
    }

    next();
  } catch (error) {
    throw error;
  }
}

/**
 * GET /api/admin/scheduler/status - Get status of all notification jobs
 */
router.get('/status', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const jobs = NotificationScheduler.getJobStatus();
  res.json({
    jobs,
    count: jobs.length,
    message: 'Scheduler status retrieved'
  });
}));

/**
 * POST /api/admin/scheduler/trigger/:jobName - Manually trigger a job
 */
router.post('/trigger/:jobName', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { jobName } = req.params;

  const validJobs = ['daily-digest', 'weekly-digest', 'delayed-check', 'cleanup'];
  if (!validJobs.includes(jobName)) {
    throw AppError.badRequest('Invalid job name', { validJobs });
  }

  const result = await NotificationScheduler.triggerJob(jobName);

  res.json({
    message: `Job '${jobName}' triggered successfully`,
    result
  });
}));

/**
 * GET /api/admin/scheduler/logs - Get notification scheduler logs
 */
router.get('/logs', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit = '50', eventType = null } = req.query;

  let query = `
    SELECT id, user_id, event_type, shipment_id, subject, status, sent_at
    FROM notification_log
    WHERE event_type IN ('daily_digest', 'weekly_digest', 'delayed_shipment_check', 'test_email')
  `;

  const params: any[] = [];

  if (eventType) {
    query += ` AND event_type = $${params.length + 1}`;
    params.push(eventType);
  }

  query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit as string));

  const result = await db.query<any>(query, params);

  res.json({
    logs: result,
    count: result.length,
    limit: parseInt(limit as string)
  });
}));

/**
 * GET /api/admin/scheduler/stats - Get notification statistics
 */
router.get('/stats', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  // Total notifications sent
  const totalResult = await db.query<{
    total: string;
    sent: string;
    failed: string;
  }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM notification_log`
  );

  // Breakdown by event type
  const byTypeResult = await db.query<{
    event_type: string;
    count: string;
    sent: string;
    failed: string;
  }>(
    `SELECT event_type, COUNT(*) as count,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM notification_log
     GROUP BY event_type
     ORDER BY count DESC`
  );

  // Users with notifications enabled
  const usersWithEmailResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notification_preferences WHERE email_enabled = true`
  );

  // Users by frequency preference
  const byFrequencyResult = await db.query<{
    email_frequency: string;
    count: string;
  }>(
    `SELECT email_frequency, COUNT(*) as count
     FROM notification_preferences
     WHERE email_enabled = true
     GROUP BY email_frequency`
  );

  // Recent activity (last 7 days)
  const recentResult = await db.query<{
    date: string;
    count: string;
    sent: string;
    failed: string;
  }>(
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
      total: parseInt(totalResult[0].total),
      sent: parseInt(totalResult[0].sent),
      failed: parseInt(totalResult[0].failed)
    },
    byType: byTypeResult,
    usersWithEmailEnabled: parseInt(usersWithEmailResult[0].count),
    byFrequency: byFrequencyResult,
    last7Days: recentResult
  });
}));

/**
 * POST /api/admin/scheduler/preferences/bulk - Bulk update notification preferences
 */
router.post('/preferences/bulk', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { targetUsers, updates } = req.body as {
    targetUsers?: string | string[];
    updates?: Record<string, any>;
  };

  if (!targetUsers || !updates) {
    throw AppError.badRequest('targetUsers and updates required');
  }

  const userList = Array.isArray(targetUsers) ? targetUsers : [targetUsers];
  let updated = 0;

  for (const userId of userList) {
    try {
      await db.query(
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
}));

export default router;
