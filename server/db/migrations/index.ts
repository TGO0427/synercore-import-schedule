/**
 * Database Migrations Registry
 *
 * Central registry for all database migrations with dependency tracking,
 * status management, and ordered execution.
 *
 * Migration Sequence:
 * 1. Schema creation (schema.sql)
 * 2. Performance indexes
 * 3. Column additions (available_bins, total_capacity, password reset columns)
 * 4. Table creations (notifications, refresh tokens, supplier portal)
 * 5. Referential integrity constraints
 * 6. Data migrations (backfill dates, supplier name fixes)
 * 7. Data loading (JSON data import)
 */

import pool from '../connection.js';
import { logInfo, logError } from '../../utils/logger.js';

export enum MigrationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface Migration {
  name: string;
  version: string;
  description: string;
  depends_on: string[];
  execute: () => Promise<boolean>;
  rollback?: () => Promise<boolean>;
}

/**
 * Migration registry with dependency information
 */
export const migrations: Migration[] = [
  // Phase 1: Performance & Indexing
  {
    name: 'add-performance-indexes',
    version: '001',
    description: 'Add performance indexes to shipments table',
    depends_on: ['schema.sql'],
    execute: async () => {
      const performanceIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_shipments_warehouse ON shipments(receiving_warehouse)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_status_week ON shipments(latest_status, week_number)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_status_warehouse ON shipments(latest_status, receiving_warehouse)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_order_ref ON shipments(order_ref)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_inspection_status ON shipments(inspection_status)',
        'CREATE INDEX IF NOT EXISTS idx_shipments_receiving_status ON shipments(receiving_status)',
      ];

      for (const indexQuery of performanceIndexes) {
        try {
          await pool.query(indexQuery);
        } catch (error: any) {
          if (!error.message?.includes('already exists')) {
            logError('Failed to create index', error);
            throw error;
          }
        }
      }
      return true;
    },
  },

  // Phase 2: Column Additions
  {
    name: 'add-available-bins',
    version: '002',
    description: 'Add available_bins column to warehouse_capacity table',
    depends_on: ['schema.sql'],
    execute: async () => {
      // Check if column exists
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='warehouse_capacity' AND column_name='available_bins'`
      );

      if (checkResult.rows.length > 0) {
        logInfo('available_bins column already exists');
        return true;
      }

      // Add the column
      await pool.query(
        `ALTER TABLE warehouse_capacity ADD COLUMN available_bins INTEGER DEFAULT 0`
      );

      // Initialize warehouses
      const warehouses = [
        { name: 'PRETORIA', bins: 650 },
        { name: 'KLAPMUTS', bins: 384 },
        { name: 'Offsite', bins: 384 },
      ];

      for (const warehouse of warehouses) {
        const checkResult = await pool.query(
          'SELECT * FROM warehouse_capacity WHERE warehouse_name = $1',
          [warehouse.name]
        );

        if (checkResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO warehouse_capacity (warehouse_name, bins_used, available_bins, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [warehouse.name, 0, warehouse.bins]
          );
        } else {
          const existing = checkResult.rows[0];
          if (!existing.available_bins || existing.available_bins === 0) {
            await pool.query(
              `UPDATE warehouse_capacity
               SET available_bins = $2, updated_at = CURRENT_TIMESTAMP
               WHERE warehouse_name = $1`,
              [warehouse.name, warehouse.bins]
            );
          }
        }
      }
      return true;
    },
  },

  {
    name: 'add-total-capacity',
    version: '003',
    description: 'Add total_capacity column to warehouse_capacity table',
    depends_on: ['schema.sql'],
    execute: async () => {
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='warehouse_capacity' AND column_name='total_capacity'`
      );

      if (checkResult.rows.length > 0) {
        logInfo('total_capacity column already exists');
        return true;
      }

      await pool.query(
        `ALTER TABLE warehouse_capacity ADD COLUMN total_capacity INTEGER DEFAULT 0`
      );

      const warehouses = [
        { name: 'PRETORIA', capacity: 650 },
        { name: 'KLAPMUTS', capacity: 384 },
        { name: 'Offsite', capacity: 384 },
      ];

      for (const warehouse of warehouses) {
        const checkResult = await pool.query(
          'SELECT * FROM warehouse_capacity WHERE warehouse_name = $1',
          [warehouse.name]
        );

        if (checkResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO warehouse_capacity (warehouse_name, total_capacity, bins_used, available_bins, updated_at)
             VALUES ($1, $2, 0, $2, CURRENT_TIMESTAMP)`,
            [warehouse.name, warehouse.capacity]
          );
        } else {
          const existing = checkResult.rows[0];
          if (!existing.total_capacity || existing.total_capacity === 0) {
            await pool.query(
              `UPDATE warehouse_capacity
               SET total_capacity = $2, updated_at = CURRENT_TIMESTAMP
               WHERE warehouse_name = $1`,
              [warehouse.name, warehouse.capacity]
            );
          }
        }
      }
      return true;
    },
  },

  {
    name: 'add-password-reset',
    version: '004',
    description: 'Add password reset token columns to users table',
    depends_on: ['schema.sql'],
    execute: async () => {
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='users' AND column_name='reset_token'`
      );

      if (checkResult.rows.length > 0) {
        logInfo('Password reset columns already exist');
        return true;
      }

      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)
        WHERE reset_token IS NOT NULL;
      `);

      return true;
    },
  },

  // Phase 3: Table Creations
  {
    name: 'add-notifications-tables',
    version: '005',
    description: 'Create notification preferences, logs, and digest queue tables',
    depends_on: ['schema.sql'],
    execute: async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          notify_shipment_arrival BOOLEAN DEFAULT true,
          notify_inspection_failed BOOLEAN DEFAULT true,
          notify_inspection_passed BOOLEAN DEFAULT true,
          notify_warehouse_capacity BOOLEAN DEFAULT true,
          notify_delayed_shipment BOOLEAN DEFAULT true,
          notify_post_arrival_update BOOLEAN DEFAULT true,
          notify_workflow_assigned BOOLEAN DEFAULT true,
          email_enabled BOOLEAN DEFAULT true,
          email_frequency VARCHAR(50) DEFAULT 'immediate',
          email_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_log (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type VARCHAR(100) NOT NULL,
          shipment_id TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'sent',
          delivery_method VARCHAR(50) DEFAULT 'email',
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT,
          FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_digest_queue (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type VARCHAR(100) NOT NULL,
          shipment_id TEXT,
          event_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP WITH TIME ZONE,
          FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
        CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(sent_at);
        CREATE INDEX IF NOT EXISTS idx_notification_log_event ON notification_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_digest_queue_user ON notification_digest_queue(user_id);
        CREATE INDEX IF NOT EXISTS idx_digest_queue_processed ON notification_digest_queue(processed_at);
      `);

      return true;
    },
  },

  {
    name: 'add-refresh-tokens-table',
    version: '006',
    description: 'Create refresh_tokens table for JWT token refresh mechanism',
    depends_on: ['schema.sql'],
    execute: async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          revoked_at TIMESTAMP WITH TIME ZONE,
          ip_address VARCHAR(45),
          user_agent TEXT,
          CONSTRAINT no_revoked_tokens CHECK (revoked_at IS NULL)
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
      `);

      return true;
    },
  },

  {
    name: 'add-supplier-accounts',
    version: '007',
    description: 'Create supplier portal tables (accounts and documents)',
    depends_on: ['schema.sql'],
    execute: async () => {
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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS supplier_documents (
          id SERIAL PRIMARY KEY,
          shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          document_type VARCHAR(50) NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          mime_type VARCHAR(100),
          uploaded_by TEXT NOT NULL,
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          is_verified BOOLEAN DEFAULT false,
          verified_by TEXT,
          verified_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // Add column to suppliers table for portal enablement
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='suppliers' AND column_name='portal_enabled'`
      );

      if (checkResult.rows.length === 0) {
        await pool.query(
          `ALTER TABLE suppliers ADD COLUMN portal_enabled BOOLEAN DEFAULT true`
        );
      }

      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_accounts_email ON supplier_accounts(email);
        CREATE INDEX IF NOT EXISTS idx_supplier_accounts_supplier_id ON supplier_accounts(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_documents_shipment ON supplier_documents(shipment_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_documents_type ON supplier_documents(document_type);
      `);

      return true;
    },
  },

  {
    name: 'add-archives-table',
    version: '008',
    description: 'Create archives table for storing archived shipments',
    depends_on: ['schema.sql'],
    execute: async () => {
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
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON archives(archived_at);
        CREATE INDEX IF NOT EXISTS idx_archives_file_name ON archives(file_name);
      `);

      return true;
    },
  },

  // Phase 4: Referential Integrity & Constraints
  {
    name: 'add-referential-integrity',
    version: '009',
    description: 'Add foreign key constraints, soft-delete and audit columns',
    depends_on: ['schema.sql', 'add-notifications-tables', 'add-supplier-accounts'],
    execute: async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Helper to check and add constraints
        const addForeignKey = async (
          tableName: string,
          columnName: string,
          refTable: string,
          refColumn: string,
          constraintName: string
        ) => {
          const checkResult = await client.query(
            `SELECT constraint_name FROM information_schema.table_constraints
             WHERE table_name = $1 AND constraint_name = $2`,
            [tableName, constraintName]
          );

          if (checkResult.rows.length === 0) {
            const colCheck = await client.query(
              `SELECT column_name FROM information_schema.columns
               WHERE table_name = $1 AND column_name = $2`,
              [tableName, columnName]
            );

            if (colCheck.rows.length > 0) {
              await client.query(`
                ALTER TABLE ${tableName}
                ADD CONSTRAINT ${constraintName}
                FOREIGN KEY (${columnName})
                REFERENCES ${refTable}(${refColumn})
                ON DELETE SET NULL
              `);
            }
          }
        };

        // Add foreign key constraints
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

        await addForeignKey(
          'supplier_documents',
          'verified_by',
          'users',
          'id',
          'fk_supplier_documents_verified_by'
        );

        // Add soft-delete columns
        const tables = ['shipments', 'suppliers', 'users'];
        for (const tableName of tables) {
          const checkResult = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name = $1 AND column_name = 'deleted_at'`,
            [tableName]
          );

          if (checkResult.rows.length === 0) {
            await client.query(
              `ALTER TABLE ${tableName}
               ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE`
            );
          }
        }

        // Add audit columns to users table
        const auditCheck = await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'users' AND column_name = 'created_by'`
        );

        if (auditCheck.rows.length === 0) {
          await client.query(
            `ALTER TABLE users
             ADD COLUMN created_by VARCHAR(255),
             ADD COLUMN updated_by VARCHAR(255)`
          );
        }

        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  },

  // Phase 5: Data Migrations
  {
    name: 'backfill-week-dates',
    version: '010',
    description: 'Backfill selected_week_date from week_number',
    depends_on: ['schema.sql'],
    execute: async () => {
      // Get week start date for a given week number
      const getWeekStartDate = (weekNumber: number, year: number) => {
        const jan4 = new Date(year, 0, 4);
        const week1Monday = new Date(jan4);
        week1Monday.setDate(jan4.getDate() - jan4.getDay() + 1);
        const weekStart = new Date(week1Monday);
        weekStart.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
        return weekStart;
      };

      // Get current ISO week number
      const getWeekNumber = (date: Date) => {
        const d = new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        );
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      };

      const calculateWeekDate = (weekNumber: number) => {
        if (!weekNumber || weekNumber < 1 || weekNumber > 53) return null;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentWeek = getWeekNumber(now);
        const currentMonth = now.getMonth();

        let targetYear = currentYear;
        if (currentMonth === 11 && weekNumber <= 10) {
          targetYear = currentYear + 1;
        } else if (currentMonth === 0 && weekNumber >= 45) {
          targetYear = currentYear - 1;
        } else if (weekNumber < currentWeek - 20) {
          targetYear = currentYear + 1;
        } else if (weekNumber > currentWeek + 20) {
          targetYear = currentYear - 1;
        }

        const weekStartDate = getWeekStartDate(weekNumber, targetYear);
        return weekStartDate.toISOString().split('T')[0];
      };

      const result = await pool.query(
        'SELECT id, week_number FROM shipments WHERE week_number IS NOT NULL AND selected_week_date IS NULL'
      );

      let updated = 0;
      for (const shipment of result.rows) {
        const selectedWeekDate = calculateWeekDate(shipment.week_number);
        if (selectedWeekDate) {
          await pool.query(
            'UPDATE shipments SET selected_week_date = $1 WHERE id = $2',
            [selectedWeekDate, shipment.id]
          );
          updated++;
        }
      }

      logInfo(`Backfilled ${updated} shipments with selectedWeekDate`);
      return true;
    },
  },

  {
    name: 'fix-supplier-names',
    version: '011',
    description: 'Fix supplier name inconsistencies and standardization',
    depends_on: ['schema.sql'],
    execute: async () => {
      const fixes = [
        {
          oldName: 'AB Mauri ',
          newName: 'AB Mauri',
          reason: 'Remove trailing space',
        },
        {
          oldName: 'Aromsa',
          newName: 'AROMSA',
          reason: 'Standardize to uppercase',
        },
        {
          oldName: 'Shakti Chemicals',
          newName: 'SHAKTI CHEMICALS',
          reason: 'Standardize to uppercase',
        },
        {
          oldName: ' Sacco',
          newName: 'SACCO',
          reason: 'Remove leading space and standardize',
        },
        {
          oldName: 'Deltaris',
          newName: 'QUERCYL',
          reason: 'Rename to match shipment data',
        },
      ];

      for (const fix of fixes) {
        await pool.query(
          `UPDATE suppliers SET name = $1, updated_at = CURRENT_TIMESTAMP
           WHERE name = $2`,
          [fix.newName, fix.oldName]
        );
      }

      return true;
    },
  },

  {
    name: 'fix-shipment-supplier-names',
    version: '012',
    description: 'Fix shipment supplier name inconsistencies',
    depends_on: ['schema.sql', 'fix-supplier-names'],
    execute: async () => {
      const fixes = [
        {
          oldName: 'Shakti Chemicals',
          newName: 'SHAKTI CHEMICALS',
          reason: 'Standardize mixed case to uppercase',
        },
      ];

      for (const fix of fixes) {
        await pool.query(
          `UPDATE shipments SET supplier = $1, updated_at = CURRENT_TIMESTAMP
           WHERE supplier = $2`,
          [fix.newName, fix.oldName]
        );
      }

      return true;
    },
  },

  {
    name: 'add-rejection-migration',
    version: '013',
    description: 'Add rejection fields to shipments table',
    depends_on: ['schema.sql'],
    execute: async () => {
      // This migration requires external SQL file, skip if not available
      // In production, ensure add-rejection-fields.sql is present
      logInfo('Rejection migration requires external SQL file');
      return true;
    },
  },

  // Phase 6: Import Costing Feature
  {
    name: 'add-import-costing-tables',
    version: '014',
    description: 'Create import cost estimates and exchange rate cache tables',
    depends_on: ['schema.sql'],
    execute: async () => {
      // Create import_cost_estimates table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS import_cost_estimates (
          id VARCHAR(255) PRIMARY KEY,
          shipment_id VARCHAR(255) REFERENCES shipments(id) ON DELETE SET NULL,
          supplier_id VARCHAR(255) REFERENCES suppliers(id) ON DELETE SET NULL,

          -- Header Section
          reference_number VARCHAR(100),
          country_of_destination VARCHAR(100) DEFAULT 'South Africa',
          port_of_discharge VARCHAR(50),
          shipping_line VARCHAR(100),
          routing VARCHAR(255),
          frequency VARCHAR(50),
          transit_time_days INTEGER,
          inco_terms VARCHAR(20),
          inco_term_place VARCHAR(100),
          container_type VARCHAR(50),
          quantity INTEGER DEFAULT 1,
          hs_code VARCHAR(50),
          gross_weight_kg NUMERIC(12,2),
          total_gross_weight_kg NUMERIC(12,2),
          origin_rate_usd NUMERIC(12,2),
          ocean_freight_rate_usd NUMERIC(12,2),
          commodity VARCHAR(255),
          invoice_value_usd NUMERIC(14,2) DEFAULT 0,
          invoice_value_eur NUMERIC(14,2) DEFAULT 0,
          customs_value_zar NUMERIC(14,2) DEFAULT 0,
          supplier_name VARCHAR(255),
          validity_date DATE,
          costing_date DATE DEFAULT CURRENT_DATE,
          payment_terms VARCHAR(100),
          roe_origin NUMERIC(12,6),

          -- Origin Charges (USD and EUR)
          origin_charge_usd NUMERIC(12,2) DEFAULT 0,
          origin_charge_eur NUMERIC(12,2) DEFAULT 0,
          roe_eur NUMERIC(12,6),
          origin_charge_zar NUMERIC(14,2) DEFAULT 0,
          total_origin_charges_zar NUMERIC(14,2) DEFAULT 0,

          -- Destination Charges (ZAR)
          thc_zar NUMERIC(12,2) DEFAULT 0,
          gate_door_zar NUMERIC(12,2) DEFAULT 0,
          insurance_zar NUMERIC(12,2) DEFAULT 0,
          shipping_line_fee_zar NUMERIC(12,2) DEFAULT 0,
          port_inland_release_fee_zar NUMERIC(12,2) DEFAULT 0,
          cto_zar NUMERIC(12,2) DEFAULT 0,
          transport_port_to_warehouse_zar NUMERIC(12,2) DEFAULT 0,
          delivery_only_trans_zar NUMERIC(12,2) DEFAULT 0,
          unpack_reload_zar NUMERIC(12,2) DEFAULT 0,
          destination_charges_subtotal_zar NUMERIC(14,2) DEFAULT 0,

          -- Customs Disbursements
          customs_duty_zar NUMERIC(12,2) DEFAULT 0,
          customs_duty_not_applicable BOOLEAN DEFAULT false,
          customs_disbursements_subtotal_zar NUMERIC(14,2) DEFAULT 0,

          -- Clearing Charges (ZAR)
          documentation_fee_zar NUMERIC(12,2) DEFAULT 0,
          communication_fee_zar NUMERIC(12,2) DEFAULT 0,
          edif_fee_zar NUMERIC(12,2) DEFAULT 0,
          plant_inspection_zar NUMERIC(12,2) DEFAULT 0,
          portbuild_zar NUMERIC(12,2) DEFAULT 0,
          davif_zar NUMERIC(12,2) DEFAULT 0,
          agency_zar NUMERIC(12,2) DEFAULT 0,
          clearing_charges_subtotal_zar NUMERIC(14,2) DEFAULT 0,

          -- Calculated Totals
          total_shipping_cost_zar NUMERIC(14,2) DEFAULT 0,
          total_in_warehouse_cost_zar NUMERIC(14,2) DEFAULT 0,
          all_in_warehouse_cost_per_kg_zar NUMERIC(12,4) DEFAULT 0,

          -- Metadata
          status VARCHAR(50) DEFAULT 'draft',
          notes TEXT,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create exchange rate cache table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exchange_rate_cache (
          id SERIAL PRIMARY KEY,
          currency_pair VARCHAR(10) NOT NULL UNIQUE,
          rate NUMERIC(12,6) NOT NULL,
          source VARCHAR(100),
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_estimates_shipment ON import_cost_estimates(shipment_id);
        CREATE INDEX IF NOT EXISTS idx_cost_estimates_supplier ON import_cost_estimates(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_cost_estimates_date ON import_cost_estimates(costing_date);
        CREATE INDEX IF NOT EXISTS idx_cost_estimates_status ON import_cost_estimates(status);
        CREATE INDEX IF NOT EXISTS idx_exchange_rate_pair ON exchange_rate_cache(currency_pair);
      `);

      logInfo('Import costing tables created successfully');
      return true;
    },
  },

  // Phase 7: Import Costing Schema Update - Local Charges and Destination Charges restructure
  {
    name: 'update-import-costing-schema',
    version: '015',
    description: 'Update import cost estimates with new Local Charges and Destination Charges fields',
    depends_on: ['add-import-costing-tables'],
    execute: async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Add new Local Charges columns
        const localChargeColumns = [
          'local_cartage_zar NUMERIC(12,2) DEFAULT 0',
          'transport_to_warehouse_zar NUMERIC(12,2) DEFAULT 0',
          'storage_zar NUMERIC(12,2) DEFAULT 0',
          'storage_days INTEGER DEFAULT 0',
          'outlying_depot_surcharge_zar NUMERIC(12,2) DEFAULT 0',
          'local_charges_subtotal_zar NUMERIC(14,2) DEFAULT 0',
        ];

        for (const colDef of localChargeColumns) {
          const colName = colDef.split(' ')[0];
          const checkResult = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='import_cost_estimates' AND column_name=$1`,
            [colName]
          );
          if (checkResult.rows.length === 0) {
            await client.query(`ALTER TABLE import_cost_estimates ADD COLUMN ${colDef}`);
            logInfo(`Added column ${colName} to import_cost_estimates`);
          }
        }

        // Add new Destination Charges (Port/Shipping) columns
        const destChargeColumns = [
          'shipping_line_charges_zar NUMERIC(12,2) DEFAULT 0',
          'cargo_dues_zar NUMERIC(12,2) DEFAULT 0',
          'cto_fee_zar NUMERIC(12,2) DEFAULT 0',
          'port_health_inspection_zar NUMERIC(12,2) DEFAULT 0',
          'sars_inspection_zar NUMERIC(12,2) DEFAULT 0',
          'state_vet_fee_zar NUMERIC(12,2) DEFAULT 0',
          'inb_turn_in_zar NUMERIC(12,2) DEFAULT 0',
        ];

        for (const colDef of destChargeColumns) {
          const colName = colDef.split(' ')[0];
          const checkResult = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='import_cost_estimates' AND column_name=$1`,
            [colName]
          );
          if (checkResult.rows.length === 0) {
            await client.query(`ALTER TABLE import_cost_estimates ADD COLUMN ${colDef}`);
            logInfo(`Added column ${colName} to import_cost_estimates`);
          }
        }

        // Add new Customs & Duties columns
        const customsColumns = [
          'duties_zar NUMERIC(12,2) DEFAULT 0',
          'customs_vat_zar NUMERIC(12,2) DEFAULT 0',
          'customs_declaration_zar NUMERIC(12,2) DEFAULT 0',
          'agency_fee_zar NUMERIC(12,2) DEFAULT 0',
          'agency_fee_percentage NUMERIC(5,2) DEFAULT 3.5',
          'agency_fee_min NUMERIC(12,2) DEFAULT 1187',
          'customs_subtotal_zar NUMERIC(14,2) DEFAULT 0',
        ];

        for (const colDef of customsColumns) {
          const colName = colDef.split(' ')[0];
          const checkResult = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='import_cost_estimates' AND column_name=$1`,
            [colName]
          );
          if (checkResult.rows.length === 0) {
            await client.query(`ALTER TABLE import_cost_estimates ADD COLUMN ${colDef}`);
            logInfo(`Added column ${colName} to import_cost_estimates`);
          }
        }

        await client.query('COMMIT');
        logInfo('Import costing schema updated with new Local Charges and Destination Charges fields');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  },
];

