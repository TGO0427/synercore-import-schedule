import pool from './connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function addArchivesTable() {
  try {
    console.log('Creating archives table...');

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

    console.log('✓ Archives table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating archives table:', error);
    process.exit(1);
  }
}

addArchivesTable();
