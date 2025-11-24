# Email Notification System - Complete Implementation Guide

## Overview

This document describes the complete email notification system for the Synercore Import Schedule application. The system provides automated email alerts for critical shipment events, customizable notification preferences, and scheduled digest emails.

## Architecture

### Components

1. **EmailService** (`server/services/emailService.js`)
   - Core service for sending emails
   - Manages notification preferences
   - Logs notification history
   - Supports multiple email providers (SMTP, SendGrid)

2. **ScheduledNotifications** (`server/services/scheduledNotifications.js`)
   - Handles automated digest generation
   - Checks for delayed shipments
   - Cleans up old notification logs
   - Builds HTML email content

3. **NotificationScheduler** (`server/jobs/notificationScheduler.js`)
   - Manages cron jobs for automated tasks
   - Initializes scheduled jobs on server startup
   - Provides manual job triggering for testing

4. **Notification Routes** (`server/routes/notifications.js`)
   - User endpoints for managing preferences
   - Viewing notification history
   - Testing email delivery
   - Getting notification statistics

5. **Scheduler Admin Routes** (`server/routes/schedulerAdmin.js`)
   - Admin endpoints for scheduler management
   - Viewing and triggering jobs
   - Bulk updating user preferences
   - Collecting scheduler statistics

### Frontend Components

1. **NotificationPreferences** (`src/components/NotificationPreferences.jsx`)
   - User interface for customizing notification settings
   - Event type toggles (arrival, inspection, capacity, etc.)
   - Email frequency selection (immediate, daily, weekly)
   - Email address configuration
   - Test email functionality

2. **NotificationHistory** (`src/components/NotificationHistory.jsx`)
   - Displays past notifications
   - Filter by event type
   - Pagination for browsing history
   - Delete old notifications

### Database Tables

**notification_preferences**
- Stores per-user notification settings
- Event type toggles
- Email frequency preference
- Custom email address

**notification_log**
- Complete history of sent notifications
- Event type and status tracking
- Error logging for failed sends
- Timestamp of delivery

**notification_digest_queue**
- Queue for pending digest emails
- Event data in JSON format
- Processed status tracking

## Configuration

### Environment Variables

```env
# SMTP Configuration (Gmail, Office 365, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# OR SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Email settings
NOTIFICATION_EMAIL_FROM=noreply@synercore.com
FRONTEND_URL=https://your-domain.com
```

### Gmail Setup (Example)

