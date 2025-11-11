/**
 * Migration: Add available_bins column to warehouse_capacity table
 * This allows tracking available bins separately from bins in use
 */

import pool from './connection.js';

const addAvailableBinsColumn = async () => {
  try {
    console.log('Checking if available_bins column exists...');

    // Check if column exists
    const checkResult = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='warehouse_capacity' AND column_name='available_bins'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✓ available_bins column already exists');
      return true;
    }

    console.log('Adding available_bins column to warehouse_capacity table...');

    // Add the column with a default value based on warehouse capacity
    await pool.query(
      `ALTER TABLE warehouse_capacity
       ADD COLUMN available_bins INTEGER DEFAULT 0`
    );

    console.log('✓ Successfully added available_bins column');

    // Ensure all three warehouses are initialized in the table
    const warehouses = [
      { name: 'PRETORIA', totalBins: 650 },
      { name: 'KLAPMUTS', totalBins: 384 },
      { name: 'Offsite', totalBins: 384 }
    ];

    for (const warehouse of warehouses) {
      await pool.query(
        `INSERT INTO warehouse_capacity (warehouse_name, bins_used, available_bins, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (warehouse_name) DO UPDATE SET
           available_bins = COALESCE(warehouse_capacity.available_bins, $3),
           updated_at = CURRENT_TIMESTAMP
         WHERE warehouse_capacity.available_bins IS NULL OR warehouse_capacity.available_bins = 0`,
        [warehouse.name, 0, warehouse.totalBins]
      );
    }

    console.log('✓ Initialized all three warehouses with available_bins values');

    return true;
  } catch (error) {
    console.error('Error adding available_bins column:', error.message);
    throw error;
  }
};

export default addAvailableBinsColumn;
