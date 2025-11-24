# Monitoring & Performance Setup Guide

This guide covers setting up error tracking, performance monitoring, database backups, and analytics for your Synercore Import Schedule application.

---

## 1. SENTRY ERROR TRACKING & PERFORMANCE MONITORING

### What is Sentry?
Sentry captures real-time errors, performance issues, and performance metrics from your frontend and backend.

### Setup Instructions

#### Step 1: Create Sentry Account
1. Go to https://sentry.io
2. Sign up for a free account
3. Create a new organization (e.g., "Synercore")
4. Create two projects:
   - **Project 1**: `synercore-backend` (Node.js)
   - **Project 2**: `synercore-frontend` (React)

#### Step 2: Get DSN Keys
For each project, copy the **DSN** (Data Source Name):
- Backend DSN: `https://[key]@o[id].ingest.sentry.io/[project-id]`
- Frontend DSN: `https://[key]@o[id].ingest.sentry.io/[project-id]`

#### Step 3: Add to Environment Variables

**Railway (Production Backend):**
```
SENTRY_DSN=https://[YOUR_BACKEND_DSN]
```

**Vercel (Production Frontend):**
```
REACT_APP_SENTRY_DSN=https://[YOUR_FRONTEND_DSN]
```

**Local Development (.env):**
```
SENTRY_DSN=https://[YOUR_BACKEND_DSN]
REACT_APP_SENTRY_DSN=https://[YOUR_FRONTEND_DSN]
```

#### Step 4: Configure Sentry Settings

Go to Sentry dashboard → Settings → Alerts:
- Enable "Alert on every new issue"
- Set email notification to your email
- Set Slack integration (optional but recommended)

#### Step 5: Deploy
```bash
git add .
git commit -m "Add Sentry error tracking"
git push origin main
```

### What Sentry Tracks

**Backend:**
- ✅ Unhandled exceptions
- ✅ API errors (500, 502, 503)
- ✅ Database connection errors
- ✅ Performance metrics (response times)
- ✅ Request/response data

**Frontend:**
- ✅ JavaScript errors
- ✅ React component errors
- ✅ API call failures
- ✅ Performance metrics
- ✅ Session replays (on errors)

### Viewing Errors in Sentry
1. Go to https://sentry.io/organizations/[your-org]/issues/
2. View all errors and their details
3. Click an issue to see:
   - Stack trace
   - Request data
   - User information
   - Breadcrumbs (event history)
   - Session replay (frontend only)

### Set Alerts for Critical Issues
1. Go to Sentry → Alerts
2. Create alert rule:
   - When: Issue severity is "error"
   - Then: Send notification to email
3. Optional: Integrate with Slack for real-time notifications

---

## 2. RAILWAY DATABASE BACKUPS

### Enable Automated Backups

#### Via Railway Dashboard:
1. Go to https://railway.app/dashboard
2. Select your project
3. Click on the **PostgreSQL** plugin
4. Go to **Backups** tab
5. Enable automatic backups:
   - **Backup Schedule**: Daily at 2:00 UTC
   - **Retention**: 30 days
   - Click **Enable**

#### Backup Features:
- ✅ Daily automatic backups
- ✅ 30 days retention
- ✅ Point-in-time recovery
- ✅ Download backups manually
- ✅ Restore with one click

### Manual Backup (if needed)
1. Go to your PostgreSQL plugin on Railway
2. Click **Backups** → **Create Backup**
3. Wait for backup to complete
4. Download or restore as needed

### Monitor Database Health
1. In Railway dashboard:
   - **Metrics** tab: Monitor CPU, memory, connections
   - **Logs** tab: Check for errors
   - **Status** tab: Verify it's running

---

## 3. FRONTEND PERFORMANCE MONITORING

### Web Vitals Monitoring

Sentry automatically tracks Core Web Vitals (CWV):
- **LCP** (Largest Contentful Paint): How fast main content loads
- **FID** (First Input Delay): How responsive page is to user input
- **CLS** (Cumulative Layout Shift): How much layout shifts during load

View these metrics in Sentry:
1. Go to Sentry dashboard
2. Click your project → **Performance**
3. View Web Vitals scores

### Additional Performance Monitoring

Check Sentry's Performance tab for:
- **Slowest Transactions**: Pages/API calls taking longest
- **Error-prone Pages**: Pages with highest error rates
- **Database Queries**: Slow database operations
- **Response Times**: API endpoint performance

### Improve Performance

Based on Sentry metrics, consider:
1. **Code Splitting**: Load JavaScript on-demand
2. **Image Optimization**: Compress and lazy-load images
3. **Database Indexing**: Optimize slow queries
4. **Caching**: Cache API responses on frontend
5. **API Optimization**: Reduce response sizes

---

## 4. ANALYTICS IMPLEMENTATION

### Option 1: Google Analytics (Recommended, Free)

#### Setup:
1. Go to https://analytics.google.com
2. Create new property for your site
3. Get **Measurement ID**: `G-XXXXXXXXXX`
4. Add to `.env`:
   ```
   REACT_APP_GA_ID=G-XXXXXXXXXX
   ```

#### Install:
```bash
npm install @react-google-analytics/core
```

#### Usage:
Already integrated in `src/config/analytics.js`

#### View Metrics:
- Dashboard: Overall traffic
- Real-time: Current visitors
- Users: Traffic sources, demographics
- Pages: Most visited pages
- Events: User interactions

### Option 2: Mixpanel (Advanced, Paid)

For detailed user behavior tracking.

### Option 3: Amplitude (Advanced, Paid)

For advanced product analytics.

---

## 5. MONITORING CHECKLIST

### Daily
- [ ] Check Sentry for new errors
- [ ] Verify Railway deployment is running
- [ ] Check frontend load times in Sentry

### Weekly
- [ ] Review error trends
- [ ] Check database performance
- [ ] Review user analytics
- [ ] Monitor system resource usage

### Monthly
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Plan optimizations
- [ ] Backup database manually

---

## 6. TROUBLESHOOTING

### Sentry not capturing errors?
1. Verify `SENTRY_DSN` is set
2. Check browser console for Sentry initialization errors
3. Ensure errors are actually occurring
4. Check Sentry project is enabled

### Missing performance data?
1. Ensure `tracesSampleRate > 0` in Sentry config
2. Check that requests are being made
3. Wait 5 minutes for data to appear in Sentry

### Database backup not working?
1. Verify backup is enabled in Railway
2. Check PostgreSQL plugin status
3. Ensure you have storage quota
4. Contact Railway support if needed

---

## 7. ENVIRONMENT VARIABLES SUMMARY

```bash
# Backend (Railway)
SENTRY_DSN=https://...@o....ingest.sentry.io/...
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
JWT_SECRET=your-secret-key

# Frontend (Vercel)
REACT_APP_SENTRY_DSN=https://...@o....ingest.sentry.io/...
REACT_APP_API_URL=https://synercore-import-schedule-production.up.railway.app
REACT_APP_GA_ID=G-XXXXXXXXXX
```

---

## 8. GETTING HELP

**Sentry Documentation**: https://docs.sentry.io/
**Railway Docs**: https://docs.railway.app/
**Google Analytics Help**: https://support.google.com/analytics/

---

## NEXT STEPS

1. ✅ Set up Sentry (today)
2. ✅ Enable Railway backups (today)
3. ✅ Add environment variables (today)
4. ✅ Deploy changes (today)
5. Test error capture by triggering an error
6. Set up alerts in Sentry
7. Configure analytics
8. Monitor over next week

---
