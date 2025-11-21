# Database Referential Integrity Documentation

## Overview

This document details the database schema, foreign key relationships, constraints, and integrity measures implemented in the Synercore Import Schedule application.

## Schema Summary

### Core Tables

| Table | Purpose | Records |
|-------|---------|---------|
| `users` | System users and admin accounts | ~10-20 |
| `suppliers` | Supplier master data | ~50-100 |
| `shipments` | Shipment tracking records | ~1000+ |
| `warehouse_capacity` | Warehouse bin/capacity tracking | 3 warehouses |
| `warehouse_capacity_history` | Audit trail for warehouse changes | Grows with operations |
| `refresh_tokens` | JWT refresh token store | Active tokens only |
| `notification_preferences` | User notification settings | ~1 per user |
| `notification_log` | Audit trail for sent notifications | Grows over time |
| `notification_digest_queue` | Queue for digest-style notifications | Grows with events |
| `supplier_accounts` | Supplier portal user accounts | ~50-100 |
| `supplier_documents` | Document uploads for shipments | Grows with uploads |
| `archives` | Archived shipment snapshots | Grows with archives |

## Foreign Key Relationships

### Primary Relationships

```
Users ← Suppliers (via supplier_accounts)
Users ← Shipments (via inspected_by, received_by, rejected_by)
Users ← Warehouse History (via changed_by)
Users ← Notifications (via user_id)
Users ← Password Reset (via reset_token)

Suppliers ← Shipments (via supplier)
Suppliers ← Supplier Accounts
Suppliers ← Supplier Documents (via supplier_id)

Shipments ← Warehouse History
Shipments ← Notifications
Shipments ← Supplier Documents (via shipment_id)
Shipments ← Warehouse Capacity (via receiving_warehouse)
```

### Detailed Foreign Key Constraints

#### Users Table References

| Constraint | Source | Target | Delete Rule |
|-----------|--------|--------|-------------|
| `fk_warehouse_capacity_updated_by` | warehouse_capacity.updated_by | users.id | SET NULL |
| `fk_warehouse_capacity_history_changed_by` | warehouse_capacity_history.changed_by | users.id | SET NULL |
| `fk_refresh_tokens_user_id` | refresh_tokens.user_id | users.id | CASCADE |
| `fk_notification_preferences_user_id` | notification_preferences.user_id | users.id | CASCADE |
| `fk_notification_log_user_id` | notification_log.user_id | users.id | CASCADE |
| `fk_notification_digest_queue_user_id` | notification_digest_queue.user_id | users.id | CASCADE |
| `fk_shipments_inspected_by` | shipments.inspected_by | users.id | SET NULL |
| `fk_shipments_received_by` | shipments.received_by | users.id | SET NULL |
| `fk_shipments_rejected_by` | shipments.rejected_by | users.id | SET NULL |
| `fk_archives_created_by` | archives.created_by | users.id | SET NULL |

#### Suppliers Table References

| Constraint | Source | Target | Delete Rule |
|-----------|--------|--------|-------------|
| `fk_supplier_accounts_supplier_id` | supplier_accounts.supplier_id | suppliers.id | CASCADE |
| `fk_supplier_documents_supplier_id` | supplier_documents.supplier_id | suppliers.id | CASCADE |

#### Shipments Table References

| Constraint | Source | Target | Delete Rule |
|-----------|--------|--------|-------------|
| `fk_notification_log_shipment_id` | notification_log.shipment_id | shipments.id | SET NULL |
| `fk_notification_digest_queue_shipment_id` | notification_digest_queue.shipment_id | shipments.id | SET NULL |
| `fk_supplier_documents_shipment_id` | supplier_documents.shipment_id | shipments.id | CASCADE |

#### Warehouse References

| Constraint | Source | Target | Delete Rule |
|-----------|--------|--------|-------------|
| `fk_shipments_receiving_warehouse` | shipments.receiving_warehouse | warehouse_capacity.warehouse_name | SET NULL |

## Unique Constraints

The following columns enforce uniqueness:

- `users.username` - Unique user identifiers
- `users.email` - Unique email addresses (can be NULL)
- `suppliers.name` - Unique supplier names
- `suppliers.id` - Primary key
- `refresh_tokens.token` - Unique refresh tokens
- `supplier_accounts.supplier_id` - One account per supplier
- `supplier_accounts.email` - Unique supplier portal emails
- `archives.file_name` - Unique archive file names

## Check Constraints

### Warehouse Capacity Validation

```sql
CHECK (available_bins = total_capacity - COALESCE(bins_used, 0))
```

