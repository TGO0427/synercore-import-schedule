# Email Configuration Setup Guide

## Overview

The notification system is ready to send emails, but **you must configure an email provider** first. This guide shows you how to set up email sending in 5 minutes.

## Current Status

**Without Email Configuration:**
- ✅ Notification preferences UI works
- ✅ Database stores preferences
- ✅ System ready for notifications
- ❌ **Emails won't actually send** (dev mode only)
- ❌ Test emails won't reach your inbox

**What happens now:**
Emails are logged to server console instead of sent:
```
📧 [DEV MODE] Would send email: { to: 'user@example.com', subject: '🧪 Test Email' }
```

---

## Quick Start: Choose Your Email Provider

### 🟢 Option 1: Gmail (Easiest - Recommended)

**Time needed:** 5 minutes
**Cost:** Free (uses your Gmail account)
**Best for:** Small teams, testing, personal use

#### Step 1: Create Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with your Google account
3. If prompted: Enable 2-Factor Authentication first
4. Select:
   - App: **Mail**
   - Device: **Windows Computer** (or your device)
5. Click **Generate**
6. Copy the **16-character password** that appears

Example: `xxxx xxxx xxxx xxxx`

#### Step 2: Add to Railway

1. Open your Railway project: https://railway.app/
2. Click your project name
3. Go to **Variables** tab
4. Click **New Variable** and add each:

| Key | Value |
|-----|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASSWORD` | `xxxx xxxx xxxx xxxx` |
| `NOTIFICATION_EMAIL_FROM` | `noreply@your-email.com` |

**Example filled out:**
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_SECURE = false
SMTP_USER = john.doe@gmail.com
SMTP_PASSWORD = abcd efgh ijkl mnop
NOTIFICATION_EMAIL_FROM = noreply@john.doe@gmail.com
```

#### Step 3: Deploy

1. Railway automatically detects variable changes
2. Wait 1-2 minutes for server restart
3. Check logs - should see: ✓ Email service initialized
4. Test in app: Click "Send Test Email"
5. Check your inbox!

**Common Gmail Issues:**
- **"Invalid credentials"** → Use App Password, not regular password
- **"Connection refused"** → Make sure port 587 is not blocked
- **"No email received"** → Check spam folder
- **"Less secure apps"** → Not needed with App Password

---

### 🟦 Option 2: SendGrid (Most Reliable)

**Time needed:** 10 minutes
**Cost:** Free tier (100 emails/day), then paid
**Best for:** Production, higher volume, deliverability important

#### Step 1: Create SendGrid Account

1. Go to: https://sendgrid.com/free
2. Sign up for free account
3. Verify your email
4. Complete account setup

#### Step 2: Create API Key

1. Log in to SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it: `Synercore Notifications`
5. Copy the key (starts with `SG.`)
6. **Save it immediately** - you can't view it again!

#### Step 3: Add to Railway

1. Open Railway project
2. Go to **Variables** tab
3. Add this single variable:

| Key | Value |
|-----|-------|
| `SENDGRID_API_KEY` | `SG.your-api-key-here` |

**Example:**
```
SENDGRID_API_KEY = SG.abcdef1234567890ghijklmnop
```

#### Step 4: Deploy

1. Railway auto-detects change
2. Wait 1-2 minutes for restart
3. Test: Click "Send Test Email"
4. Check inbox!

**SendGrid Advantages:**
- More reliable delivery
- Better analytics
- Higher sending limits
- Professional service

---

### 🟪 Option 3: Office 365 / Microsoft Exchange

**Time needed:** 5 minutes
**Cost:** Free (if your organization provides it)
**Best for:** Enterprise, company email

#### Step 1: Get Credentials

Use your work email address and password:
- Email: `your-name@company.com`
- Password: Your company password (or app-specific password if required)

#### Step 2: Add to Railway