/**
 * Create migration tracking table if it doesn't exist
 */
export async function initializeMigrationTracking() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        executed_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER,
        UNIQUE(name, version)
      );
    `);

    logInfo('Migration tracking table initialized');
  } catch (error) {
    logError('Failed to initialize migration tracking', error);
    throw error;
  }
}

/**
 * Record migration execution
 */
export async function recordMigration(
  name: string,
  version: string,
  status: MigrationStatus,
  error?: string,
  durationMs?: number
) {
  try {
    await pool.query(
      `INSERT INTO migration_history (name, version, status, error_message, executed_at, completed_at, duration_ms)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
       ON CONFLICT (name, version) DO UPDATE SET
         status = EXCLUDED.status,
         error_message = EXCLUDED.error_message,
         completed_at = EXCLUDED.completed_at,
         duration_ms = EXCLUDED.duration_ms`,
      [
        name,
        version,
        status,
        error || null,
        status === MigrationStatus.COMPLETED ? new Date().toISOString() : null,
        durationMs || 0,
      ]
    );
  } catch (error) {
    logError('Failed to record migration', error);
  }
}

/**
 * Get migration history
 */
export async function getMigrationHistory() {
  try {
    const result = await pool.query(
      `SELECT * FROM migration_history ORDER BY executed_at DESC`
    );
    return result.rows;
  } catch (error) {
    logError('Failed to get migration history', error);
    return [];
  }
}

export default migrations;
