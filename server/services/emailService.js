// Email notification service using nodemailer
import nodemailer from 'nodemailer';
import pool from '../db/connection.js';

// Initialize email transporter
let transporter = null;

function initializeEmailTransporter() {
  // Support multiple email configurations
  if (process.env.SMTP_HOST) {
    // SMTP-based (Gmail, SendGrid, etc.)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  } else if (process.env.SENDGRID_API_KEY) {
    // SendGrid support
    const sgTransport = require('nodemailer-sendgrid-transport');
    transporter = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: process.env.SENDGRID_API_KEY
        }
      })
    );
  } else {
    // Development mode - log emails instead of sending
    console.warn('⚠️ Email not configured. Set SMTP_HOST or SENDGRID_API_KEY for production.');
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('📧 [DEV MODE] Would send email:', mailOptions);
        return { messageId: 'dev-' + Date.now() };
      }
    };
  }
}

// Initialize on module load
initializeEmailTransporter();

export class EmailService {
  /**
   * Log notification to database
   */
  static async logNotification(userId, eventType, subject, message, shipmentId = null, status = 'sent', errorMessage = null) {
    try {
      await pool.query(
        `INSERT INTO notification_log (user_id, event_type, shipment_id, subject, message, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, eventType, shipmentId, subject, message, status, errorMessage]
      );
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Queue event for digest (daily/weekly emails)
   */
  static async queueForDigest(userId, eventType, eventData, shipmentId = null) {
    try {
      await pool.query(
        `INSERT INTO notification_digest_queue (user_id, event_type, shipment_id, event_data)
         VALUES ($1, $2, $3, $4)`,
        [userId, eventType, shipmentId, JSON.stringify(eventData)]
      );
    } catch (error) {
      console.error('Error queueing digest notification:', error);
    }
  }

  /**
   * Get user notification preferences
   */
  static async getPreferences(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Return default preferences if not found
        return {
          notify_shipment_arrival: true,
          notify_inspection_failed: true,
          notify_inspection_passed: true,
          notify_warehouse_capacity: true,
          notify_delayed_shipment: true,
          notify_post_arrival_update: true,
          notify_workflow_assigned: true,
          email_enabled: true,
          email_frequency: 'immediate',
          email_address: null
        };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updatePreferences(userId, preferences) {
    try {
      const {
        notify_shipment_arrival,
        notify_inspection_failed,
        notify_inspection_passed,
        notify_warehouse_capacity,
        notify_delayed_shipment,
        notify_post_arrival_update,
        notify_workflow_assigned,
        email_enabled,
        email_frequency,
        email_address
      } = preferences;

      const result = await pool.query(
        `INSERT INTO notification_preferences
         (user_id, notify_shipment_arrival, notify_inspection_failed, notify_inspection_passed,
          notify_warehouse_capacity, notify_delayed_shipment, notify_post_arrival_update,
          notify_workflow_assigned, email_enabled, email_frequency, email_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET
          notify_shipment_arrival = $2,
          notify_inspection_failed = $3,
          notify_inspection_passed = $4,
          notify_warehouse_capacity = $5,
          notify_delayed_shipment = $6,
          notify_post_arrival_update = $7,
          notify_workflow_assigned = $8,
          email_enabled = $9,
          email_frequency = $10,
          email_address = $11,
          updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, notify_shipment_arrival, notify_inspection_failed, notify_inspection_passed,
         notify_warehouse_capacity, notify_delayed_shipment, notify_post_arrival_update,
         notify_workflow_assigned, email_enabled, email_frequency, email_address]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return null;
    }
  }

  /**
   * Send email notification
   */
  static async sendEmail(toEmail, subject, htmlContent, textContent = null) {
    try {
      if (!toEmail) {
        throw new Error('Email address is required');
      }

      const mailOptions = {
        from: process.env.NOTIFICATION_EMAIL_FROM || 'noreply@synercore.com',
        to: toEmail,
        subject: subject,
        html: htmlContent,
        text: textContent || htmlContent.replace(/<[^>]*>/g, '')
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send shipment arrival notification
   */
  static async notifyShipmentArrival(userId, shipment) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_shipment_arrival || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `📦 Shipment Arrived: ${shipment.orderRef}`;
    const htmlContent = `
      <h2>Shipment Arrival Notification</h2>
      <p>A shipment has arrived at the warehouse.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.orderRef}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Warehouse:</strong></dt>
        <dd>${shipment.receivingWarehouse || shipment.finalPod || 'TBD'}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${shipment.productName || 'N/A'}</dd>
        <dt><strong>Quantity:</strong></dt>
        <dd>${shipment.quantity || 'N/A'}</dd>
      </dl>
      <p><a href="https://synercore-import-schedule.vercel.app/shipments?filter=${shipment.id}">View in System</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'shipment_arrival', subject, htmlContent, shipment.id, result.success ? 'sent' : 'failed', result.error);

    if (prefs.email_frequency !== 'immediate') {
      await this.queueForDigest(userId, 'shipment_arrival', shipment, shipment.id);
    }
  }

  /**
   * Send inspection failed notification
   */
  static async notifyInspectionFailed(userId, shipment, failureReason) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_failed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `⚠️ Inspection Failed: ${shipment.orderRef}`;
    const htmlContent = `
      <h2>Inspection Failed - Action Required</h2>
      <p>A shipment inspection has failed and requires attention.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.orderRef}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Reason:</strong></dt>
        <dd>${failureReason || 'See system for details'}</dd>
      </dl>
      <p><a href="https://synercore-import-schedule.vercel.app/post-arrival">Review in Post-Arrival Workflow</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'inspection_failed', subject, htmlContent, shipment.id, result.success ? 'sent' : 'failed', result.error);
  }

  /**
   * Send warehouse capacity alert
   */
  static async notifyWarehouseCapacityAlert(userId, warehouse, capacityPercent) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_warehouse_capacity || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `⚠️ Warehouse Capacity Alert: ${warehouse}`;
    const htmlContent = `
      <h2>Warehouse Capacity Alert</h2>
      <p>A warehouse has reached high capacity levels.</p>
      <dl>
        <dt><strong>Warehouse:</strong></dt>
        <dd>${warehouse}</dd>
        <dt><strong>Capacity Usage:</strong></dt>
        <dd>${capacityPercent}%</dd>
      </dl>
      <p>Consider unloading shipments or adjusting storage allocation.</p>
      <p><a href="https://synercore-import-schedule.vercel.app/warehouse">View Warehouse Dashboard</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'warehouse_capacity', subject, htmlContent, null, result.success ? 'sent' : 'failed', result.error);
  }

  /**
   * Send delayed shipment notification
   */
  static async notifyDelayedShipment(userId, shipment, daysDelayed) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_delayed_shipment || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `🚨 Shipment Delayed: ${shipment.orderRef}`;
    const htmlContent = `
      <h2>Shipment Delay Alert</h2>
      <p>A shipment has been delayed beyond expected arrival.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.orderRef}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Days Delayed:</strong></dt>
        <dd>${daysDelayed} days</dd>
        <dt><strong>Last Status:</strong></dt>
        <dd>${shipment.latestStatus}</dd>
      </dl>
      <p>Please follow up with the supplier or logistics provider.</p>
      <p><a href="https://synercore-import-schedule.vercel.app/shipments?filter=${shipment.id}">View Details</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'delayed_shipment', subject, htmlContent, shipment.id, result.success ? 'sent' : 'failed', result.error);
  }

  /**
   * Send inspection passed notification
   */
  static async notifyInspectionPassed(userId, shipment) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_passed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `✅ Inspection Passed: ${shipment.orderRef}`;
    const htmlContent = `
      <h2>Inspection Passed</h2>
      <p>A shipment inspection has passed successfully.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.orderRef}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${shipment.productName || 'N/A'}</dd>
        <dt><strong>Warehouse:</strong></dt>
        <dd>${shipment.receivingWarehouse || shipment.finalPod || 'TBD'}</dd>
      </dl>
      <p>This shipment is ready for receiving.</p>
      <p><a href="https://synercore-import-schedule.vercel.app/post-arrival">View in Post-Arrival Workflow</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'inspection_passed', subject, htmlContent, shipment.id, result.success ? 'sent' : 'failed', result.error);
  }

  /**
   * Send shipment rejection notification
   */
  static async notifyShipmentRejected(userId, shipment) {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_failed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `❌ Shipment Rejected: ${shipment.orderRef}`;
    const htmlContent = `
      <h2>Shipment Rejected</h2>
      <p>A shipment has been rejected due to failed inspection.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.orderRef}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${shipment.productName || 'N/A'}</dd>
        <dt><strong>Rejection Reason:</strong></dt>
        <dd>${shipment.rejectionReason || 'See system for details'}</dd>
        <dt><strong>Rejected By:</strong></dt>
        <dd>${shipment.rejectedBy || 'Unknown'}</dd>
      </dl>
      <p>This shipment will be archived for record-keeping.</p>
      <p><a href="https://synercore-import-schedule.vercel.app/archives">View in Archives</a></p>
    `;

    const result = await this.sendEmail(emailAddress, subject, htmlContent);
    await this.logNotification(userId, 'inspection_failed', subject, htmlContent, shipment.id, result.success ? 'sent' : 'failed', result.error);
  }

  /**
   * Get user's email address from database
   */
  static async getUserEmail(userId) {
    try {
      const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.email || null;
    } catch (error) {
      console.error('Error getting user email:', error);
      return null;
    }
  }

  /**
   * Send daily digest email (collect all events from past 24 hours)
   */
  static async sendDailyDigest(userId) {
    try {
      const prefs = await this.getPreferences(userId);
      if (prefs?.email_frequency !== 'daily' || !prefs?.email_enabled) return;

      const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
      if (!emailAddress) return;

      // Get unprocessed events
      const result = await pool.query(
        `SELECT event_type, COUNT(*) as count, MAX(created_at) as latest
         FROM notification_digest_queue
         WHERE user_id = $1 AND processed_at IS NULL
         AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY event_type`,
        [userId]
      );

      if (result.rows.length === 0) return;

      // Build digest content
      let digestContent = '<h2>Daily Notification Digest</h2><ul>';
      result.rows.forEach(row => {
        digestContent += `<li>${row.event_type}: ${row.count} event(s)</li>`;
      });
      digestContent += '</ul>';

      const subject = `📋 Daily Summary - ${new Date().toLocaleDateString()}`;
      await this.sendEmail(emailAddress, subject, digestContent);

      // Mark as processed
      await pool.query(
        `UPDATE notification_digest_queue SET processed_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND processed_at IS NULL`,
        [userId]
      );
    } catch (error) {
      console.error('Error sending digest:', error);
    }
  }
}

export default EmailService;
