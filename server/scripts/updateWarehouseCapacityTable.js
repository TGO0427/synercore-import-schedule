import pool from '../db/connection.js';

async function updateWarehouseCapacityTable() {
  try {
    console.log('🔄 Updating warehouse_capacity table...');

    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not set, skipping update');
      process.exit(0);
    }

    // Test database connection
    try {
      await pool.query('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }

    // Check if warehouse_capacity table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'warehouse_capacity'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📦 Creating warehouse_capacity table...');
      await pool.query(`
        CREATE TABLE warehouse_capacity (
          warehouse_name VARCHAR(255) PRIMARY KEY,
          bins_used INTEGER NOT NULL DEFAULT 0,
          updated_by VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ warehouse_capacity table created');
    } else {
      console.log('✓ warehouse_capacity table exists');

      // Check if updated_by column exists
      const columnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'warehouse_capacity' AND column_name = 'updated_by';
      `);

      if (columnCheck.rows.length === 0) {
        console.log('📝 Adding updated_by column...');
        await pool.query(`
          ALTER TABLE warehouse_capacity
          ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);
        `);
        console.log('✓ updated_by column added');
      } else {
        console.log('✓ updated_by column already exists');
      }
    }

    // Check if users table exists
    const usersCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      );
    `);

    if (!usersCheck.rows[0].exists) {
      console.log('📦 Creating users table...');
      await pool.query(`
        CREATE TABLE users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_users_username ON users(username);
      `);
      console.log('✓ users table created');
    } else {
      console.log('✓ users table exists');
    }

    // Check if warehouse_capacity_history table exists
    const historyCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'warehouse_capacity_history'
      );
    `);

    if (!historyCheck.rows[0].exists) {
      console.log('📦 Creating warehouse_capacity_history table...');
      await pool.query(`
        CREATE TABLE warehouse_capacity_history (
          id SERIAL PRIMARY KEY,
          warehouse_name VARCHAR(255) NOT NULL,
          bins_used INTEGER NOT NULL,
          previous_value INTEGER,
          changed_by VARCHAR(255),
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_warehouse_capacity_history_warehouse ON warehouse_capacity_history(warehouse_name);
        CREATE INDEX idx_warehouse_capacity_history_date ON warehouse_capacity_history(changed_at);
      `);
      console.log('✓ warehouse_capacity_history table created');
    } else {
      console.log('✓ warehouse_capacity_history table exists');
    }

    console.log('✅ Database update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

updateWarehouseCapacityTable();
