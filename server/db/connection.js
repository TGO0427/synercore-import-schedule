import pg from 'pg';
const { Pool } = pg;

// Database connection pool
let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
