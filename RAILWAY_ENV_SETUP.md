# How to Add FRONTEND_URL to Railway Backend

**Issue**: WebSocket failing because backend doesn't recognize frontend URL
**Solution**: Add FRONTEND_URL environment variable to Railway backend

---

## ✅ Quick Fix (5 Minutes)

### Step 1: Go to Railway Dashboard
1. Open https://railway.app
2. Log in
3. Click your **Synercore** project
4. You should see 2 services:
   - PostgreSQL (database)
   - Node.js app (backend)

### Step 2: Click the Backend Service
1. Click on the **Node.js app** (NOT the database)
2. You should see tabs at the top

### Step 3: Find Variables Tab
1. Look for **Variables** tab (might say "Variables" or be in settings)
2. Click it
3. You should see a list of existing variables like:
   - DATABASE_URL
   - JWT_SECRET
   - NODE_ENV
   - etc.

### Step 4: Add FRONTEND_URL
1. Click **Add Variable** button
2. Fill in:
   ```
   Name: FRONTEND_URL
   Value: https://synercore-import-schedule.vercel.app
   ```
3. Click **Save** or **Add**

### Step 5: Redeploy
Railway usually auto-redeploys, but if not:
1. Click **Deployments** tab
2. Wait for new deployment to start
3. Wait for it to say "Success" or "Ready"
4. Usually takes 1-2 minutes

### Step 6: Test
1. Open your app: https://synercore-import-schedule.vercel.app
2. Press F12 (console)
3. Look for:
   - ❌ No WebSocket error
   - ✅ `[SocketClient] Attempting connection` message
   - ✅ `✓ Sentry frontend initialized`

---

## 📸 Visual Guide

### What You Should See in Railway:

```
Project: synercore-import-schedule

Services:
├── PostgreSQL (Database)
└── Node.js App (Backend) ← Click this

Variables Tab Shows:
├── DATABASE_URL: postgresql://...
├── JWT_SECRET: your-secret
├── NODE_ENV: production
├── PORT: 5001
├── SENTRY_DSN: https://... (if you added it)
└── FRONTEND_URL: https://synercore-import-schedule.vercel.app ← ADD THIS
```

---

## 🔧 Backend Understanding

Your backend (on Railway) has:
```javascript
const allowedOrigins = [
  'http://localhost:3000',          // Local dev
  'http://localhost:5173',          // Local dev
  process.env.FRONTEND_URL || 'https://synercore-frontend.vercel.app',  // ← OLD URL
];
```

**The Problem:**
- Old default: `synercore-frontend.vercel.app`
- Your actual: `synercore-import-schedule.vercel.app`
- **They don't match!** ❌

**The Fix:**
- Set `FRONTEND_URL = https://synercore-import-schedule.vercel.app`
- Backend will use this instead of the old default ✅

---

## 📋 All Environment Variables Needed

### Railway Backend (Node.js service)
```
DATABASE_URL:    postgresql://user:pass@host/db
JWT_SECRET:      your-jwt-secret-key
NODE_ENV:        production
PORT:            5001
SENTRY_DSN:      https://... (optional, for error tracking)
FRONTEND_URL:    https://synercore-import-schedule.vercel.app ← ADD THIS
```

### Vercel Frontend
```
VITE_API_BASE_URL:       https://synercore-import-schedule-production.up.railway.app
REACT_APP_SENTRY_DSN:    https://... (optional, your Sentry DSN)
```

---

## ✅ After Adding FRONTEND_URL

**What Changes:**
1. Backend allows WebSocket connections from your Vercel app ✅
2. WebSocket connects successfully ✅
3. Real-time features work ✅
4. Sentry initializes ✅
5. App fully functional ✅

**What You'll See:**
```
Console Output:
[SocketClient] Attempting connection {
  url: "https://synercore-import-schedule-production.up.railway.app"
  hasAuthToken: true
  env: "production"
  apiBase: "https://synercore-import-schedule-production.up.railway.app"
}

✓ Sentry frontend initialized (production)
```

No more WebSocket errors! 🎉

---

## 🔗 Important URLs

| Component | URL |
|-----------|-----|
| Frontend | https://synercore-import-schedule.vercel.app |
| Backend | https://synercore-import-schedule-production.up.railway.app |
| Railway Dashboard | https://railway.app |
| Vercel Dashboard | https://vercel.com |

---

## 🆘 Troubleshooting

### WebSocket Still Failing?
1. ✅ Did you add `FRONTEND_URL` to Railway?
2. ✅ Did Railway finish redeploying?
3. ✅ Did you hard refresh? (Ctrl+F5)
4. ✅ Check Railway deployment status (should say "Success")

### Can't Find Variables in Railway?
1. Make sure you're in the **Node.js app** service (not database)
2. Look for "Variables" or "Settings"
3. Try clicking the service name and looking in the sidebar

### Not Sure Which Service is Backend?
1. Click on each service
2. Look at the bottom - it should show the railway.app URL
3. Backend is the one with your API URL

---

## 🎯 Next Steps

1. **Right now**: Add FRONTEND_URL to Railway
2. **Wait**: 2-5 minutes for redeploy
3. **Test**: Open your app and check console
4. **Done**: WebSocket should work! ✅

---

**That's it! Just one environment variable and you're done!** 🚀
