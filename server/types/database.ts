/**
 * Database-specific type definitions
 * Types for database operations, queries, and migrations
 */

import type { PoolClient } from 'pg';

/**
 * Database query options
 */
export interface QueryOptions {
  text: string;
  values?: any[];
  name?: string;
}

/**
 * Database migration function
 */
export type MigrationFunction = (client: PoolClient) => Promise<void>;

/**
 * Migration metadata
 */
export interface Migration {
  name: string;
  up: MigrationFunction;
  down: MigrationFunction;
}

/**
 * Column definition for schema
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  default?: string | number;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Table definition
 */
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: {
    columns: string[];
    unique?: boolean;
  }[];
}

/**
 * Database connection config
 */
export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Database transaction context
 */
export interface TransactionContext {
  client: PoolClient;
  isTransaction: boolean;
  rollback: () => Promise<void>;
}

/**
 * Database result with metadata
 */
export interface DatabaseResult<T> {
  rows: T[];
  rowCount: number;
  command: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Sort options
 */
export interface SortOption {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Query builder result
 */
export interface QueryBuilder {
  text: string;
  values: any[];
  build(): QueryOptions;
}
