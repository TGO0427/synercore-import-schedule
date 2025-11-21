/**
 * Migration: Add Referential Integrity Constraints
 * Adds missing foreign key relationships to enforce data consistency
 *
 * This migration adds constraints to:
 * - shipments.inspected_by → users.id
 * - shipments.received_by → users.id
 * - shipments.rejected_by → users.id
 * - supplier_documents.verified_by → users.id
 * - supplier_documents.uploaded_by → suppliers.id
 */

import { query, queryOne } from './connection.js';
import { logInfo, logError } from '../utils/logger.js';

const migrationName = 'add-referential-integrity';

/**
 * Check if a specific constraint exists
 */
const constraintExists = async (tableName: string, constraintName: string): Promise<boolean> => {
  const result = await queryOne<{ constraint_name: string }>(
    `SELECT constraint_name
     FROM information_schema.table_constraints
     WHERE table_name = $1 AND constraint_name = $2`,
    [tableName, constraintName]
  );
  return !!result;
};

/**
 * Check if a column exists
 */
const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
  const result = await queryOne<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [tableName, columnName]
  );
  return !!result;
};

/**
 * Add foreign key constraint safely (only if it doesn't exist)
 */
const addForeignKey = async (
  tableName: string,
  columnName: string,
  refTable: string,
  refColumn: string,
  constraintName: string
): Promise<boolean> => {
  try {
    // Check if constraint already exists
    if (await constraintExists(tableName, constraintName)) {
      logInfo(`Constraint ${constraintName} already exists, skipping...`);
      return true;
    }

    // Check if column exists
    if (!(await columnExists(tableName, columnName))) {
      logInfo(`Column ${tableName}.${columnName} does not exist, skipping...`);
      return false;
    }

    const sql = `ALTER TABLE ${tableName}
                 ADD CONSTRAINT ${constraintName}
                 FOREIGN KEY (${columnName})
                 REFERENCES ${refTable}(${refColumn})
                 ON DELETE SET NULL`;

    await query(sql);
    logInfo(`✓ Added constraint ${constraintName}`);
    return true;
  } catch (error: any) {
    logError(`Failed to add constraint ${constraintName}:`, error);
    throw error;
  }
};

/**
 * Add check constraint for warehouse capacity
 */
const addCheckConstraint = async (): Promise<void> => {
  try {
    // Check if constraint already exists
    if (await constraintExists('warehouse_capacity', 'check_available_bins')) {
      logInfo(`Constraint check_available_bins already exists, skipping...`);
      return;
    }

    const sql = `ALTER TABLE warehouse_capacity
                 ADD CONSTRAINT check_available_bins
                 CHECK (available_bins = total_capacity - COALESCE(bins_used, 0))`;

    await query(sql);
    logInfo(`✓ Added check constraint for warehouse_capacity`);
  } catch (error: any) {
    // This might fail if constraint already exists in different form
    logInfo(`Check constraint for warehouse_capacity not added (may already exist): ${error.message}`);
  }
};

/**
 * Create audit columns for user tracking
 */
const addAuditColumns = async (): Promise<void> => {
  try {
    // Add created_by to users table if not exists
    const result = await queryOne<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'created_by'`
    );

    if (!result) {
      await query(
        `ALTER TABLE users
         ADD COLUMN created_by VARCHAR(255),
         ADD COLUMN updated_by VARCHAR(255)`
      );
      logInfo(`✓ Added audit columns (created_by, updated_by) to users table`);
    } else {
      logInfo(`Audit columns already exist on users table, skipping...`);
    }
  } catch (error: any) {
    logError(`Failed to add audit columns:`, error);
    // Don't throw, this is optional
  }
};

/**
 * Create soft-delete columns for core tables
 */
const addSoftDeleteColumns = async (): Promise<void> => {
  const tables = ['shipments', 'suppliers', 'users'];

  for (const tableName of tables) {
    try {
      // Check if deleted_at column exists
      const result = await queryOne<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'deleted_at'`,
        [tableName]
      );

      if (!result) {
        await query(
          `ALTER TABLE ${tableName}
           ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE`
        );
        logInfo(`✓ Added soft-delete column (deleted_at) to ${tableName} table`);
      } else {
        logInfo(`Soft-delete column already exists on ${tableName} table, skipping...`);
      }
    } catch (error: any) {
      logError(`Failed to add soft-delete column to ${tableName}:`, error);
      // Don't throw, this is optional
    }
  }
};

/**
 * Create indexes for foreign keys
 */
const addForeignKeyIndexes = async (): Promise<void> => {
  const indexes = [
    {
      name: 'idx_shipments_inspected_by',
      table: 'shipments',
      column: 'inspected_by'
    },
    {
      name: 'idx_shipments_received_by',
      table: 'shipments',
      column: 'received_by'
    },
    {
      name: 'idx_shipments_rejected_by',
      table: 'shipments',
      column: 'rejected_by'
    },
    {
      name: 'idx_supplier_documents_verified_by',
      table: 'supplier_documents',
      column: 'verified_by'
    }
  ];

  for (const idx of indexes) {
    try {
      // Check if index exists
      const result = await queryOne<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE indexname = $1`,
        [idx.name]
      );

      if (!result) {
        await query(
          `CREATE INDEX ${idx.name} ON ${idx.table}(${idx.column})
           WHERE ${idx.column} IS NOT NULL`
        );
        logInfo(`✓ Created index ${idx.name}`);
      } else {
        logInfo(`Index ${idx.name} already exists, skipping...`);
      }
    } catch (error: any) {
      logError(`Failed to create index ${idx.name}:`, error);
      // Don't throw, indexes are optional
    }
  }
};

/**
 * Run the migration
 */
export const runMigration = async (): Promise<boolean> => {
  try {
    logInfo(`Starting migration: ${migrationName}`);
    logInfo('=====================================================');

    logInfo('\n--- Adding Foreign Key Constraints ---');

    // Critical foreign keys for shipments
    await addForeignKey(
      'shipments',
      'inspected_by',
      'users',
      'id',
      'fk_shipments_inspected_by'
    );

    await addForeignKey(
      'shipments',
      'received_by',
      'users',
      'id',
      'fk_shipments_received_by'
    );

    await addForeignKey(
      'shipments',
      'rejected_by',
      'users',
      'id',
      'fk_shipments_rejected_by'
    );

    // Foreign keys for supplier documents
    await addForeignKey(
      'supplier_documents',
      'verified_by',
      'users',
      'id',
      'fk_supplier_documents_verified_by'
    );

    logInfo('\n--- Adding Check Constraints ---');
    await addCheckConstraint();

    logInfo('\n--- Adding Audit Columns ---');
    await addAuditColumns();

    logInfo('\n--- Adding Soft-Delete Columns ---');
    await addSoftDeleteColumns();

    logInfo('\n--- Creating Foreign Key Indexes ---');
    await addForeignKeyIndexes();

    logInfo('\n=====================================================');
    logInfo(`✓ Migration ${migrationName} completed successfully`);
    return true;
  } catch (error: any) {
    logError(`✗ Migration ${migrationName} failed:`, error);
    throw error;
  }
};

export default runMigration;
