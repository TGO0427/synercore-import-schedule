import express from 'express';
import pool from '../db/connection.js';

const router = express.Router();

// GET all warehouse capacity data
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT warehouse_name, bins_used, updated_at FROM warehouse_capacity'
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

    if (typeof binsUsed !== 'number' || binsUsed < 0) {
      return res.status(400).json({ error: 'Invalid binsUsed value' });
    }

    // Upsert: Insert or update if exists
    const result = await pool.query(
      `INSERT INTO warehouse_capacity (warehouse_name, bins_used, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (warehouse_name)
       DO UPDATE SET bins_used = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING warehouse_name, bins_used, updated_at`,
      [warehouseName, binsUsed]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating warehouse capacity:', error);
    res.status(500).json({ error: 'Failed to update warehouse capacity' });
  }
});

export default router;
