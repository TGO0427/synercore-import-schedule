import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Connecting to production database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateArchivesTable() {
  try {
    console.log('Creating archives table in production...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS archives (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL UNIQUE,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total_shipments INTEGER NOT NULL DEFAULT 0,
        data JSONB NOT NULL,
        created_by VARCHAR(255),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON archives(archived_at);
      CREATE INDEX IF NOT EXISTS idx_archives_file_name ON archives(file_name);
    `);

    console.log('✓ Archives table created successfully in production');
    console.log('\nNow archives will be stored in the database and persist across deployments!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error creating archives table:', error);
    await pool.end();
    process.exit(1);
  }
}

migrateArchivesTable();
