// Migration: Add refresh_tokens table for JWT token refresh mechanism
import pool from './connection.js';

async function createRefreshTokensTable() {
  try {
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

    // Create index for faster token lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);

    console.log('✅ Refresh tokens table created successfully');
  } catch (error) {
    console.error('❌ Error creating refresh tokens table:', error.message);
    throw error;
  }
}

createRefreshTokensTable().catch(err => {
  process.exit(1);
});