| Key | Value |
|-----|-------|
| `SMTP_HOST` | `smtp.office365.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `your-name@company.com` |
| `SMTP_PASSWORD` | `your-password` |
| `NOTIFICATION_EMAIL_FROM` | `your-name@company.com` |

#### Step 3: Deploy and Test

Wait for restart, then test email sending.

---

### 🟨 Option 4: Other SMTP Providers

Works with any SMTP-compatible provider:

**Popular options:**
- AWS SES
- Mailgun
- Postmark
- Brevo (formerly Sendinblue)
- Your hosting provider's SMTP

**Setup pattern:**
```
SMTP_HOST = smtp.provider.com
SMTP_PORT = 587 (or 465 for secure)
SMTP_SECURE = false (or true for port 465)
SMTP_USER = your-username
SMTP_PASSWORD = your-password
NOTIFICATION_EMAIL_FROM = sender@example.com
```

Check your provider's documentation for exact SMTP settings.

---

## Verification Checklist

After adding variables to Railway:

- [ ] Variables saved in Railway dashboard
- [ ] Server has restarted (check logs for "Email service initialized")
- [ ] Notification Preferences page loads without errors
- [ ] Can enter email address in preferences
- [ ] "Send Test Email" button is enabled
- [ ] Clicked "Send Test Email"
- [ ] **Test email arrived in inbox** ✅

---

## Testing the System

### Step 1: Open App and Go to Preferences

1. Log in to your app
2. Click **📧 Notification Preferences** in sidebar

### Step 2: Configure Preferences

1. Check "Enable email notifications"
2. Select event types you want:
   - ✅ Shipment Arrival
   - ✅ Inspection Failed
   - ✅ Inspection Passed
   - etc.
3. Choose frequency: **Immediate** (to test)
4. Enter your email address
5. Click **Save Preferences**

### Step 3: Send Test Email

1. Click **Send Test Email** button
2. Wait 2-3 seconds
3. Check your inbox (and spam folder!)
4. You should see: **🧪 Test Email from Synercore**

**If test email didn't arrive:**
- Check spam/junk folder
- Check if email provider is working (test from their dashboard)
- Review Railway logs for errors
- Verify credentials are exactly correct

---

## Troubleshooting

### Problem: "Send Test Email" button is greyed out

**Cause:** Email not enabled or no email address set
**Fix:**
1. Check "Enable email notifications"
2. Enter email address
3. Save preferences
4. Button should enable

---

### Problem: Error after clicking "Send Test Email"

**Possible causes and solutions:**

#### 1. "No email address configured"
- Make sure you entered an email in preferences
- Click Save before testing

#### 2. "SMTP authentication failed"
- Double-check SMTP_USER and SMTP_PASSWORD are exactly right
- For Gmail: Use 16-character App Password, not regular password
- For Office 365: Try your full email address as username

#### 3. "Connection refused" or "timeout"
- Verify SMTP_HOST is spelled correctly
- Check SMTP_PORT matches (usually 587)
- Contact your IT/email provider if ports are blocked

#### 4. Email sent but not received
- Check spam/junk folder
- Add sender to contacts: `noreply@your-domain.com`
- Check that NOTIFICATION_EMAIL_FROM is valid

---

### Problem: Notification emails not sending when shipments change

**This is normal** if you haven't set up email yet (dev mode).

**After configuring email:**
1. Ensure preferences are saved for your user
2. Create/update a shipment
3. Check inbox and spam folder
4. Allow 5-10 seconds for email to send
5. Check server logs for any errors

---

## Railway Environment Variables Reference

### Gmail Configuration (Easiest)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
NOTIFICATION_EMAIL_FROM=noreply@your-email.com
```

### SendGrid Configuration (Most Reliable)

```
SENDGRID_API_KEY=SG.your-api-key-here
NOTIFICATION_EMAIL_FROM=noreply@your-domain.com
```

### Optional: Custom From Address

```
NOTIFICATION_EMAIL_FROM=notifications@your-company.com
```

