import express from 'express';
import pool from '../db/connection.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET all warehouse capacity data
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT warehouse_name, bins_used, updated_by, updated_at FROM warehouse_capacity'
    );

    // Convert to object format { warehouse_name: bins_used }
    const capacityData = {};
    result.rows.forEach(row => {
      capacityData[row.warehouse_name] = row.bins_used;
    });

    res.json(capacityData);
  } catch (error) {
    console.error('Error fetching warehouse capacity:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse capacity data' });
  }
});

// PUT/UPDATE warehouse capacity for a specific warehouse
router.put('/:warehouseName', async (req, res) => {
  try {
    const { warehouseName } = req.params;
    const { binsUsed } = req.body;

    // Try to get user from token, but don't require it
    let userId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const jwt = (await import('jsonwebtoken')).default;
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const user = jwt.verify(token, JWT_SECRET);
        userId = user.id;
      } catch (err) {
        // Token invalid or expired, continue without user
        console.log('Invalid token, proceeding without user tracking');
      }
    }

    if (typeof binsUsed !== 'number' || binsUsed < 0) {
      return res.status(400).json({ error: 'Invalid binsUsed value' });
    }

    // Get previous value for history
    const previousResult = await pool.query(
      'SELECT bins_used FROM warehouse_capacity WHERE warehouse_name = $1',
      [warehouseName]
    );
    const previousValue = previousResult.rows.length > 0 ? previousResult.rows[0].bins_used : null;

    // Upsert: Insert or update if exists
    const result = await pool.query(
      `INSERT INTO warehouse_capacity (warehouse_name, bins_used, updated_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (warehouse_name)
       DO UPDATE SET bins_used = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING warehouse_name, bins_used, updated_by, updated_at`,
      [warehouseName, binsUsed, userId]
    );

    // Add to history if user is logged in
    if (userId) {
      try {
        await pool.query(
          `INSERT INTO warehouse_capacity_history (warehouse_name, bins_used, previous_value, changed_by, changed_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
          [warehouseName, binsUsed, previousValue, userId]
        );
      } catch (historyError) {
        console.error('Error saving to history:', historyError);
        // Continue even if history fails
      }
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating warehouse capacity:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to update warehouse capacity',
      details: error.message
    });
  }
});

// GET history for a specific warehouse
router.get('/:warehouseName/history', authenticateToken, async (req, res) => {
  try {
    const { warehouseName } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(
      `SELECT
        h.id,
        h.warehouse_name,
        h.bins_used,
        h.previous_value,
        h.changed_at,
        u.username,
        u.full_name
       FROM warehouse_capacity_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.warehouse_name = $1
       ORDER BY h.changed_at DESC
       LIMIT $2`,
      [warehouseName, limit]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      warehouseName: row.warehouse_name,
      binsUsed: row.bins_used,
      previousValue: row.previous_value,
      changedAt: row.changed_at,
      changedBy: {
        username: row.username,
        fullName: row.full_name
      }
    })));
  } catch (error) {
    console.error('Error fetching warehouse capacity history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET all history (admin only)
router.get('/history/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 100;

    const result = await pool.query(
      `SELECT
        h.id,
        h.warehouse_name,
        h.bins_used,
        h.previous_value,
        h.changed_at,
        u.username,
        u.full_name
       FROM warehouse_capacity_history h
       LEFT JOIN users u ON h.changed_by = u.id
       ORDER BY h.changed_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      warehouseName: row.warehouse_name,
      binsUsed: row.bins_used,
      previousValue: row.previous_value,
      changedAt: row.changed_at,
      changedBy: {
        username: row.username,
        fullName: row.full_name
      }
    })));
  } catch (error) {
    console.error('Error fetching all warehouse capacity history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
