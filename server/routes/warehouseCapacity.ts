/**
 * Warehouse Capacity Routes
 * Handles CRUD operations for warehouse capacity data including
 * bins used, available bins, total capacity, and history tracking.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.ts';
import { validateWarehouseCapacity, validateWarehouseCapacityUpdate } from '../middleware/validation.js';

const router = Router();

// NOTE: More specific routes must be defined before less specific ones
// This avoids /:warehouseName matching /history/all or /available-bins

interface CapacityHistoryRow {
  id: number;
  warehouse_name: string;
  bins_used: number;
  previous_value: number;
  changed_at: string;
  username: string;
  full_name: string;
}

interface CapacityRow {
  warehouse_name: string;
  total_capacity: number;
  bins_used: number;
  available_bins: number;
  updated_by: string | null;
  updated_at: string;
}

interface CapacityData {
  totalCapacity: Record<string, number>;
  binsUsed: Record<string, number>;
  availableBins: Record<string, number>;
}

// GET all history (admin only) - MUST be before /:warehouseName
router.get('/history/all', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit: number = parseInt(req.query.limit as string) || 100;

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

    res.json(result.rows.map((row: CapacityHistoryRow) => ({
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
  } catch (error: any) {
    console.error('Error fetching all warehouse capacity history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET all warehouse capacity data
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT warehouse_name, total_capacity, bins_used, available_bins, updated_by, updated_at FROM warehouse_capacity'
    );

    // Convert to object format with total_capacity, bins_used and available_bins
    const capacityData: CapacityData = {
      totalCapacity: {},
      binsUsed: {},
      availableBins: {}
    };
    result.rows.forEach((row: CapacityRow) => {
      capacityData.totalCapacity[row.warehouse_name] = row.total_capacity || 0;
      capacityData.binsUsed[row.warehouse_name] = row.bins_used || 0;
      capacityData.availableBins[row.warehouse_name] = row.available_bins || 0;
    });

    res.json(capacityData);
  } catch (error: any) {
    console.error('Error fetching warehouse capacity:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse capacity data' });
  }
});

// PUT/UPDATE total capacity for a specific warehouse
// MUST be before /:warehouseName to match correctly
router.put('/:warehouseName/total-capacity', validateWarehouseCapacity, (req: Request, res: Response) => {
  // Wrap in explicit error handler
  (async () => {
    try {
      const { warehouseName } = req.params;
      const { totalCapacity } = req.body as { totalCapacity: number };

      if (typeof totalCapacity !== 'number' || totalCapacity < 0) {
        return res.status(400).json({ error: 'Invalid totalCapacity value' });
      }

      // Update or insert total_capacity - ensure bins_used and available_bins are preserved
      const result = await pool.query(
        `INSERT INTO warehouse_capacity (warehouse_name, total_capacity, bins_used, available_bins, updated_at)
         VALUES ($1::text, $2::integer, COALESCE((SELECT bins_used FROM warehouse_capacity WHERE warehouse_name = $1::text), 0), COALESCE((SELECT available_bins FROM warehouse_capacity WHERE warehouse_name = $1::text), 0), CURRENT_TIMESTAMP)
         ON CONFLICT (warehouse_name)
         DO UPDATE SET total_capacity = $2::integer, updated_at = CURRENT_TIMESTAMP
         RETURNING warehouse_name, total_capacity, bins_used, available_bins, updated_at`,
        [warehouseName, totalCapacity]
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(500).json({ error: 'Failed to update: no rows returned' });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating total capacity:', error);
      return res.status(500).json({
        error: 'Failed to update total capacity',
        details: error.message,
        code: error.code
      });
    }
  })().catch((err: any) => {
    console.error('Unhandled error in PUT route:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// PUT/UPDATE available bins for a specific warehouse
// MUST be before /:warehouseName to match correctly
router.put('/:warehouseName/available-bins', validateWarehouseCapacityUpdate, (req: Request, res: Response) => {
  // Wrap in explicit error handler
  (async () => {
    try {
      const { warehouseName } = req.params;
      const { availableBins } = req.body as { availableBins: number };

      if (typeof availableBins !== 'number' || availableBins < 0) {
        return res.status(400).json({ error: 'Invalid availableBins value' });
      }

      // Update or insert available_bins - ensure bins_used is preserved
      // Using $1 for warehouse_name (text) and $2 for availableBins (number)
      const result = await pool.query(
        `INSERT INTO warehouse_capacity (warehouse_name, bins_used, available_bins, updated_at)
         VALUES ($1::text, COALESCE((SELECT bins_used FROM warehouse_capacity WHERE warehouse_name = $1::text), 0), $2::integer, CURRENT_TIMESTAMP)
         ON CONFLICT (warehouse_name)
         DO UPDATE SET available_bins = $2::integer, updated_at = CURRENT_TIMESTAMP
         RETURNING warehouse_name, bins_used, available_bins, updated_at`,
        [warehouseName, availableBins]
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(500).json({ error: 'Failed to update: no rows returned' });
      }

      return res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      console.error('Error updating available bins:', error);
      return res.status(500).json({
        error: 'Failed to update available bins',
        details: error.message,
        code: error.code
      });
    }
  })().catch((err: any) => {
    console.error('Unhandled error in PUT route:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// GET history for a specific warehouse
// MUST be before /:warehouseName to match correctly
router.get('/:warehouseName/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { warehouseName } = req.params;
    const limit: number = parseInt(req.query.limit as string) || 50;

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

    res.json(result.rows.map((row: CapacityHistoryRow) => ({
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
  } catch (error: any) {
    console.error('Error fetching warehouse capacity history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// PUT/UPDATE warehouse capacity for a specific warehouse (bins used)
// MUST be last to avoid conflicting with more specific routes
router.put('/:warehouseName', validateWarehouseCapacityUpdate, async (req: Request, res: Response) => {
  try {
    const { warehouseName } = req.params;
    const { binsUsed } = req.body as { binsUsed: number };

    if (typeof binsUsed !== 'number' || binsUsed < 0) {
      return res.status(400).json({ error: 'Invalid binsUsed value' });
    }

    // Simple update without authentication for now
    const result = await pool.query(
      `INSERT INTO warehouse_capacity (warehouse_name, bins_used, updated_at)
       VALUES ($1::text, $2::integer, CURRENT_TIMESTAMP)
       ON CONFLICT (warehouse_name)
       DO UPDATE SET bins_used = $2::integer, updated_at = CURRENT_TIMESTAMP
       RETURNING warehouse_name, bins_used, available_bins, updated_at`,
      [warehouseName, binsUsed]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update: no rows returned' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating bins used:', error);
    res.status(500).json({
      error: 'Failed to update warehouse capacity',
      details: error.message,
      code: error.code
    });
  }
});

export default router;