1. Enable 2-Factor Authentication
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password in `SMTP_PASSWORD`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-character app password
```

## Scheduled Jobs

### Daily Digest (8:00 AM UTC)
- Collects all notifications from past 24 hours
- Groups by event type
- Includes affected shipment details
- Sends to users with "daily" frequency preference

### Weekly Digest (Monday 8:00 AM UTC)
- Collects all notifications from past 7 days
- Sends to users with "weekly" frequency preference

### Delayed Shipment Check (9:00 AM UTC)
- Identifies shipments overdue for arrival
- Sends alerts to all interested users
- Prevents duplicate alerts within 24 hours

### Cleanup (Sunday 2:00 AM UTC)
- Deletes notification logs older than 90 days
- Reduces database size
- Keeps compliance records

## Event Types and Triggers

### Automatic Email Events

| Event Type | Trigger | Notification Example |
|----------|---------|---------------------|
| **Shipment Arrival** | Shipment status changes to "arrived" | 📦 Shipment Arrived: ORD-12345 |
| **Inspection Failed** | Inspection fails in post-arrival workflow | ❌ Inspection Failed: ORD-12345 |
| **Inspection Passed** | Inspection passes successfully | ✅ Inspection Passed: ORD-12345 |
| **Warehouse Capacity** | Warehouse reaches >80% capacity | ⚠️ Warehouse Capacity Alert |
| **Delayed Shipment** | Shipment exceeds expected arrival date | 🚨 Shipment Delayed: ORD-12345 |
| **Post-Arrival Update** | Workflow updates (inspection status changes) | 📝 Post-Arrival Update |
| **Workflow Assigned** | User assigned a workflow task | 📋 Workflow Assigned |

## API Endpoints

### User Notification Endpoints

#### GET `/api/notifications/preferences`
Get user's notification preferences
```json
{
  "notify_shipment_arrival": true,
  "notify_inspection_failed": true,
  "email_enabled": true,
  "email_frequency": "daily",
  "email_address": "user@example.com"
}
```

#### PUT `/api/notifications/preferences`
Update notification preferences
```json
{
  "notify_shipment_arrival": true,
  "email_frequency": "weekly",
  "email_address": "new-email@example.com"
}
```

#### GET `/api/notifications/history?limit=50&offset=0&eventType=shipment_arrival`
Get notification history with filtering and pagination

#### DELETE `/api/notifications/history/:id`
Delete a specific notification

#### POST `/api/notifications/test`
Send a test email to verify configuration

#### GET `/api/notifications/stats`
Get personal notification statistics

### Admin Scheduler Endpoints

#### GET `/api/admin/scheduler/status`
Get status of all scheduled jobs
```json
{
  "jobs": [
    { "name": "daily-digest", "running": true },
    { "name": "weekly-digest", "running": true },
    { "name": "delayed-check", "running": true },
    { "name": "cleanup", "running": true }
  ]
}
```

#### POST `/api/admin/scheduler/trigger/:jobName`
Manually trigger a job (for testing)
- Valid job names: `daily-digest`, `weekly-digest`, `delayed-check`, `cleanup`

#### GET `/api/admin/scheduler/logs?limit=50&eventType=daily_digest`
Get scheduler job execution logs

#### GET `/api/admin/scheduler/stats`
Get comprehensive notification statistics
```json
{
  "total": { "total": 1000, "sent": 950, "failed": 50 },
  "byType": [
    { "event_type": "shipment_arrival", "count": 200, "sent": 195, "failed": 5 }
  ],
  "usersWithEmailEnabled": 85,
  "byFrequency": [
    { "email_frequency": "immediate", "count": 50 },
    { "email_frequency": "daily", "count": 30 },
    { "email_frequency": "weekly", "count": 5 }
  ]
}
```

#### POST `/api/admin/scheduler/preferences/bulk`
Bulk update preferences for multiple users
```json
{
  "targetUsers": ["user1", "user2", "user3"],
  "updates": {
    "notify_shipment_arrival": true,
    "email_enabled": true,
    "email_frequency": "daily"
  }
}
```

## Integration Points

### Shipments Controller

When a shipment's status changes, notifications are automatically triggered:

```javascript
// In shipmentsController.js

// Send arrival notification
await EmailService.notifyShipmentArrival(userId, shipment);

