// POPIA retention scheduler — purges stale personal data nightly.
// Retention periods are overridable via env vars so compliance owners
// can tune them without a code change.
import cron from 'cron';
import pool from '../db/connection.js';

const LOGIN_ACTIVITY_DAYS = parseInt(process.env.LOGIN_ACTIVITY_RETENTION_DAYS || '365', 10);
const REFRESH_TOKEN_GRACE_DAYS = parseInt(process.env.REFRESH_TOKEN_RETENTION_DAYS || '30', 10);
const PENDING_REGISTRATION_DAYS = parseInt(process.env.PENDING_REGISTRATION_TTL_DAYS || '90', 10);

let scheduledJobs = [];

async function purgeLoginActivity() {
  const result = await pool.query(
    `DELETE FROM login_activity
     WHERE login_at < NOW() - ($1::int || ' days')::interval
     RETURNING id`,
    [LOGIN_ACTIVITY_DAYS]
  );
  console.log(`[Retention] Purged ${result.rowCount} login_activity rows older than ${LOGIN_ACTIVITY_DAYS} days`);
}

async function purgeExpiredRefreshTokens() {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW() - ($1::int || ' days')::interval
        OR revoked_at < NOW() - ($1::int || ' days')::interval
     RETURNING id`,
    [REFRESH_TOKEN_GRACE_DAYS]
  );
  console.log(`[Retention] Purged ${result.rowCount} expired/revoked refresh_tokens older than ${REFRESH_TOKEN_GRACE_DAYS} days`);
}

async function purgeAbandonedRegistrations() {
  // Only users who registered, were never approved, and have no shipment/audit activity.
  const result = await pool.query(
    `DELETE FROM users
     WHERE is_active = false
       AND created_at < NOW() - ($1::int || ' days')::interval
       AND NOT EXISTS (SELECT 1 FROM audit_log WHERE audit_log.user_id = users.id)
     RETURNING id`,
    [PENDING_REGISTRATION_DAYS]
  );
  console.log(`[Retention] Purged ${result.rowCount} abandoned pending registrations older than ${PENDING_REGISTRATION_DAYS} days`);
}

export class RetentionScheduler {
  static async runOnce() {
    console.log('[Retention] Running retention sweep...');
    try {
      await purgeLoginActivity();
      await purgeExpiredRefreshTokens();
      await purgeAbandonedRegistrations();
      console.log('[Retention] Sweep complete');
    } catch (err) {
      console.error('[Retention] Sweep failed:', err);
    }
  }

  static initializeJobs() {
    console.log('[Retention] Scheduling daily retention job for 03:00');
    const job = cron.schedule('0 3 * * *', () => { RetentionScheduler.runOnce(); });
    scheduledJobs.push({ name: 'retention-sweep', job });
  }

  static stopAllJobs() {
    scheduledJobs.forEach(({ job }) => job.stop());
    scheduledJobs = [];
  }
}

export default RetentionScheduler;
