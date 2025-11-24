# Admin Operations Guide - Synercore Import Schedule

**For**: System Administrators & Operations Team
**Last Updated**: 2025-11-24
**Status**: Production ✅

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Management](#user-management)
3. [Shipment Management](#shipment-management)
4. [Warehouse Management](#warehouse-management)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Backup & Recovery](#backup--recovery)
8. [Security](#security)

---

## Getting Started

### System Requirements

- **Browser**: Chrome, Firefox, Safari, Edge (latest versions)
- **Internet**: Stable connection (minimum 1 Mbps)
- **Account**: Admin user account
- **Access**: https://synercore-import-schedule.vercel.app

### First Login

1. Navigate to: https://synercore-import-schedule.vercel.app
2. Enter your admin credentials
3. Set your profile (name, email)
4. (Optional) Enable 2FA for security
5. You're now logged in!

### Dashboard Overview

On login, you'll see:
- **Alerts Hub**: Real-time notifications
- **Shipment Table**: Current shipments with filters
- **Warehouse Capacity**: Bin utilization by warehouse
- **Quick Actions**: Create shipment, bulk update, reports
- **Navigation Menu**: Access to all features

---

## User Management

### Create New User

1. Click **Settings** → **User Management** (sidebar)
2. Click **Add New User**
3. Fill in details:
   - **Username**: Email format (e.g., user@synercore.co.za)
   - **Email**: Valid email address
   - **Full Name**: User's actual name
   - **Role**: Select `admin` or `user`
   - **Password**: Auto-generated or custom
4. Click **Create User**
5. User receives welcome email with login instructions

### User Roles

#### Admin
- ✅ Create/edit/delete users
- ✅ Create/update/delete shipments
- ✅ View all reports
- ✅ Manage warehouse capacity
- ✅ Access system settings
- ✅ View audit logs

#### User
- ✅ View shipments
- ✅ Create/update shipments
- ✅ Generate reports
- ✅ Update warehouse capacity
- ❌ Cannot manage users
- ❌ Cannot delete shipments
- ❌ Cannot access settings

### Reset User Password

1. **Settings** → **User Management**
2. Find user in list
3. Click **Reset Password**
4. User receives reset email
5. User follows link to set new password

### Deactivate User

1. **Settings** → **User Management**
2. Find user in list
3. Click **Deactivate**
4. Confirm deactivation
5. User can no longer login

⚠️ **Note**: Deactivation is reversible. To permanently remove, contact support.

---

## Shipment Management

### View Shipments

#### Basic View
1. Go to **Dashboard** (default)
2. See all shipments in table format
3. Columns show: Order Ref, Supplier, Quantity, Status, Week, Warehouse

#### Filter Shipments
1. Use filters at top of table:
   - **Status**: Filter by shipment status
   - **Supplier**: Filter by supplier name
   - **Week Number**: Filter by week (1-53)
   - **Search**: Search order ref, supplier, notes
2. Click **Apply Filters**

#### Sort Shipments
1. Click column header to sort:
   - **Order Ref**: Alphabetically
   - **Quantity**: By amount
   - **Status**: By status
   - **Week**: By week number
2. Click again to reverse sort

#### Pagination
- View 20, 50, or 100 items per page
- Navigate pages with **Previous** / **Next**
- Jump to specific page with page selector

### Create Shipment

#### Manual Entry
1. Click **+ New Shipment** button
2. Fill in required fields:
   - **Order Reference** (e.g., APO0017300)
   - **Supplier Name**
   - **Quantity** (in units)
   - **Week Number** (1-53, optional)
3. Optional fields:
   - **Notes**: Any additional info
4. Click **Create Shipment**
5. New shipment appears in table with status "planned_airfreight"

#### Bulk Import via Excel
1. Click **Import Shipments**
2. Download template
3. Fill in Excel with shipment data:
   - Column A: Order Reference
   - Column B: Supplier
   - Column C: Quantity
   - Column D: Week Number
   - Column E: Notes
4. Save as .xlsx
5. Upload file
6. Review preview
7. Click **Import**
8. Shipments created in batch

### Update Shipment

#### Quick Edit
1. Find shipment in table
2. Click **Edit** button
3. Change fields:
   - Status (dropdown)
   - Quantity
   - Notes
4. Click **Save**

#### Detailed Update
1. Click shipment **Order Ref** to open details
2. Click **Edit Shipment**
3. Update any field:
   - Basic info (supplier, quantity)
   - Workflow (unloading, inspection, receiving)
   - Rejection info
4. Click **Update Shipment**
5. Changes saved immediately

#### Bulk Status Update
1. Click **Bulk Update** button
2. Select shipments to update:
   - Check checkboxes next to shipments
   - Or **Select All** on current page
3. Choose new status
4. Add notes (optional)
5. Click **Update Status**
6. All selected shipments updated

### View Shipment Details

1. Click shipment **Order Ref** or **View** button
2. See all details:
   - Basic information (supplier, quantity, dates)
   - Current status and timeline
   - Post-arrival workflow (if started)
   - Inspection, receiving, rejection details
3. Click **Edit** to make changes
4. View history of changes (last update time)

### Delete Shipment

⚠️ **Warning**: Deletion is permanent!

1. Open shipment details
2. Click **Delete** button (bottom of page)
3. Confirm deletion
4. Shipment removed permanently

**Alternative**: Use **Archive** instead (reversible)

### Archive Shipment

1. Open shipment details
2. Click **Archive** button
3. Shipment status changes to "archived"
4. Shipment hidden from main list
5. View archived: **Archive View** → All Archived Shipments

### Unarchive Shipment

1. Go to **Archive View**
2. Find archived shipment
3. Click **Unarchive**
4. Shipment status changes back to "stored"
5. Shipment appears in main list again

---

## Warehouse Management

### View Warehouse Capacity

1. Go to **Dashboard**
2. Scroll to **Warehouse Capacity** section
3. See capacity for each warehouse:
   - **PRETORIA**: Total bins, used, available
   - **KLAPMUTS**: Total bins, used, available
   - **Offsite** (if available)

### Update Warehouse Bins

#### Manual Update
1. Click **Update Capacity** next to warehouse
2. Enter new number of **Bins Used**
3. Click **Update**
4. System auto-calculates available bins
5. Changes saved immediately

#### Bulk Update
1. Go to **Warehouse Capacity** page
2. Update multiple warehouses:
   - Enter new values
   - Click **Save All**
3. All changes applied at once

### View Capacity History

1. Click **View History** next to warehouse
2. See timeline of capacity changes:
   - Date and time of change
   - Who made the change
   - Previous and new values
   - Reason for change (if noted)

### Monitor Capacity Alerts

⚠️ **Red Alert**: Warehouse > 90% full
🟡 **Yellow Alert**: Warehouse 70-90% full

When warehouse hits alert threshold:
1. Notification appears in **Alerts Hub**
2. Email alert sent to admin
3. View warehouse page to update

---

## Monitoring & Maintenance

### Daily Tasks

- ✅ Check **Alerts Hub** for new issues
- ✅ Review any overnight errors in Sentry
- ✅ Check warehouse capacity levels
- ✅ Verify shipments in transit arrived on schedule

### Weekly Tasks

- ✅ Run **Advanced Reports** to review metrics
- ✅ Check **Web Vitals** performance in Sentry
- ✅ Review supplier metrics
- ✅ Plan shipments for upcoming weeks

### Monthly Tasks

- ✅ Download performance reports
- ✅ Review Sentry error trends
- ✅ Analyze warehouse utilization
- ✅ Plan system updates
- ✅ Manual database backup

### Monitor System Health

#### Via Railway Dashboard
1. Go to https://railway.app/dashboard
2. Select your project
3. Check:
   - **Deployments**: Latest version deployed?
   - **Metrics**: CPU, memory, disk usage normal?
   - **Logs**: Any errors?
   - **Status**: Service running?

#### Via Sentry Dashboard
1. Go to https://sentry.io
2. Check:
   - **Issues**: Any new errors?
   - **Performance**: Page load times normal?
   - **Releases**: Latest version deployed?

#### Health Endpoint
```bash
# Check API is running
curl https://synercore-import-schedule-production.up.railway.app/health
```

Response should be:
```json
{"status":"OK","ready":true}
```

### Generate Reports

#### Shipment Reports
1. Go to **Reports** → **Shipment Analysis**
2. Choose filters:
   - Date range
   - Supplier
   - Status
   - Warehouse
3. Click **Generate Report**
4. View chart or **Download Excel**

#### Advanced Reports
1. Go to **Reports** → **Advanced Reports**
2. See metrics:
   - Total shipments by status
   - Quantity trends
   - Warehouse utilization
   - Supplier performance
3. **Download Report** as PDF or Excel

#### Export Data
1. Select shipments in table
2. Click **Export** button
3. Choose format:
   - Excel (.xlsx)
   - CSV (.csv)
   - PDF (.pdf)
4. Download file

---

## Troubleshooting

### Common Issues

#### Login Not Working
1. Clear browser cache and cookies
2. Try incognito/private browser window
3. Reset password via "Forgot Password"
4. Check if account is active
5. Contact admin if issue persists

#### Shipment Not Showing
1. Check if filters are applied
2. Try clearing all filters
3. Refresh page (Ctrl+R or Cmd+R)
4. Check if shipment was deleted or archived
5. View **Archive View** if not in main list

#### Warehouse Capacity Not Updating
1. Verify you have admin permissions
2. Check internet connection
3. Try different browser
4. Check if warehouse exists in system
5. Contact support if issue persists

#### Slow Performance
1. Check browser tab load time (check Network tab in DevTools)
2. Try different browser
3. Check internet connection speed
4. Clear browser cache
5. Reduce page filters/search to load fewer shipments

#### 500 Errors on API Calls
1. Check `/health` endpoint (must be OK)
2. Wait 2-3 minutes for server to recover
3. Refresh page
4. Check Sentry for error details
5. Contact support with error from Sentry

### Get Help

#### Check Logs
1. **Browser Console** (F12):
   - Look for red errors
   - Note error message
   - Screenshot if helpful

2. **Sentry Dashboard**:
   - Go to https://sentry.io
   - Browse Issues
   - Look for relevant error
   - Check stack trace for details

3. **Railway Logs**:
   - Go to https://railway.app/dashboard
   - Click **Logs** tab
   - Search for error time
   - Note any [ERROR] entries

#### Contact Support
Include:
- **What happened**: Describe the issue
- **When it happened**: Date and time
- **Screenshots**: Of error or unexpected behavior
- **Browser**: Which browser and version
- **Error messages**: From console or Sentry
- **Steps to reproduce**: How to recreate issue

---

## Backup & Recovery

### Automatic Backups

Railway automatically backs up database:
- **Frequency**: Daily at 2:00 UTC
- **Retention**: 30 days
- **Recovery**: One-click restore

### Manual Backup

1. Go to https://railway.app/dashboard
2. Select PostgreSQL plugin
3. Click **Backups** tab
4. Click **Create Backup**
5. Wait for completion
6. Download if needed (optional)

### Restore from Backup

1. Go to https://railway.app/dashboard
2. Click **Backups** tab
3. Find backup to restore
4. Click **Restore**
5. Confirm restoration
6. System restores to that point-in-time
7. Service will restart briefly

⚠️ **Warning**: Restoration affects ALL data since backup time!

### Export Data for Safety

1. Go to **Shipments** page
2. Select **All Shipments**
3. Click **Export**
4. Choose **Excel** format
5. Download file
6. Save locally or cloud storage

---

## Security

### Password Best Practices

- ✅ Use strong passwords (12+ characters)
- ✅ Include uppercase, lowercase, numbers, symbols
- ✅ Don't reuse passwords
- ✅ Change password every 90 days
- ❌ Don't share your password
- ❌ Don't write down passwords
- ❌ Don't use personal information

### Protect Your Account

1. **Enable Notifications**: Get alerts on unusual activity
2. **Monitor Sessions**: Check "Active Sessions" page
3. **Review Access Logs**: See who accessed your account
4. **Logout Devices**: Remove unused session devices

### Data Security

- ✅ All data encrypted in transit (HTTPS)
- ✅ All data encrypted at rest (database)
- ✅ API requests require authentication
- ✅ Rate limiting protects against abuse
- ✅ SQL injection prevention
- ✅ Regular security audits

### Audit Trail

Track all changes:
1. Go to **Settings** → **Audit Logs**
2. See history of:
   - User created/deleted/modified
   - Shipment created/updated/deleted
   - Warehouse capacity changes
   - Access attempts
3. Export audit log for compliance

---

## System Architecture

### Infrastructure

**Frontend**: Vercel (Jamstack)
- React application
- Deployed from GitHub
- Auto-scales with traffic
- 99.99% uptime SLA

**Backend**: Railway (Node.js)
- Express API server
- PostgreSQL database
- Automated backups
- Load balanced

**Monitoring**: Sentry
- Error tracking
- Performance monitoring
- Session replays
- Real-time alerts

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 14 |
| Authentication | JWT (JSON Web Tokens) |
| Deployment | Vercel (frontend), Railway (backend) |
| Monitoring | Sentry |

---

## Useful Commands & Links

### Quick Links
- 🌐 Application: https://synercore-import-schedule.vercel.app
- 📊 API Docs: https://synercore-import-schedule-production.up.railway.app/api-docs
- 🏥 Health Check: https://synercore-import-schedule-production.up.railway.app/health
- 🚀 Railway Dashboard: https://railway.app/dashboard
- 🐛 Sentry Dashboard: https://sentry.io
- 💾 GitHub: https://github.com/TGO0427/synercore-import-schedule

### API Commands

```bash
# Test API health
curl https://synercore-import-schedule-production.up.railway.app/health

# Login
curl -X POST https://synercore-import-schedule-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get shipments (replace TOKEN with actual token)
curl https://synercore-import-schedule-production.up.railway.app/api/shipments \
  -H "Authorization: Bearer TOKEN"
```

---

## Support & Escalation

### Support Levels

**Level 1**: Try to fix yourself
- Use Troubleshooting section
- Check browser console
- Clear cache and try again

**Level 2**: Check system status
- Go to Railway dashboard
- Check Sentry for errors
- Check API health endpoint

**Level 3**: Contact support
- Include error details from Sentry
- Provide screenshots
- Describe steps to reproduce

**Level 4**: Escalate to development
- Complex issues
- Production outages
- Database problems

---

## Checklist for New Admin

Upon receiving admin access:

- [ ] Change initial password
- [ ] Set up 2FA (recommended)
- [ ] Explore dashboard and features
- [ ] View sample shipments
- [ ] Create test shipment
- [ ] Update warehouse capacity
- [ ] Generate report
- [ ] Check Alerts Hub
- [ ] Review User Management
- [ ] Bookmark important links
- [ ] Understand backup/recovery process
- [ ] Set up Sentry alerts
- [ ] Schedule weekly review

---

**Questions?** Contact your system administrator or refer to the main documentation.

**Last Updated**: 2025-11-24
**Status**: Production ✅
