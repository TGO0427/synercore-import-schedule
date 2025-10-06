import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './connection.js';

// Disable SSL certificate validation for Railway Postgres
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addRejectionFields() {
  try {
    console.log('🔄 Adding rejection fields to shipments table...');

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
      console.log('⚠️  DATABASE_URL/PGHOST not set, skipping migration');
      process.exit(0);
      return;
    }

    // Test database connection
    try {
      await db.query('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }

    // Read and execute migration SQL
    const migrationSQL = await fs.readFile(
      path.join(__dirname, 'add-rejection-fields.sql'),
      'utf8'
    );

    await db.query(migrationSQL);
    console.log('✅ Rejection fields migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addRejectionFields();
