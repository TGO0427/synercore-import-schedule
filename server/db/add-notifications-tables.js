// Migration: Add notification preferences and logs tables
import pool from './connection.js';

async function createNotificationsTables() {
  try {
    // Table for user notification preferences
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        -- Event toggles
        notify_shipment_arrival BOOLEAN DEFAULT true,
        notify_inspection_failed BOOLEAN DEFAULT true,
        notify_inspection_passed BOOLEAN DEFAULT true,
        notify_warehouse_capacity BOOLEAN DEFAULT true,
        notify_delayed_shipment BOOLEAN DEFAULT true,
        notify_post_arrival_update BOOLEAN DEFAULT true,
        notify_workflow_assigned BOOLEAN DEFAULT true,
        -- Notification methods
        email_enabled BOOLEAN DEFAULT true,
        email_frequency VARCHAR(50) DEFAULT 'immediate', -- immediate, daily, weekly, never
        -- Email settings
        email_address TEXT,
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table for notification log/history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL, -- shipment_arrival, inspection_failed, etc
        shipment_id TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'sent', -- sent, failed, pending, bounced
        delivery_method VARCHAR(50) DEFAULT 'email', -- email, sms, push
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
      );
    `);

    // Table for pending digest emails (for daily/weekly rollups)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_digest_queue (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        shipment_id TEXT,
        event_data JSONB, -- store event details as JSON
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE,
        FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
      );
    `);

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(sent_at);
      CREATE INDEX IF NOT EXISTS idx_notification_log_event ON notification_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_digest_queue_user ON notification_digest_queue(user_id);
      CREATE INDEX IF NOT EXISTS idx_digest_queue_processed ON notification_digest_queue(processed_at);
    `);

    console.log('✅ Notification tables created successfully');
  } catch (error) {
    console.error('❌ Error creating notification tables:', error.message);
    throw error;
  }
}

createNotificationsTables().catch(err => {
  process.exit(1);
});
