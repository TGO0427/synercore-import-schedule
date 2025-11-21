# Database Migrations Guide

## Overview

This guide explains the consolidated database migration system for Synercore Import Schedule. All migrations are now organized in a single execution pipeline with dependency tracking, status management, and detailed logging.

## Migration Architecture

### Execution Phases

Migrations are organized into 6 phases that execute in strict order:

**Phase 1: Schema Creation (v000)**
- Creates base tables from `schema.sql`
- Dependency: None (initial phase)
- Critical: Yes (application cannot run without schema)

**Phase 2: Performance Indexing (v001)**
- Adds performance indexes to shipments table
- Dependency: schema-creation
- Critical: No (performance optimization, gracefully degrades)

**Phase 3: Column Additions (v002-v004)**
- `add-available-bins` - Warehouse capacity tracking
- `add-total-capacity` - Total capacity per warehouse
- `add-password-reset` - Password reset token columns
- Dependency: schema-creation
- Critical: No (columns are optional with defaults)

**Phase 4: Table Creations (v005-v008)**
- `add-notifications-tables` - Notification system tables
- `add-refresh-tokens-table` - JWT refresh token storage
- `add-supplier-accounts` - Supplier portal tables
- `add-archives-table` - Data archive storage
- Dependency: schema-creation
- Critical: No (new features, graceful degradation)

**Phase 5: Referential Integrity (v009)**
- Adds foreign key constraints
- Adds soft-delete columns (deleted_at)
- Adds audit columns (created_by, updated_by)
- Dependency: schema-creation + table creation phases
- Critical: No (constraints improve data quality)

**Phase 6: Data Migrations (v010-v013)**
- `backfill-week-dates` - Calculate missing week dates
- `fix-supplier-names` - Standardize supplier names
- `fix-shipment-supplier-names` - Standardize shipment suppliers
- `add-rejection-migration` - Rejection tracking fields (optional)
- Dependency: schema-creation, data exists
- Critical: No (data cleanup/fixes)

## Migration Registry

### All Migrations

| Version | Name | Status | Phase |
|---------|------|--------|-------|
| 000 | schema-creation | Critical | Base |
| 001 | add-performance-indexes | Optional | Indexing |
| 002 | add-available-bins | Optional | Columns |
| 003 | add-total-capacity | Optional | Columns |
| 004 | add-password-reset | Optional | Columns |
| 005 | add-notifications-tables | Optional | Tables |
| 006 | add-refresh-tokens-table | Optional | Tables |
| 007 | add-supplier-accounts | Optional | Tables |
| 008 | add-archives-table | Optional | Tables |
| 009 | add-referential-integrity | Optional | Constraints |
| 010 | backfill-week-dates | Optional | Data |
| 011 | fix-supplier-names | Optional | Data |
| 012 | fix-shipment-supplier-names | Optional | Data |
| 013 | add-rejection-migration | Optional | Data |

## Running Migrations

### Automatic Execution

Migrations run automatically during application startup:

```bash
npm run migrate
```

This will:
1. Connect to the database (reads DATABASE_URL environment variable)
2. Initialize migration tracking table
3. Execute all pending migrations in sequence
4. Record status of each migration
5. Display summary of completed/failed migrations

### Check Migration Status

View the status of all migrations:

```bash
npm run migrate:status
```

Output shows:
- ✅ Completed migrations (with timestamp and duration)
- ❌ Failed migrations (with error message)
- ⏭️  Skipped migrations (already executed)
- ⏳ Pending migrations (not yet executed)

### Reset Migrations

Clear all migration history (useful for development):

```bash
npm run migrate:reset
```

⚠️ **Warning**: This only clears the `migration_history` table, not the actual database schema. Use with caution.

## Migration Tracking

### Migration History Table

All migrations are tracked in the `migration_history` table:

```sql
CREATE TABLE migration_history (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,          -- PENDING|RUNNING|COMPLETED|FAILED|SKIPPED
  error_message TEXT,                   -- Error details if status=FAILED
  executed_at TIMESTAMP WITH TIME ZONE, -- When migration started
  completed_at TIMESTAMP WITH TIME ZONE,-- When migration finished
  duration_ms INTEGER,                  -- Execution time in milliseconds
  UNIQUE(name, version)
);
```

### Query Migration History

```sql
-- View all migrations
SELECT * FROM migration_history ORDER BY version ASC;

-- View failed migrations
SELECT * FROM migration_history WHERE status = 'FAILED';

-- View execution duration
SELECT name, duration_ms FROM migration_history
WHERE status = 'COMPLETED' ORDER BY duration_ms DESC;

-- View recent migrations
SELECT * FROM migration_history
ORDER BY executed_at DESC LIMIT 10;
```

## Migration Details

### Phase 1: Schema (v000)

