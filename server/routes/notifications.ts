/**
 * Notification Routes
 * Handles user notification preferences and notification history
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.ts';
import { AppError } from '../utils/AppError.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import EmailService from '../services/emailService.ts';
import db from '../db/connection.ts';
import type { TypedAuthenticatedRequest } from '../types/api.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/notifications/preferences - Get user's notification preferences
 */
router.get('/preferences', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const prefs = await EmailService.getPreferences(req.user.id);
  res.json(prefs);
}));

/**
 * PUT /api/notifications/preferences - Update user's notification preferences
 */
router.put('/preferences', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const preferences = req.body;
  const updated = await EmailService.updatePreferences(req.user.id, preferences);

  res.json({
    message: 'Notification preferences updated successfully',
    preferences: updated
  });
}));

/**
 * GET /api/notifications/history - Get notification log for user
 */
router.get('/history', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const { limit = '50', offset = '0', eventType = null } = req.query;

  let query = 'SELECT * FROM notification_log WHERE user_id = $1';
  const params: any[] = [req.user.id];

  if (eventType) {
    query += ' AND event_type = $2';
    params.push(eventType);
  }

  query += ' ORDER BY sent_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(parseInt(limit as string), parseInt(offset as string));

  const result = await db.query<any>(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM notification_log WHERE user_id = $1';
  if (eventType) {
    countQuery += ' AND event_type = $2';
  }

  const countResult = await db.query<{ count: string }>(
    countQuery,
    eventType ? [req.user.id, eventType] : [req.user.id]
  );
  const total = parseInt(countResult[0].count);

  res.json({
    notifications: result,
    total,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });
}));

/**
 * GET /api/notifications/history/:id - Get specific notification
 */
router.get('/history/:id', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const result = await db.query<any>(
    'SELECT * FROM notification_log WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (result.length === 0) {
    throw AppError.notFound('Notification not found');
  }

  res.json(result[0]);
}));

/**
 * DELETE /api/notifications/history/:id - Delete notification
 */
router.delete('/history/:id', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const result = await db.query<{ id: string }>(
    'DELETE FROM notification_log WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );

  if (result.length === 0) {
    throw AppError.notFound('Notification not found');
  }

  res.json({ message: 'Notification deleted successfully' });
}));

/**
 * POST /api/notifications/test - Send test email
 */
router.post('/test', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  const prefs = await EmailService.getPreferences(req.user.id);
  const emailAddress = prefs.email_address || (await EmailService.getUserEmail(req.user.id));

  if (!emailAddress) {
    throw AppError.badRequest('No email address configured');
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
    throw AppError.internalError('Failed to send test email', { details: result.error });
  }
}));

/**
 * GET /api/notifications/stats - Get notification statistics
 */
router.get('/stats', asyncHandler(async (req: TypedAuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    throw AppError.unauthorized('User not authenticated');
  }

  // Count by event type
  const typeResult = await db.query<{
    event_type: string;
    count: string;
    sent: string;
    failed: string;
  }>(
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
  const totalResult = await db.query<{
    total: string;
    sent: string;
    failed: string;
  }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM notification_log
     WHERE user_id = $1`,
    [req.user.id]
  );

  res.json({
    total: parseInt(totalResult[0].total),
    sent: parseInt(totalResult[0].sent),
    failed: parseInt(totalResult[0].failed),
    byType: typeResult
  });
}));

export default router;