This ensures warehouse capacity calculations remain consistent.

### Refresh Token Validation

```sql
CHECK (revoked_at IS NULL)
```

Ensures only non-revoked tokens are considered active.

## Indexes

### Primary Key Indexes

- `users.id` (PRIMARY KEY)
- `suppliers.id` (PRIMARY KEY)
- `shipments.id` (PRIMARY KEY)
- `warehouse_capacity.warehouse_name` (PRIMARY KEY)

### Foreign Key Indexes

Performance indexes for foreign key columns:

- `idx_shipments_inspected_by` - For user lookups
- `idx_shipments_received_by` - For user lookups
- `idx_shipments_rejected_by` - For user lookups
- `idx_supplier_documents_verified_by` - For user lookups
- `idx_refresh_tokens_user_id` - For token lookups
- `idx_notification_log_user_id` - For notification queries
- `idx_notification_digest_queue_user_id` - For digest queries
- `idx_supplier_accounts_supplier_id` - For supplier lookups

### Query Performance Indexes

- `idx_shipments_supplier` - Filter by supplier
- `idx_shipments_status` - Filter by status
- `idx_shipments_week` - Filter by week
- `idx_shipments_updated` - Sort by update time
- `idx_shipments_warehouse` - Filter by warehouse
- `idx_shipments_order_ref` - Search by order reference
- `idx_shipments_created_at` - Filter by creation date
- `idx_suppliers_name` - Search by name
- `idx_warehouse_capacity_history_warehouse` - Query history by warehouse
- `idx_warehouse_capacity_history_date` - Query history by date

## Data Integrity Rules

### Referential Integrity

1. **User Deletion**
   - When a user is deleted:
     - Their refresh tokens are CASCADE deleted
     - Their notification preferences are CASCADE deleted
     - Their notification logs are CASCADE deleted
     - References in shipments/warehouse history are SET to NULL

2. **Supplier Deletion**
   - When a supplier is deleted:
     - All associated supplier accounts are CASCADE deleted
     - All associated supplier documents are CASCADE deleted
     - Shipment references are preserved (data integrity)

3. **Shipment Deletion**
   - When a shipment is deleted:
     - Associated supplier documents are CASCADE deleted
     - Notification logs reference is SET to NULL
     - Warehouse history is preserved

### Business Logic Constraints

1. **Warehouse Capacity**
   - Available bins must equal: `total_capacity - bins_used`
   - Enforced by CHECK constraint
   - Application must maintain this invariant

2. **Refresh Token Lifecycle**
   - New tokens created on login/registration
   - Tokens have expiration timestamp
   - Revoked tokens are soft-deleted (revoked_at set)
   - Old tokens should be cleaned up periodically

3. **User Roles**
   - Users can have roles: 'admin', 'user', 'supplier'
   - Role-based access control enforced in API middleware
   - Database doesn't enforce role constraints (flexible approach)

4. **Notification Preferences**
   - One preference record per user
   - UNIQUE constraint on user_id
   - Email frequency: 'immediate', 'daily', 'weekly'
   - Notification delivery: 'email' (extensible)

## Soft Deletes

The following tables support soft deletes via `deleted_at` column:

- `shipments.deleted_at` - Archive shipments without deleting
- `suppliers.deleted_at` - Mark suppliers as inactive
- `users.deleted_at` - Soft-delete user accounts

### Soft Delete Implementation

When querying, remember to filter:

```sql
WHERE deleted_at IS NULL  -- Only active records
```

The application should handle this in repositories.

## Audit Columns

The following audit columns track changes:

### User Tracking

- `shipments.inspected_by` - User who performed inspection
- `shipments.received_by` - User who confirmed receipt
- `shipments.rejected_by` - User who rejected shipment
- `warehouse_capacity_history.changed_by` - User who changed capacity
- `supplier_documents.uploaded_by` - User who uploaded document
- `supplier_documents.verified_by` - User who verified document
- `archives.created_by` - User who created archive

### Timestamps

- `created_at` - Creation timestamp (most tables)
- `updated_at` - Last update timestamp (most tables)
- `sent_at` - Notification sent timestamp
- `changed_at` - History change timestamp
- `uploaded_at` - Document upload timestamp
- `verified_at` - Document verification timestamp
- `last_login` - Supplier's last login time

## Migration History

### Phase 1: Initial Schema
- Core tables: users, suppliers, shipments
- Warehouse tracking: warehouse_capacity
- Basic constraints and indexes