**Files**: `schema.sql` (external)

**Description**: Creates the complete database schema including:
- users
- suppliers
- shipments
- warehouse_capacity
- quotes
- quotes_items
- ... (other tables defined in schema.sql)

**Idempotency**: Uses `CREATE TABLE IF NOT EXISTS` - safe to run multiple times

**Rollback**: Not supported for schema creation

### Phase 2: Performance Indexing (v001)

**Description**: Creates 7 performance indexes:
- `idx_shipments_warehouse` - Filter by warehouse
- `idx_shipments_status_week` - Filter by status and week
- `idx_shipments_status_warehouse` - Complex queries
- `idx_shipments_order_ref` - Order reference lookups
- `idx_shipments_created_at` - Timestamp filtering
- `idx_shipments_inspection_status` - Inspection queries
- `idx_shipments_receiving_status` - Receiving queries

**Impact**: Improves query performance by 10-100x for filtered queries

**Idempotency**: Safe to run multiple times (uses `IF NOT EXISTS`)

### Phase 3: Column Additions (v002-v004)

**add-available-bins (v002)**
- Adds `available_bins` column to `warehouse_capacity`
- Initializes 3 warehouses (PRETORIA, KLAPMUTS, Offsite)
- Default: 0 (dynamically calculated)

**add-total-capacity (v003)**
- Adds `total_capacity` column to `warehouse_capacity`
- Stores maximum capacity per warehouse
- Warehouses: PRETORIA (650), KLAPMUTS (384), Offsite (384)

**add-password-reset (v004)**
- Adds `reset_token` VARCHAR(255) column
- Adds `reset_token_expiry` TIMESTAMP column
- Creates index on `reset_token` for fast lookups
- Enables self-service password reset feature

**Idempotency**: All check for column existence before adding

### Phase 4: Table Creations (v005-v008)

**add-notifications-tables (v005)**

Three tables created:

1. `notification_preferences`
   - User notification settings
   - Toggle various event types
   - Email frequency settings
   - Indexed by user_id

2. `notification_log`
   - Notification send history
   - Status tracking (sent, failed, pending)
   - Event type and delivery method
   - Indexed by user_id, sent_at, event_type

3. `notification_digest_queue`
   - Queue for digest emails (daily/weekly)
   - Stores event data as JSONB
   - Indexed by user_id, processed_at

**add-refresh-tokens-table (v006)**

1. `refresh_tokens`
   - JWT refresh token storage
   - Tracks token expiration
   - Records IP and user agent for security
   - Prevents revoked tokens (CHECK constraint)
   - Indexed by token, user_id, expires_at

**add-supplier-accounts (v007)**

Two tables created:

1. `supplier_accounts`
   - Supplier self-service login credentials
   - Tracks verification and login history
   - Indexed by email, supplier_id

2. `supplier_documents`
   - POD, delivery proof, customs documents
   - Links to shipments and suppliers
   - Verification workflow support
   - Indexed by shipment_id, supplier_id, document_type

**add-archives-table (v008)**

1. `archives`
   - Stores archived shipment data as JSONB
   - Tracks archive creation timestamp
   - Indexed by archived_at, file_name

### Phase 5: Referential Integrity (v009)

**Foreign Key Constraints Added**:
- `shipments.inspected_by` → `users.id`
- `shipments.received_by` → `users.id`
- `shipments.rejected_by` → `users.id`
- `supplier_documents.verified_by` → `users.id`

All use `ON DELETE SET NULL` to handle user deletions.

**Soft-Delete Columns Added**:
- `deleted_at` TIMESTAMP on: shipments, suppliers, users
- Enables logical deletion without data loss
- Useful for audit trails and undo functionality

**Audit Columns Added**:
- `created_by` VARCHAR(255) on users table
- `updated_by` VARCHAR(255) on users table
- Tracks who created/modified records

**Execution**: Uses transaction with ROLLBACK on failure

### Phase 6: Data Migrations (v010-v013)

**backfill-week-dates (v010)**

Calculates missing `selected_week_date` from `week_number`:
- Uses ISO week number to date conversion
- Smart year detection (handles year boundaries)
- Updates only shipments with NULL `selected_week_date`
- Example: week 52 in December 2024 → 2024-12-23

**fix-supplier-names (v011)**

Standardizes supplier names for consistency:
- `AB Mauri ` → `AB Mauri` (remove trailing space)
- `Aromsa` → `AROMSA` (standardize case)
- `Shakti Chemicals` → `SHAKTI CHEMICALS`
- ` Sacco` → `SACCO` (remove leading space)
- `Deltaris` → `QUERCYL` (rename to match data)

**fix-shipment-supplier-names (v012)**

