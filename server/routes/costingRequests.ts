/**
 * Costing Requests Routes
 * API endpoints for non-admin users to request costings and for admins to manage them
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../middleware/auth.ts';
import pool from '../db/connection.js';

const router = Router();

// Helper: wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Helper: validate request
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

// ==================== COSTING REQUEST ROUTES ====================

/**
 * POST /api/costing-requests
 * Any authenticated user can submit a costing request
 */
router.post(
  '/',
  authenticateToken,
  [
    body('supplier_name').optional({ nullable: true }).trim(),
    body('product_description').optional({ nullable: true }).trim(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('notes').optional({ nullable: true }).trim(),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { supplier_name, product_description, priority = 'normal', notes } = req.body;
    const userId = req.user!.id;
    const username = req.user!.username;

    const result = await pool.query(
      `INSERT INTO costing_requests (requested_by, requested_by_username, supplier_name, product_description, priority, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, username, supplier_name || null, product_description || null, priority, notes || null]
    );

    res.status(201).json({ data: result.rows[0] });
  })
);

/**
 * GET /api/costing-requests
 * Admin: get all requests (with optional status filter)
 * Non-admin: get only own requests
 */
router.get(
  '/',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'in_progress', 'completed', 'dismissed']),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.role === 'admin';
    const statusFilter = req.query.status as string | undefined;

    let queryText = 'SELECT * FROM costing_requests';
    const params: any[] = [];
    const conditions: string[] = [];

    if (!isAdmin) {
      conditions.push(`requested_by = $${params.length + 1}`);
      params.push(req.user!.id);
    }

    if (statusFilter) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(statusFilter);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({ data: result.rows });
  })
);

/**
 * GET /api/costing-requests/count
 * Admin only: get count of pending requests (for notification badge)
 */
router.get(
  '/count',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM costing_requests WHERE status = 'pending'`
    );
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  })
);

/**
 * PUT /api/costing-requests/:id
 * Admin only: update request status and add notes
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isInt(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'dismissed']),
    body('admin_notes').optional({ nullable: true }).trim(),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    if (admin_notes !== undefined) {
      params.push(admin_notes);
      updates.push(`admin_notes = $${params.length}`);
    }

    params.push(req.user!.id);
    updates.push(`handled_by = $${params.length}`);

    updates.push('updated_at = CURRENT_TIMESTAMP');

    params.push(id);
    const result = await pool.query(
      `UPDATE costing_requests SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ data: result.rows[0] });
  })
);

/**
 * DELETE /api/costing-requests/:id
 * Admin only: delete a request
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isInt()],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM costing_requests WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted' });
  })
);

export default router;
