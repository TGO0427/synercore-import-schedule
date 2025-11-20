/**
 * Database connection management
 * Handles PostgreSQL connection pooling with type-safe queries
 */

import pg from 'pg';
import type { Pool, QueryResult, PoolClient } from 'pg';
import { logInfo, logError, logQuery } from '../utils/logger.js';

const { Pool: PgPool } = pg;

let pool: Pool | null = null;

/**
 * Determine if SSL should be used based on connection string and environment
 */
function mustUseSsl(connectionString: string | undefined): boolean {
  if (!connectionString) return false;

  try {
    const u = new URL(
      connectionString.replace(/^postgres(ql)?:\/\//, 'postgresql://')
    );

    const host = u.hostname || '';
    const hasSslParam =
      (u.searchParams.get('sslmode') || '').toLowerCase() === 'require' ||
      u.searchParams.has('ssl');

    return (
      host.endsWith('.proxy.rlwy.net') || // Railway PG proxy host
      host.includes('railway') || // common heuristic
      !!process.env.RAILWAY_ENVIRONMENT || // Railway env var is present
      hasSslParam ||
      process.env.FORCE_DB_SSL === '1' // manual override if needed
    );
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (pool) return pool;

  let connectionString = process.env.DATABASE_URL;

  // Build connection string from PG* environment variables if DATABASE_URL not set
  if (!connectionString && process.env.PGHOST) {
    const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;

    if (!PGUSER || !PGPASSWORD || !PGHOST || !PGPORT || !PGDATABASE) {
      throw new Error('PG* variables incomplete. Set DATABASE_URL or all PG vars.');
    }

    connectionString = `postgresql://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
    console.log('Built DATABASE_URL from individual PG variables');
  }

  if (!connectionString) {
    throw new Error('DATABASE_URL not set and PG* vars missing.');
  }

  // Debug: log connection details (hide password)
  const debugUrl = connectionString.replace(/:[^:@]+@/, ':****@');
  console.log(`Connecting to: ${debugUrl}`);
  console.log(`DATABASE_URL env var: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`PGHOST env var: ${process.env.PGHOST || 'NOT SET'}`);

  const useSsl = mustUseSsl(connectionString);

  interface SslConfig {
    rejectUnauthorized: boolean;
    checkServerIdentity: () => undefined;
  }

  const sslConfig: SslConfig | false = useSsl
    ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined // Skip hostname verification
      }
    : false;

  pool = new PgPool({
    connectionString,
    ssl: sslConfig as any,
    max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(
      process.env.PG_CONNECTION_TIMEOUT_MS || '10000',
      10
    ),
    keepAlive: true
  });

  pool.on('error', (err: Error) => {
    logError('Unexpected PG pool error', err);
  });

  console.log(`✓ Database pool created (ssl=${useSsl ? 'on' : 'off'})`);
  return pool;
}

/**
 * Execute a query with type-safe results
 */
export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPool();
  const start = Date.now();

  try {
    const res = await (p.query as any)(text, params) as QueryResult<T>;
    const duration = Date.now() - start;

    // Log query execution
    const preview = (text || '').replace(/\s+/g, ' ').slice(0, 120);
    logQuery(preview, duration, res.rowCount || 0, {
      isDevelopment: process.env.NODE_ENV === 'development'
    });

    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logError('Database query error', error as Error, {
      duration,
      query: text.slice(0, 100)
    });
    throw error;
  }
}

/**
 * Execute a query and return first result or null
 */
export async function queryOne<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all results
 */
export async function queryAll<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logError('Transaction failed', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logInfo('Database pool closed');
  }
}

/**
 * Graceful shutdown for Railway redeploys
 */
process.on('SIGTERM', async () => {
  try {
    await closePool();
  } finally {
    process.exit(0);
  }
});

export default {
  getPool,
  query,
  queryOne,
  queryAll,
  transaction,
  closePool
};