---

## What Happens After Configuration

### Automatic Emails Sent:

**Immediately** when events occur:
- 📦 Shipment arrival
- ❌ Inspection failure
- ✅ Inspection pass
- ⚠️ Warehouse capacity alert
- 🚨 Delayed shipment detection

**Scheduled (automatic)**:
- 📋 **Daily Digest** - 8:00 AM UTC (if daily preference set)
- 📋 **Weekly Digest** - Monday 8:00 AM UTC (if weekly preference set)

### Email Examples

#### Shipment Arrival Email
```
Subject: 📦 Shipment Arrived: ORD-12345

Dear User,

A shipment has arrived at the warehouse.

Order Reference: ORD-12345
Supplier: Acme Corp
Warehouse: PTA
Product: Electronics
Quantity: 100 units

[View in System]
```

#### Daily Digest Email
```
Subject: 📋 Daily Summary - Dec 19, 2024

Daily Notification Digest

Event Summary:
- Shipment Arrival: 5 events
- Inspection Passed: 3 events
- Warehouse Capacity: 1 event

Total Events: 9

[View all notifications]
```

---

## Security Best Practices

### Do's ✅

- ✅ Use app-specific passwords (Gmail, Office 365)
- ✅ Keep API keys secret (never commit to git)
- ✅ Use strong passwords
- ✅ Restrict email sender permissions to minimum needed
- ✅ Monitor sending logs for abuse
- ✅ Use HTTPS for all communication

### Don'ts ❌

- ❌ Don't use regular passwords for Gmail (use App Password)
- ❌ Don't hardcode credentials in code (use environment variables)
- ❌ Don't share API keys or passwords
- ❌ Don't commit `.env` files to git
- ❌ Don't use test credentials in production

---

## Monitoring Email Health

### Check Notification Status

1. Go to app → Notification Preferences
2. Click "Send Test Email"
3. Wait 5 seconds and check inbox

### View Notification History

1. In sidebar → Notification History (once added to UI)
2. See all past emails sent to you
3. Filter by event type
4. Check delivery status (sent/failed)

### Admin Dashboard (For Admins)

Access API endpoint: `GET /api/admin/scheduler/stats`

Shows:
- Total emails sent vs failed
- Breakdown by event type
- User preferences summary
- Last 7 days activity

---

## Cost Comparison

| Provider | Cost | Emails/Month | Best For |
|----------|------|--------------|----------|
| **Gmail** | Free | 2,000 | Testing, small teams |
| **SendGrid** | Free/Paid | 100/month free | Production |
| **Office 365** | Free (if licensed) | Unlimited | Enterprise |
| **Mailgun** | Free/Paid | 100/month free | Developers |

---

## Next Steps

1. **Choose** your email provider above
2. **Set up** credentials
3. **Add** environment variables to Railway
4. **Wait** 1-2 minutes for restart
5. **Test** with "Send Test Email"
6. **Celebrate!** 🎉 Email notifications are live

---

## Support & Help

### Check This Guide:
- Section: **Troubleshooting** (most common issues)
- Section: **Railway Environment Variables Reference** (exact config)

### Check Server Logs:
- Railway dashboard → Deployments → View Logs
- Look for email-related messages

### Test Endpoint:
Use this to test email configuration:
```bash
POST /api/notifications/test
Authorization: Bearer <your-token>

Response: { "message": "Test email sent successfully", "messageId": "..." }
```

### Common Error Messages:

| Error | Meaning | Fix |
|-------|---------|-----|
| Invalid credentials | Wrong password/username | Double-check credentials |
| Connection refused | Can't reach email server | Check SMTP_HOST and port |
| No email received | Email rejected or lost | Check spam folder, verify address |
| SMTP timeout | Server not responding | Contact email provider |

---

**Last Updated:** 2024
**Applicable to:** Production Environment (Railway)
**Status:** Ready to Deploy
