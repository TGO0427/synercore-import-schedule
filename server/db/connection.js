// server/db/connection.js
import pg from 'pg';
const { Pool } = pg;

let pool = null;

function mustUseSsl(connectionString) {
  // Force SSL on Railway even if sslmode isn't in the URL
  if (!connectionString) return false;
  try {
    const u = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'postgresql://'));
    const host = u.hostname || '';
    const hasSslParam =
      (u.searchParams.get('sslmode') || '').toLowerCase() === 'require' ||
      u.searchParams.has('ssl'); // some ORMs set ssl=true
    return (
      host.endsWith('.proxy.rlwy.net') ||            // Railway PG proxy host
      host.includes('railway') ||                    // common heuristic
      process.env.RAILWAY_ENVIRONMENT ||             // Railway env var is present
      hasSslParam ||
      process.env.FORCE_DB_SSL === '1'               // manual override if needed
    );
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function getPool() {
  if (pool) return pool;

  let connectionString = process.env.DATABASE_URL;

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

  const useSsl = mustUseSsl(connectionString);

  const sslConfig = useSsl
    ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined // Skip hostname verification
      }
    : false;

  pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '10000', 10),
    keepAlive: true,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PG pool error:', err);
  });

  console.log(`✓ Database pool created (ssl=${useSsl ? 'on' : 'off'})`);
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    // Avoid logging full SQL in prod
    const preview = (text || '').replace(/\s+/g, ' ').slice(0, 120);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { sql: preview, durationMs: duration, rows: res.rowCount });
    } else {
      console.log('Executed query', { durationMs: duration, rows: res.rowCount });
    }
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
    console.log('✓ Database pool closed');
  }
}

// Graceful shutdown for Railway redeploys
process.on('SIGTERM', async () => {
  try {
    await closePool();
  } finally {
    process.exit(0);
  }
});

export default { getPool, query, closePool };
