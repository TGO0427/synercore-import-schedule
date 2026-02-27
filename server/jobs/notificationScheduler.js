// Notification scheduler - sets up cron jobs for automated notifications
import cron from 'cron';
import ScheduledNotifications from '../services/scheduledNotifications.js';

let scheduledJobs = [];

export class NotificationScheduler {
  /**
   * Initialize all scheduled notification jobs
   */
  static initializeJobs() {
    console.log('🚀 [Scheduler] Initializing notification jobs...');

    try {
      // Daily digest at 8 AM
      const dailyDigestJob = cron.schedule('0 8 * * *', async () => {
        console.log('⏰ [Scheduler] Running daily digest job...');
        try {
          await ScheduledNotifications.sendDailyDigests();
        } catch (err) {
          console.error('Error in daily digest job:', err);
        }
      });
      scheduledJobs.push({ name: 'daily-digest', job: dailyDigestJob });

      // Weekly digest every Monday at 8 AM
      const weeklyDigestJob = cron.schedule('0 8 * * 1', async () => {
        console.log('⏰ [Scheduler] Running weekly digest job...');
        try {
          await ScheduledNotifications.sendWeeklyDigests();
        } catch (err) {
          console.error('Error in weekly digest job:', err);
        }
      });
      scheduledJobs.push({ name: 'weekly-digest', job: weeklyDigestJob });

      // Check for delayed shipments daily at 9 AM
      const delayedCheckJob = cron.schedule('0 9 * * *', async () => {
        console.log('⏰ [Scheduler] Running delayed shipment check job...');
        try {
          await ScheduledNotifications.checkDelayedShipments();
        } catch (err) {
          console.error('Error in delayed check job:', err);
        }
      });
      scheduledJobs.push({ name: 'delayed-check', job: delayedCheckJob });

      // Clean up old notifications every Sunday at 2 AM
      const cleanupJob = cron.schedule('0 2 * * 0', async () => {
        console.log('⏰ [Scheduler] Running cleanup job...');
        try {
          await ScheduledNotifications.cleanupOldNotifications(90);
        } catch (err) {
          console.error('Error in cleanup job:', err);
        }
      });
      scheduledJobs.push({ name: 'cleanup', job: cleanupJob });

      // Process scheduled reports every hour
      const scheduledReportsJob = cron.schedule('0 * * * *', async () => {
        console.log('[Scheduler] Checking scheduled reports...');
        try {
          const { default: pool } = await import('../db/connection.js');
          const result = await pool.query(
            `SELECT * FROM scheduled_reports WHERE enabled = true AND next_send_at <= NOW()`
          );

          for (const report of result.rows) {
            try {
              console.log(`[Scheduler] Processing scheduled report ${report.id}: ${report.report_type}`);

              // Calculate next send time
              let nextSend;
              const now = new Date();
              if (report.frequency === 'daily') {
                nextSend = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                nextSend.setHours(8, 0, 0, 0);
              } else if (report.frequency === 'weekly') {
                nextSend = new Date(now.getTime());
                nextSend.setDate(nextSend.getDate() + 7);
                nextSend.setHours(8, 0, 0, 0);
              } else {
                nextSend = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0);
              }

              // Update last_sent_at and next_send_at
              await pool.query(
                `UPDATE scheduled_reports SET last_sent_at = NOW(), next_send_at = $1, updated_at = NOW() WHERE id = $2`,
                [nextSend, report.id]
              );

              // Send to recipients
              const recipients = typeof report.recipients === 'string' ? JSON.parse(report.recipients) : (report.recipients || []);
              if (recipients.length > 0) {
                const { default: EmailService } = await import('../services/emailService.js');
                for (const email of recipients) {
                  await EmailService.sendEmail(
                    email,
                    `Scheduled Report: ${report.report_type} (${report.frequency})`,
                    `<h2>${report.report_type} Report</h2><p>This is your scheduled ${report.frequency} report. Please log in to view the full report.</p><p><a href="${process.env.FRONTEND_URL || 'https://synercore-import-schedule.vercel.app'}/reports">View Report</a></p>`
                  );
                }
              }

              console.log(`[Scheduler] Scheduled report ${report.id} processed`);
            } catch (err) {
              console.error(`Error processing scheduled report ${report.id}:`, err);
            }
          }
        } catch (err) {
          console.error('Error in scheduled reports job:', err);
        }
      });
      scheduledJobs.push({ name: 'scheduled-reports', job: scheduledReportsJob });

      console.log(`✅ [Scheduler] ${scheduledJobs.length} notification jobs initialized successfully`);
      console.log('📅 Job Schedule:');
      console.log('   - Daily Digest: 8:00 AM UTC');
      console.log('   - Weekly Digest: Monday 8:00 AM UTC');
      console.log('   - Delayed Shipment Check: 9:00 AM UTC');
      console.log('   - Cleanup: Sunday 2:00 AM UTC');
      console.log('   - Scheduled Reports: Every hour');

      return scheduledJobs;
    } catch (error) {
      console.error('Error initializing notification scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  static stopJobs() {
    console.log('⏹️  [Scheduler] Stopping all notification jobs...');
    scheduledJobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`  ✓ Stopped: ${name}`);
    });
    scheduledJobs = [];
  }

  /**
   * Get current job status
   */
  static getJobStatus() {
    return scheduledJobs.map(({ name, job }) => ({
      name,
      running: job._status === 'started'
    }));
  }

  /**
   * Manually trigger a job (for testing/admin)
   */
  static async triggerJob(jobName) {
    try {
      console.log(`🔔 [Scheduler] Manually triggering job: ${jobName}`);

      switch (jobName) {
        case 'daily-digest':
          return await ScheduledNotifications.sendDailyDigests();
        case 'weekly-digest':
          return await ScheduledNotifications.sendWeeklyDigests();
        case 'delayed-check':
          return await ScheduledNotifications.checkDelayedShipments();
        case 'cleanup':
          return await ScheduledNotifications.cleanupOldNotifications(90);
        case 'scheduled-reports':
          console.log('[Scheduler] Manually triggered scheduled reports processing');
          return { message: 'Scheduled reports check triggered' };
        default:
          throw new Error(`Unknown job: ${jobName}`);
      }
    } catch (error) {
      console.error(`Error triggering job ${jobName}:`, error);
      throw error;
    }
  }
}

export default NotificationScheduler;
