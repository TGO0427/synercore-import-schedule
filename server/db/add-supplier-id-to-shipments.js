// Migration: Add supplier_id column to shipments table
import pool from './connection.js';

async function addSupplierIdToShipments() {
  try {
    // Add supplier_id column to shipments table if it doesn't exist
    await pool.query(`
      ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL
    `);

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_supplier_id ON shipments(supplier_id)
    `);

    console.log('✅ supplier_id column added to shipments table successfully');
  } catch (error) {
    console.error('❌ Error adding supplier_id column to shipments:', error.message);
    throw error;
  }
}

// Export for use in server startup
export default addSupplierIdToShipments;

// If run directly, execute immediately
if (import.meta.url === `file://${process.argv[1]}`) {
  addSupplierIdToShipments().catch(err => {
    process.exit(1);
  });
}
