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
      try {
        // Check if warehouse exists
        const checkResult = await pool.query(
          'SELECT * FROM warehouse_capacity WHERE warehouse_name = $1',
          [warehouse.name]
        );

        if (checkResult.rows.length === 0) {
          // Warehouse doesn't exist, create it
          await pool.query(
            `INSERT INTO warehouse_capacity (warehouse_name, bins_used, available_bins, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [warehouse.name, 0, warehouse.totalBins]
          );
          console.log(`  ✓ Created ${warehouse.name} with ${warehouse.totalBins} available bins`);
        } else {
          // Warehouse exists, update if available_bins is null or 0
          const existing = checkResult.rows[0];
          if (!existing.available_bins || existing.available_bins === 0) {
            await pool.query(
              `UPDATE warehouse_capacity
               SET available_bins = $2, updated_at = CURRENT_TIMESTAMP
               WHERE warehouse_name = $1`,
              [warehouse.name, warehouse.totalBins]
            );
            console.log(`  ✓ Updated ${warehouse.name} available_bins to ${warehouse.totalBins}`);
          } else {
            console.log(`  ✓ ${warehouse.name} already initialized with ${existing.available_bins} available bins`);
          }
        }
      } catch (error) {
        console.error(`  ✗ Error initializing ${warehouse.name}:`, error.message);
      }
    }

    console.log('✓ All three warehouses initialized');

    return true;
  } catch (error) {
    console.error('Error adding available_bins column:', error.message);
    throw error;
  }
};

export default addAvailableBinsColumn;
