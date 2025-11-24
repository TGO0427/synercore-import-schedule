#!/usr/bin/env node

/**
 * Migration: Add password reset token columns to users table
 * Supports self-service password reset functionality
 */

import db from './connection.js';

async function addPasswordResetColumns() {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Add reset token columns
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
    `);

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)
      WHERE reset_token IS NOT NULL;
    `);

    await client.query('COMMIT');

    console.log('✅ Password reset columns added successfully');
    console.log('   - reset_token VARCHAR(255)');
    console.log('   - reset_token_expiry TIMESTAMP');
    console.log('   - Index: idx_users_reset_token');

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');

    // Check if columns already exist
    if (error.message.includes('column "reset_token" of relation "users" already exists')) {
      console.log('ℹ️  Password reset columns already exist');
      process.exit(0);
    }

    console.error('❌ Error adding password reset columns:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

addPasswordResetColumns();
