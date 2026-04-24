/**
 * Migration: Create customers table for Export Costing
 * Mirrors the suppliers table shape, but used for export estimates.
 */

import { query } from './connection.js';

export default async function addCustomersTable() {
  const tableCheck = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_name='customers'`
  );

  if (tableCheck.rows.length === 0) {
    await query(`
      CREATE TABLE customers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        country VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
    // eslint-disable-next-line no-console
    console.log('  ✓ Created customers table');
  }
}
