// Email notification service using nodemailer
import nodemailer from 'nodemailer';
import pool from '../db/connection.ts';
import type { Shipment } from '../types/index.js';

// Initialize email transporter
let transporter: any = null;

function initializeEmailTransporter(): void {
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
    // SendGrid support using SMTP
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else {
    // Development mode - log emails instead of sending
    console.warn('⚠️ Email not configured. Set SMTP_HOST or SENDGRID_API_KEY for production.');
    transporter = {
      sendMail: async (mailOptions: any) => {
        console.log('📧 [DEV MODE] Would send email:', mailOptions);
        return { messageId: 'dev-' + Date.now() };
      }
    };
  }
}

// Initialize on module load
initializeEmailTransporter();

interface NotificationPreferences {
  notify_shipment_arrival: boolean;
  notify_inspection_failed: boolean;
  notify_inspection_passed: boolean;
  notify_warehouse_capacity: boolean;
  notify_delayed_shipment: boolean;
  notify_post_arrival_update: boolean;
  notify_workflow_assigned: boolean;
  email_enabled: boolean;
  email_frequency: 'immediate' | 'daily' | 'weekly';
  email_address?: string | null;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface DigestEvent {
  event_type: string;
  count: number;
  latest: string;
}

export class EmailService {
  /**
   * Log notification to database
   */
  static async logNotification(
    userId: string,
    eventType: string,
    subject: string,
    message: string,
    shipmentId: string | null = null,
    status: string = 'sent',
    errorMessage: string | null = null
  ): Promise<void> {
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
  static async queueForDigest(
    userId: string,
    eventType: string,
    eventData: any,
    shipmentId: string | null = null
  ): Promise<void> {
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
  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
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
  static async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences | null> {
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
  static async sendEmail(toEmail: string, subject: string, htmlContent: string, textContent: string | null = null): Promise<EmailResult> {
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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending email:', error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send shipment arrival notification
   */
  static async notifyShipmentArrival(userId: string, shipment: Partial<Shipment>): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_shipment_arrival || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `📦 Shipment Arrived: ${shipment.order_ref}`;
    const htmlContent = `
      <h2>Shipment Arrival Notification</h2>
      <p>A shipment has arrived at the warehouse.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.order_ref}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${(shipment as any).productName || 'N/A'}</dd>
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
  static async notifyInspectionFailed(userId: string, shipment: Partial<Shipment>, failureReason: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_failed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `⚠️ Inspection Failed: ${shipment.order_ref}`;
    const htmlContent = `
      <h2>Inspection Failed - Action Required</h2>
      <p>A shipment inspection has failed and requires attention.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.order_ref}</dd>
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
  static async notifyWarehouseCapacityAlert(userId: string, warehouse: string, capacityPercent: number): Promise<void> {
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
  static async notifyDelayedShipment(userId: string, shipment: Partial<Shipment>, daysDelayed: number): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_delayed_shipment || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `🚨 Shipment Delayed: ${shipment.order_ref}`;
    const htmlContent = `
      <h2>Shipment Delay Alert</h2>
      <p>A shipment has been delayed beyond expected arrival.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.order_ref}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Days Delayed:</strong></dt>
        <dd>${daysDelayed} days</dd>
        <dt><strong>Last Status:</strong></dt>
        <dd>${shipment.latest_status}</dd>
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
  static async notifyInspectionPassed(userId: string, shipment: Partial<Shipment>): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_passed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `✅ Inspection Passed: ${shipment.order_ref}`;
    const htmlContent = `
      <h2>Inspection Passed</h2>
      <p>A shipment inspection has passed successfully.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.order_ref}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${(shipment as any).productName || 'N/A'}</dd>
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
  static async notifyShipmentRejected(userId: string, shipment: Partial<Shipment>): Promise<void> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.notify_inspection_failed || !prefs?.email_enabled) return;

    const emailAddress = prefs.email_address || (await this.getUserEmail(userId));
    if (!emailAddress) return;

    const subject = `❌ Shipment Rejected: ${shipment.order_ref}`;
    const htmlContent = `
      <h2>Shipment Rejected</h2>
      <p>A shipment has been rejected due to failed inspection.</p>
      <dl>
        <dt><strong>Order Reference:</strong></dt>
        <dd>${shipment.order_ref}</dd>
        <dt><strong>Supplier:</strong></dt>
        <dd>${shipment.supplier}</dd>
        <dt><strong>Product:</strong></dt>
        <dd>${(shipment as any).productName || 'N/A'}</dd>
        <dt><strong>Rejection Reason:</strong></dt>
        <dd>${(shipment as any).rejectionReason || 'See system for details'}</dd>
        <dt><strong>Rejected By:</strong></dt>
        <dd>${(shipment as any).rejectedBy || 'Unknown'}</dd>
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
  static async getUserEmail(userId: string): Promise<string | null> {
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
  static async sendDailyDigest(userId: string): Promise<void> {
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
      result.rows.forEach((row: DigestEvent) => {
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

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string, username: string, resetLink: string): Promise<EmailResult> {
    try {
      const subject = '🔐 Password Reset Request - Synercore Import Schedule';
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>We received a request to reset the password for your account. Click the link below to set a new password:</p>
          <p style="margin: 20px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666; font-family: monospace; font-size: 12px;">${resetLink}</p>
          <p style="color: #cc0000; font-weight: bold;">⚠️ This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't request a password reset, please ignore this email. Your account will remain secure.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 11px; text-align: center;">
            This is an automated email from Synercore Import Schedule. Please do not reply to this email.
          </p>
        </div>
      `;

      const textContent = `
Password Reset Request

Hello ${username},

We received a request to reset the password for your account. Click the link below to set a new password:

${resetLink}

⚠️ This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your account will remain secure.

---

This is an automated email from Synercore Import Schedule. Please do not reply to this email.
      `;

      return await this.sendEmail(email, subject, htmlContent, textContent);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending password reset email:', error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send cost estimate email with PDF attachment
   */
  static async sendCostEstimateEmail(
    toEmail: string,
    estimate: any,
    pdfBase64: string,
    senderName: string = 'Synercore Team'
  ): Promise<EmailResult> {
    try {
      if (!toEmail) {
        throw new Error('Email address is required');
      }

      const reference = estimate.reference_number || estimate.id;
      const supplier = estimate.supplier_name || 'N/A';
      const subject = `Import Cost Estimate - ${reference} (${supplier})`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0b1f3a;">Import Cost Estimate</h2>
          <p>Please find attached the cost estimate for your review.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Reference:</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${reference}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Supplier:</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${supplier}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Container:</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${estimate.container_type || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Port of Discharge:</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${estimate.port_of_discharge || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Costing Date:</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${estimate.costing_date || 'N/A'}</td>
            </tr>
          </table>

          <p>The full cost breakdown is in the attached PDF.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent by ${senderName}<br>
            Synercore Import Schedule
          </p>
        </div>
      `;

      const mailOptions = {
        from: process.env.NOTIFICATION_EMAIL_FROM || 'noreply@synercore.com',
        to: toEmail,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: `cost-estimate-${reference}.pdf`,
            content: pdfBase64,
            encoding: 'base64',
            contentType: 'application/pdf'
          }
        ]
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Cost estimate email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending cost estimate email:', error);
      return { success: false, error: errorMsg };
    }
  }
}

export default EmailService;
