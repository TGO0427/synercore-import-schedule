// Scheduled notification service for automated email digests
import pool from '../db/connection.js';
import EmailService from './emailService.js';

export class ScheduledNotifications {
  /**
   * Send all pending daily digests
   * Should be called once daily (e.g., 8 AM)
   */
  static async sendDailyDigests() {
    try {
      console.log('⏰ [Digest Job] Starting daily digest email job...');

      // Get all users with daily frequency preference
      const usersResult = await pool.query(
        `SELECT DISTINCT user_id FROM notification_preferences
         WHERE email_enabled = true AND email_frequency = 'daily'`
      );

      if (usersResult.rows.length === 0) {
        console.log('📭 [Digest Job] No users with daily digest preference');
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const { user_id } of usersResult.rows) {
        try {
          const success = await this.buildAndSendDigest(user_id, 'daily');
          if (success) sent++;
          else failed++;
        } catch (err) {
          console.error(`Error sending daily digest for user ${user_id}:`, err);
          failed++;
        }
      }

      console.log(`✅ [Digest Job] Daily digests: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      console.error('Error in sendDailyDigests:', error);
      throw error;
    }
  }

  /**
   * Send all pending weekly digests
   * Should be called once weekly (e.g., Monday 8 AM)
   */
  static async sendWeeklyDigests() {
    try {
      console.log('⏰ [Digest Job] Starting weekly digest email job...');

      // Get all users with weekly frequency preference
      const usersResult = await pool.query(
        `SELECT DISTINCT user_id FROM notification_preferences
         WHERE email_enabled = true AND email_frequency = 'weekly'`
      );

      if (usersResult.rows.length === 0) {
        console.log('📭 [Digest Job] No users with weekly digest preference');
        return { sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const { user_id } of usersResult.rows) {
        try {
          const success = await this.buildAndSendDigest(user_id, 'weekly');
          if (success) sent++;
          else failed++;
        } catch (err) {
          console.error(`Error sending weekly digest for user ${user_id}:`, err);
          failed++;
        }
      }

      console.log(`✅ [Digest Job] Weekly digests: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    } catch (error) {
      console.error('Error in sendWeeklyDigests:', error);
      throw error;
    }
  }

  /**
   * Build and send digest for a specific user
   */
  static async buildAndSendDigest(userId, frequency) {
    try {
      const prefs = await EmailService.getPreferences(userId);
      if (!prefs?.email_enabled || prefs.email_frequency !== frequency) {
        return false;
      }

      const emailAddress = prefs.email_address || (await EmailService.getUserEmail(userId));
      if (!emailAddress) return false;

      // Get time period
      const timeRange = frequency === 'daily' ? '24 hours' : '7 days';

      // Get unprocessed events
      const eventsResult = await pool.query(
        `SELECT event_type, COUNT(*) as count, MAX(created_at) as latest
         FROM notification_digest_queue
         WHERE user_id = $1 AND processed_at IS NULL
         AND created_at > NOW() - INTERVAL '${timeRange}'
         GROUP BY event_type
         ORDER BY latest DESC`,
        [userId]
      );

      if (eventsResult.rows.length === 0) {
        return false; // No events, skip
      }

      // Get shipment details for recent events
      const shipmentsResult = await pool.query(
        `SELECT DISTINCT s.id, s.orderRef, s.supplier, s.latestStatus, COUNT(*) as event_count
         FROM notification_digest_queue ndq
         LEFT JOIN shipments s ON ndq.shipment_id = s.id
         WHERE ndq.user_id = $1 AND ndq.processed_at IS NULL
         AND ndq.created_at > NOW() - INTERVAL '${timeRange}'
         AND ndq.shipment_id IS NOT NULL
         GROUP BY s.id, s.orderRef, s.supplier, s.latestStatus
         ORDER BY COUNT(*) DESC
         LIMIT 10`,
        [userId]
      );

      // Build HTML content
      const digestDate = new Date();
      const subject = `📋 ${frequency === 'daily' ? 'Daily' : 'Weekly'} Notification Summary - ${digestDate.toLocaleDateString()}`;

      let htmlContent = `
        <h2>${frequency === 'daily' ? 'Daily' : 'Weekly'} Notification Digest</h2>
        <p><em>Summary for ${digestDate.toLocaleDateString()}</em></p>

        <h3>Event Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 0.5rem; text-align: left;">Event Type</th>
            <th style="border: 1px solid #ddd; padding: 0.5rem; text-align: center;">Count</th>
          </tr>
      `;

      let totalEvents = 0;
      eventsResult.rows.forEach(row => {
        htmlContent += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 0.5rem;">${this.formatEventType(row.event_type)}</td>
            <td style="border: 1px solid #ddd; padding: 0.5rem; text-align: center;"><strong>${row.count}</strong></td>
          </tr>
        `;
        totalEvents += parseInt(row.count);
      });

      htmlContent += `
        </table>
        <p><strong>Total Events:</strong> ${totalEvents}</p>
      `;

      // Add shipment details if available
      if (shipmentsResult.rows.length > 0) {
        htmlContent += `
          <h3>Affected Shipments</h3>
          <ul>
        `;

        shipmentsResult.rows.forEach(ship => {
          if (ship.id) {
            htmlContent += `
              <li>
                <strong>${ship.orderRef}</strong> (${ship.supplier})
                <br/>Status: ${ship.latestStatus.replace(/_/g, ' ').toUpperCase()}
                <br/>${ship.event_count} event(s)
              </li>
            `;
          }
        });

        htmlContent += `
          </ul>
        `;
      }

      htmlContent += `
        <hr/>
        <p style="font-size: 0.9em; color: #666;">
          <a href="https://synercore-import-schedule-production.up.railway.app/notifications">View all notifications</a> |
          <a href="https://synercore-import-schedule-production.up.railway.app/settings">Update preferences</a>
        </p>
      `;

      // Send email
      const result = await EmailService.sendEmail(emailAddress, subject, htmlContent);

      if (result.success) {
        // Mark as processed
        await pool.query(
          `UPDATE notification_digest_queue SET processed_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND processed_at IS NULL
           AND created_at > NOW() - INTERVAL '${timeRange}'`,
          [userId]
        );

        // Log the digest email
        await EmailService.logNotification(
          userId,
          `${frequency}_digest`,
          subject,
          htmlContent,
          null,
          'sent'
        );

        return true;
      } else {
        // Log failure
        await EmailService.logNotification(
          userId,
          `${frequency}_digest`,
          subject,
          htmlContent,
          null,
          'failed',
          result.error
        );
        return false;
      }
    } catch (error) {
      console.error('Error building/sending digest:', error);
      return false;
    }
  }

  /**
   * Check for delayed shipments and send alerts
   * Should be called daily
   */
  static async checkDelayedShipments() {
    try {
      console.log('⏰ [Delayed Job] Checking for delayed shipments...');

      // Find shipments delayed more than expected
      const delayedResult = await pool.query(
        `SELECT s.*,
                (CURRENT_TIMESTAMP - s.expected_arrival_date) as days_delayed
         FROM shipments s
         WHERE s.latestStatus NOT IN ('arrived_pta', 'arrived_klm', 'arrived_offsite', 'stored', 'received', 'completed')
         AND s.expected_arrival_date < CURRENT_TIMESTAMP - INTERVAL '1 day'
         AND s.expected_arrival_date IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM notification_log nl
           WHERE nl.shipment_id = s.id
           AND nl.event_type = 'delayed_shipment_check'
           AND nl.sent_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
         )`
      );

      if (delayedResult.rows.length === 0) {
        console.log('✅ [Delayed Job] No newly delayed shipments found');
        return { checked: 0, alerted: 0 };
      }

      let alerted = 0;

      // Notify all users for each delayed shipment
      for (const shipment of delayedResult.rows) {
        try {
          const usersResult = await pool.query(
            `SELECT user_id FROM notification_preferences
             WHERE email_enabled = true AND notify_delayed_shipment = true`
          );

          const daysDelayed = Math.floor(
            (Date.now() - new Date(shipment.expected_arrival_date)) / (1000 * 60 * 60 * 24)
          );

          for (const { user_id } of usersResult.rows) {
            try {
              await EmailService.notifyDelayedShipment(user_id, shipment, daysDelayed);
              alerted++;
            } catch (err) {
              console.error(`Error notifying user ${user_id} about delayed shipment:`, err);
            }
          }

          // Log check
          await pool.query(
            `INSERT INTO notification_log (user_id, event_type, shipment_id, subject, message, status)
             VALUES ($1, 'delayed_shipment_check', $2, 'Delayed Shipment Check', 'Checked and notified users', 'sent')`,
            [shipment.id ? usersResult.rows[0]?.user_id : null, shipment.id]
          );
        } catch (err) {
          console.error(`Error processing delayed shipment ${shipment.id}:`, err);
        }
      }

      console.log(`✅ [Delayed Job] Checked ${delayedResult.rows.length} shipments, sent ${alerted} alerts`);
      return { checked: delayedResult.rows.length, alerted };
    } catch (error) {
      console.error('Error checking delayed shipments:', error);
      throw error;
    }
  }

  /**
   * Clean up old notification logs (keep 90 days by default)
   */
  static async cleanupOldNotifications(daysToKeep = 90) {
    try {
      console.log(`⏰ [Cleanup Job] Cleaning up notifications older than ${daysToKeep} days...`);

      const result = await pool.query(
        `DELETE FROM notification_log
         WHERE sent_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
         RETURNING id`
      );

      const deletedCount = result.rows.length;
      console.log(`✅ [Cleanup Job] Deleted ${deletedCount} old notification logs`);

      return { deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }

  /**
   * Format event type for display
   */
  static formatEventType(eventType) {
    const eventLabels = {
      'shipment_arrival': '📦 Shipment Arrival',
      'inspection_failed': '❌ Inspection Failed',
      'inspection_passed': '✅ Inspection Passed',
      'warehouse_capacity': '⚠️ Warehouse Capacity',
      'delayed_shipment': '🚨 Delayed Shipment',
      'post_arrival_update': '📝 Post-Arrival Update',
      'workflow_assigned': '📋 Workflow Assigned',
      'daily_digest': '📋 Daily Digest',
      'weekly_digest': '📋 Weekly Digest'
    };

    return eventLabels[eventType] || eventType.replace(/_/g, ' ').toUpperCase();
  }
}

export default ScheduledNotifications;
