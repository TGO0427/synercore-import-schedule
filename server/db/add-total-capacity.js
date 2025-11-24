/**
 * Migration: Add total_capacity column to warehouse_capacity table
 * This allows tracking and editing the total capacity for each warehouse
 */

import pool from './connection.js';

const addTotalCapacityColumn = async () => {
  try {
    console.log('Checking if total_capacity column exists...');

    // Check if column exists
    const checkResult = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='warehouse_capacity' AND column_name='total_capacity'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✓ total_capacity column already exists');
      return true;
    }

    console.log('Adding total_capacity column to warehouse_capacity table...');

    // Add the column with a default value
    await pool.query(
      `ALTER TABLE warehouse_capacity
       ADD COLUMN total_capacity INTEGER DEFAULT 0`
    );

    console.log('✓ Successfully added total_capacity column');

    // Ensure all three warehouses have total_capacity set correctly
    const warehouses = [
      { name: 'PRETORIA', totalCapacity: 650 },
      { name: 'KLAPMUTS', totalCapacity: 384 },
      { name: 'Offsite', totalCapacity: 384 }
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
            `INSERT INTO warehouse_capacity (warehouse_name, total_capacity, bins_used, available_bins, updated_at)
             VALUES ($1, $2, 0, $2, CURRENT_TIMESTAMP)`,
            [warehouse.name, warehouse.totalCapacity]
          );
          console.log(`  ✓ Created ${warehouse.name} with total_capacity ${warehouse.totalCapacity}`);
        } else {
          // Warehouse exists, update if total_capacity is 0 or null
          const existing = checkResult.rows[0];
          if (!existing.total_capacity || existing.total_capacity === 0) {
            await pool.query(
              `UPDATE warehouse_capacity
               SET total_capacity = $2, updated_at = CURRENT_TIMESTAMP
               WHERE warehouse_name = $1`,
              [warehouse.name, warehouse.totalCapacity]
            );
            console.log(`  ✓ Updated ${warehouse.name} total_capacity to ${warehouse.totalCapacity}`);
          } else {
            console.log(`  ✓ ${warehouse.name} already has total_capacity ${existing.total_capacity}`);
          }
        }
      } catch (error) {
        console.error(`  ✗ Error initializing ${warehouse.name}:`, error.message);
      }
    }

    console.log('✓ All warehouses initialized with total_capacity');

    return true;
  } catch (error) {
    console.error('Error adding total_capacity column:', error.message);
    throw error;
  }
};

export default addTotalCapacityColumn;
