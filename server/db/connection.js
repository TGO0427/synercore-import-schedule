import pg from 'pg';
const { Pool } = pg;

// Database connection pool
let pool = null;

export function getPool() {
    if (!pool) {
      // Build connection string from individual vars or use DATABASE_URL
      let connectionString = process.env.DATABASE_URL;

      if (!connectionString && process.env.PGHOST) {
        const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;
        connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
        console.log('Built DATABASE_URL from individual PG variables');
      }

      if (!connectionString) {
        console.warn('⚠️  DATABASE_URL environment variable is not set');
        throw new Error('DATABASE_URL or PG variables are not set');
      }

      pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased from 2000 to 10000ms
      });

      pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
      });

      console.log('✓ Database connection pool created');
    }

    return pool;
  }

export async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✓ Database connection pool closed');
  }
}

export default { getPool, query, closePool };