Updates shipment records to match supplier names:
- `Shakti Chemicals` → `SHAKTI CHEMICALS`
- Ensures metrics calculations work correctly
- Dependency: must run after fix-supplier-names

**add-rejection-migration (v013)**

Adds rejection tracking fields (requires external SQL):
- Currently skipped (optional)
- Requires `add-rejection-fields.sql` file
- Adds rejection status and reason fields to shipments

## Environment Configuration

### Required Variables

```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/synercore

# Or individual components:
PGHOST=localhost
PGPORT=5432
PGDATABASE=synercore
PGUSER=user
PGPASSWORD=password
```

### Optional Variables

```bash
# For Railway deployment
NODE_ENV=production
NODE_TLS_REJECT_UNAUTHORIZED=0  # Disable SSL verification for Railway
```

## Common Issues & Solutions

### "DATABASE_URL not set"

**Cause**: Missing database connection string

**Solution**: Set DATABASE_URL environment variable or create .env file:
```bash
echo "DATABASE_URL=postgresql://user:pass@localhost/synercore" > .env
```

### "Column already exists"

**Cause**: Migration ran before and column was created

**Solution**: This is expected and handled gracefully. Migration checks for existing columns and skips if found.

### "Foreign key constraint failed"

**Cause**: Constraint references non-existent record

**Solution**: Check that referenced tables and records exist. Constraints use `ON DELETE SET NULL` so deleting referenced records won't fail.

### Migration takes too long

**Cause**: Large data migration on big dataset

**Solution**: Run migrations during off-peak hours. Monitor progress with:
```bash
SELECT * FROM migration_history WHERE status = 'RUNNING';
```

### Migration failed but database is inconsistent

**Cause**: Partial migration execution (rare)

**Solution**:
1. Check error in migration_history table
2. Fix the underlying issue
3. For critical migrations, may need manual correction
4. Rerun with `npm run migrate`

## Deployment Checklist

Before deploying to production:

- [ ] All migrations have been tested on development database
- [ ] DATABASE_URL is correctly configured in production
- [ ] Database backup has been created
- [ ] Migration history is clean (no unexpected FAILED status)
- [ ] Connection pool size is adequate for migration duration
- [ ] No other applications accessing database during migration
- [ ] Monitoring/alerting is configured
- [ ] Rollback plan is documented

## Best Practices

### For Developers

1. **Test migrations locally first**
   ```bash
   npm run migrate
   npm run migrate:status
   ```

2. **Keep migrations idempotent**
   - Use `IF NOT EXISTS` for all schema changes
   - Check for existence before adding columns/constraints

3. **Document breaking changes**
   - Add comments in code about schema changes
   - Update this guide if adding new migrations

4. **Avoid long-running migrations**
   - Batch large data updates
   - Consider async processing for big data transformations

5. **Always include rollback strategy**
   - Document how to undo each migration if needed
   - Test rollback process

### For Operations

1. **Monitor migration execution**
   ```sql
   SELECT name, status, duration_ms, error_message
   FROM migration_history
   WHERE executed_at > NOW() - INTERVAL '1 hour';
   ```

2. **Keep migration history**
   - Do not delete migration_history records
   - Use for audit trail and issue investigation

3. **Test migrations in staging**
   - Run complete migration cycle on staging before production
   - Verify data integrity after migrations

4. **Schedule during maintenance windows**
   - Run migrations when user traffic is minimal
   - Notify team of maintenance window

## Creating New Migrations

To add a new migration:

1. **Add to `migrate-consolidated.js`**:
   ```javascript
   {
     name: 'your-migration-name',
     version: '014',
     description: 'What this migration does',
     depends_on: ['schema-creation'],  // Dependencies
     critical: false,
     execute: async () => {
       // Your migration logic here
       await db.query('YOUR SQL STATEMENT');
       logInfo('✓ Migration completed');
       return true;
     }
   }
   ```

2. **Ensure idempotency**:
   - Check for existence before creating
   - Handle duplicate execution gracefully
   - Use IF NOT EXISTS for schema changes

3. **Test locally**:
   ```bash
   npm run migrate
   npm run migrate:status
   ```

4. **Document in this guide**
   - Add to migration registry
   - Describe what it does
   - Note any dependencies

## Resources

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Migration Best Practices](https://www.postgresql.org/docs/current/sql-createindex.html)
- [Node.js pg Library](https://node-postgres.com/)
- [Migration Testing](https://github.com/tj/node-migrate)

## Support

For migration issues:

1. Check `migration_history` table for detailed status
2. Review logs in console output
3. Check error_message column in migration_history
4. Verify DATABASE_URL configuration
5. Ensure database connectivity: `psql $DATABASE_URL -c "SELECT 1"`

---

**Last Updated**: November 21, 2025
**Version**: 1.0
**Status**: Production Ready
