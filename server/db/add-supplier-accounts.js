// Migration: Add supplier accounts and documents tables for supplier portal
import pool from './connection.js';

async function createSupplierPortalTables() {
  try {
    // Add supplier_accounts table for supplier self-service login
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_accounts (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP WITH TIME ZONE,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `);

    // Add supplier_documents table for uploading POD, delivery proof, etc.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_documents (
        id SERIAL PRIMARY KEY,
        shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL, -- 'POD', 'delivery_proof', 'customs', 'other'
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by TEXT NOT NULL, -- supplier_id
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        is_verified BOOLEAN DEFAULT false,
        verified_by TEXT, -- admin user who verified
        verified_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // Add column to suppliers table for portal enablement
    await pool.query(`
      ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT true
    `);

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_supplier_accounts_email ON supplier_accounts(email);
      CREATE INDEX IF NOT EXISTS idx_supplier_accounts_supplier_id ON supplier_accounts(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_documents_shipment ON supplier_documents(shipment_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_documents_type ON supplier_documents(document_type);
    `);

    console.log('✅ Supplier portal tables created successfully');
  } catch (error) {
    console.error('❌ Error creating supplier portal tables:', error.message);
    throw error;
  }
}

// Export for use in server startup
export default createSupplierPortalTables;

// If run directly, execute immediately
if (import.meta.url === `file://${process.argv[1]}`) {
  createSupplierPortalTables().catch(err => {
    process.exit(1);
  });
}