### Phase 2: Enhanced Features
- Refresh tokens table for JWT management
- Notification system: preferences, log, digest queue
- Supplier accounts and documents
- Performance indexes

### Phase 3: Referential Integrity
- Added foreign key constraints for:
  - User tracking columns (inspected_by, received_by, rejected_by)
  - Document verification (verified_by)
  - Warehouse operations (changed_by)
- Added soft-delete columns
- Added audit columns
- Added check constraints for data validation

## Running Migrations

### Initial Setup

```bash
npm run migrate
```

This runs all migrations in sequence:
1. Create schema
2. Add performance indexes
3. Add available bins column
4. **Add referential integrity constraints** (NEW)
5. Load initial data from JSON files

### Individual Migrations

To run the referential integrity migration standalone:

```bash
node server/db/add-referential-integrity.js
```

## Data Validation Checklist

Before deploying to production, verify:

- [ ] All users have unique usernames and emails
- [ ] All suppliers have unique names and valid IDs
- [ ] All shipment references to suppliers exist
- [ ] All warehouse references are to valid warehouses
- [ ] All user references (inspected_by, etc.) exist or are NULL
- [ ] Warehouse capacity math checks out: `available_bins = total_capacity - bins_used`
- [ ] No orphaned refresh tokens (expired tokens cleaned up)
- [ ] Notification preferences exist for active users
- [ ] No orphaned supplier documents or accounts

## Constraints Summary

| Type | Count |
|------|-------|
| Foreign Keys | 12 |
| Unique Constraints | 8 |
| Check Constraints | 2 |
| Indexes | 31 |
| Tables | 12 |
| Columns | 150+ |

## Performance Implications

### Indexing Strategy

- Foreign key columns are indexed for JOIN performance
- Query filter columns are indexed (status, supplier, week, date)
- Composite indexes for common filter combinations
- Partial indexes for sparse data (e.g., reset_token)

### Query Optimization

1. **Shipment Queries**
   - Use indexes on (supplier, status, week, warehouse)
   - Combine indexes for multi-filter queries
   - Created composite index for status+week common filter

2. **User Queries**
   - Username lookup uses username index
   - Reset token lookup uses partial index
   - Email lookups benefit from unique constraint index

3. **Warehouse Queries**
   - History queries use warehouse + date indexes
   - Capacity lookups are primary key (fast)

## Best Practices

### When Adding New Relationships

1. Create the foreign key constraint
2. Create an index on the foreign key column
3. Add the reverse relationship documentation
4. Update this file
5. Test CASCADE/SET NULL behavior
6. Verify no orphaned records

### When Modifying Data

1. Always check foreign key constraints
2. Use transactions for multi-table updates
3. Validate soft-delete logic (check deleted_at)
4. Update audit columns (inspected_by, etc.)
5. Verify constraint checksums after bulk operations

### When Deleting Records

1. Check if record is referenced elsewhere
2. Understand CASCADE vs SET NULL implications
3. Consider soft-delete for critical data
4. Verify referential integrity afterwards

## Troubleshooting

### Foreign Key Violation

If you get `FOREIGN KEY constraint violation`:
1. Check the referenced table has the record
2. Verify the data type matches (often VARCHAR vs INT)
3. Check if record is soft-deleted (deleted_at IS NOT NULL)
4. Consult the constraint details above

### Unique Constraint Violation

If you get `UNIQUE constraint violation`:
1. Check what column is duplicated
2. Query for existing records: `SELECT * FROM table WHERE column = value`
3. Update or delete the existing record
4. Retry the operation

### Orphaned Records

To find orphaned records:

```sql
-- Orphaned shipments (supplier doesn't exist)
SELECT s.* FROM shipments s
LEFT JOIN suppliers sup ON s.supplier = sup.name
WHERE sup.id IS NULL AND s.supplier IS NOT NULL;

-- Orphaned notifications (user doesn't exist)
SELECT n.* FROM notification_log n
LEFT JOIN users u ON n.user_id = u.id
WHERE u.id IS NULL;

-- Orphaned documents (shipment doesn't exist)
SELECT d.* FROM supplier_documents d
LEFT JOIN shipments s ON d.shipment_id = s.id
WHERE s.id IS NULL AND d.shipment_id IS NOT NULL;
```

## Related Documentation

- [Schema Design](./server/db/schema.sql)
- [Migration Scripts](./server/db/)
- [TypeScript Migration Guide](./TYPESCRIPT_MIGRATION_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)

## Support

For database-related issues:
1. Check this documentation
2. Review migration logs
3. Query information_schema for constraint details
4. Test with smaller data sets first
5. Backup before major operations
