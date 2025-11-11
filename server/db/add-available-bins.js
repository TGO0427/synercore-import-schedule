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

    // Initialize available_bins for existing warehouses
    // PRETORIA: 650 total, KLAPMUTS: 384 total, Offsite: 384 total
    await pool.query(
      `UPDATE warehouse_capacity
       SET available_bins = CASE
         WHEN warehouse_name = 'PRETORIA' THEN 650 - COALESCE(bins_used, 0)
         WHEN warehouse_name = 'KLAPMUTS' THEN 384 - COALESCE(bins_used, 0)
         WHEN warehouse_name = 'Offsite' THEN 384 - COALESCE(bins_used, 0)
         ELSE 0
       END
       WHERE available_bins = 0`
    );

    console.log('✓ Initialized available_bins values for existing warehouses');

    return true;
  } catch (error) {
    console.error('Error adding available_bins column:', error.message);
    throw error;
  }
};

export default addAvailableBinsColumn;
