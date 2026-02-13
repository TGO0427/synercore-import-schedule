// Migration: Add costing_requests table
import pool from './connection.js';

async function createCostingRequestsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS costing_requests (
        id SERIAL PRIMARY KEY,
        requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_by_username VARCHAR(255) NOT NULL,
        supplier_name VARCHAR(255),
        product_description TEXT,
        priority VARCHAR(20) DEFAULT 'normal',
        notes TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        handled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_costing_requests_status ON costing_requests(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_costing_requests_user ON costing_requests(requested_by);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_costing_requests_created ON costing_requests(created_at);`);

    console.log('✓ Costing requests table migration complete');
  } catch (error) {
    console.error('Error creating costing_requests table:', error.message);
    throw error;
  }
}

export default createCostingRequestsTable;