// Send inspection notifications
if (shipment.latestStatus === 'inspection_failed') {
  await EmailService.notifyInspectionFailed(userId, shipment, failureReason);
} else if (shipment.latestStatus === 'inspection_passed') {
  await EmailService.notifyInspectionPassed(userId, shipment);
}
```

### Warehouse Capacity

When capacity is updated:

```javascript
// Trigger notification if capacity > 80%
const capacityPercent = (binsUsed / totalCapacity) * 100;
if (capacityPercent > 80) {
  await EmailService.notifyWarehouseCapacityAlert(userId, warehouseName, capacityPercent);
}
```

## Role-Based Customization

### Notification Preferences by Role

**Admin Users**
- Can view all user notification statistics
- Can trigger scheduler jobs manually
- Can bulk update preferences for user groups
- Can access scheduler logs

**Regular Users**
- Can customize their notification settings
- Can view their notification history
- Can receive immediate, daily, or weekly digests
- Can disable notifications entirely

## Testing

### Manual Testing Steps

1. **Test Email Delivery**
   ```bash
   # Click "Send Test Email" in Notification Preferences
   # Check inbox for test email
   ```

2. **Manual Job Trigger**
   ```bash
   POST /api/admin/scheduler/trigger/daily-digest
   # Returns results of digest job
   ```

3. **Check Scheduler Status**
   ```bash
   GET /api/admin/scheduler/status
   # Returns status of all cron jobs
   ```

4. **View Notification History**
   ```bash
   GET /api/notifications/history?limit=20
   # Lists last 20 notifications
   ```

## Monitoring

### Check Notification Health

1. **Admin Dashboard**
   - View `/api/admin/scheduler/stats`
   - Check sent vs failed ratio
   - Monitor notification volume trends

2. **Log Files**
   - Check server logs for scheduler messages
   - Look for error indicators
   - Verify job execution timestamps

3. **Database Queries**
   ```sql
   -- Recent notification activity
   SELECT event_type, status, COUNT(*)
   FROM notification_log
   WHERE sent_at > NOW() - INTERVAL '24 hours'
   GROUP BY event_type, status;

   -- Failed emails
   SELECT * FROM notification_log
   WHERE status = 'failed'
   ORDER BY sent_at DESC
   LIMIT 10;

   -- Digest queue status
   SELECT user_id, COUNT(*) as pending_events
   FROM notification_digest_queue
   WHERE processed_at IS NULL
   GROUP BY user_id;
   ```

## Troubleshooting

### Email Not Sending

1. **Check Configuration**
   - Verify `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` are set
   - Test with `/api/notifications/test` endpoint
   - Check server logs for error messages

2. **Gmail Specific**
   - Use App Password (not regular password)
   - Enable "Less secure apps" access (if not using 2FA)
   - Check for "Sign in attempt blocked" notifications

3. **Verify Email Address**
   - Ensure user has email in preferences
   - Check `email_enabled` is `true`
   - Verify email format is valid

### Scheduler Not Running

1. **Check Server Logs**
   ```
   Look for "Notification scheduler initialized" message
   Check for "Error initializing notification scheduler"
   ```

2. **Verify Node Version**
   - node-cron requires Node.js 10+
   - Check with `node --version`

3. **Manual Trigger**
   ```bash
   POST /api/admin/scheduler/trigger/daily-digest
   # If this works, scheduler infrastructure is OK
   # Problem might be with cron timing
   ```

### High Failure Rate

1. **Check Email Provider**
   - Verify SendGrid/SMTP service is available
   - Check rate limits haven't been exceeded
   - Review provider logs

2. **Database Issues**
   - Verify notification tables exist
   - Check database connection
   - Monitor query performance

3. **Email Content**
   - Verify HTML content is valid
   - Check for encoding issues
   - Test with different email clients

## Performance Considerations

### Database Indexes
Indexes are automatically created for:
- `notification_preferences(user_id)`
- `notification_log(user_id, sent_at, event_type)`
- `notification_digest_queue(user_id, processed_at)`

### Cleanup Retention
- Notification logs kept for 90 days by default
- Digest queue cleared after processing
- Adjust `cleanupOldNotifications(days)` as needed

### Email Sending
- Notifications sent asynchronously
- Failures don't block shipment operations
- Retry logic not implemented (can add if needed)

## Future Enhancements

1. **SMS Notifications**
   - Add Twilio integration
   - New SMS preference toggles
   - Alert critical events via SMS

2. **Push Notifications**
   - Web push via Service Workers
   - Mobile app push (Firebase)
   - Real-time in-app notifications

3. **Email Templates**
   - Advanced HTML templates
   - Logo/branding customization
   - Multi-language support

4. **Retry Logic**
   - Exponential backoff for failures
   - Max retry attempts
   - Dead letter queue for failed sends

5. **Notification Analytics**
   - Open rates (pixel tracking)
   - Click tracking
   - Delivery time optimization

## Support & Documentation

For issues or questions:
1. Check server logs for error messages
2. Review this guide's troubleshooting section
3. Test with manual endpoints
4. Check database for notification records

---

**Last Updated:** 2024
**Status:** Production Ready
