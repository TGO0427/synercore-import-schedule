# WebSocket Connection Error - FIX

**Issue**: WebSocket failing to connect to backend
```
WebSocket connection to 'wss://synercore-import-schedule-production.up.railway.app/socket.io' failed
```

**Cause**: Missing `VITE_API_BASE_URL` environment variable in Vercel

**Solution**: Add the environment variable to Vercel (takes 5 minutes)

---

## 🔧 Quick Fix (5 Minutes)

### Step 1: Open Vercel
1. Go to https://vercel.com
2. Click project: **synercore-import-schedule**
3. Click **Settings** tab

### Step 2: Go to Environment Variables
1. Click **Environment Variables** (left menu)
2. Click **Add Environment Variable**

### Step 3: Add VITE_API_BASE_URL
1. **Name**: `VITE_API_BASE_URL`
2. **Value**: `https://synercore-import-schedule-production.up.railway.app`
3. **Environments**: Check all 3 (Production, Preview, Development)
4. Click **Save**

### Step 4: Redeploy
1. Click **Deployments** tab
2. Click **•••** menu on latest deployment
3. Click **Redeploy**
4. Wait for "Ready" status

### Step 5: Verify
1. Open your app: https://synercore-import-schedule.vercel.app
2. Open console (F12)
3. WebSocket error should be gone ✅
4. You should see Sentry message: `✓ Sentry frontend initialized`

---

## 📋 Checklist

Now you need **TWO** environment variables in Vercel:

### First Variable (for Sentry - if you added it):
```
Name: REACT_APP_SENTRY_DSN
Value: https://your-key@your-project.ingest.us.sentry.io/123456
Environments: ✅ Production, ✅ Preview, ✅ Development
```

### Second Variable (for Backend Connection - ADD THIS NOW):
```
Name: VITE_API_BASE_URL
Value: https://synercore-import-schedule-production.up.railway.app
Environments: ✅ Production, ✅ Preview, ✅ Development
```

**Both should be visible in Environment Variables list:**
```
REACT_APP_SENTRY_DSN      https://***@o***...
VITE_API_BASE_URL         https://synercore-import-schedule...
```

---

## ⚠️ Why This Happened

Your frontend (on Vercel) needs to know where your backend API is located.

- **Local development**: Uses relative paths (localhost:5001)
- **Production**: Needs the full URL to your Railway backend

The backend is at:
```
https://synercore-import-schedule-production.up.railway.app
```

This URL must be told to Vercel via the `VITE_API_BASE_URL` variable.

---

## ✅ After Adding This Variable

Once you redeploy with this environment variable, you'll have:

✅ **API Requests Working**
- Login will work
- Shipments will load
- All backend calls will connect

✅ **WebSocket Working**
- Real-time updates
- Notifications
- Live data

✅ **Sentry Working**
- Error tracking active
- Performance monitoring
- See: `✓ Sentry frontend initialized`

---

## 🔗 Environment Variables Summary

You need these in Vercel:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_BASE_URL` | `https://synercore-import-schedule-production.up.railway.app` | Frontend → Backend connection |
| `REACT_APP_SENTRY_DSN` | Your Sentry DSN | Error tracking |
| `REACT_APP_GA_ID` | Your GA ID | Google Analytics (optional) |

---

## ✅ Complete Step-by-Step

### 1. Add VITE_API_BASE_URL to Vercel
```
Vercel Dashboard
→ Project: synercore-import-schedule
→ Settings
→ Environment Variables
→ Add: VITE_API_BASE_URL = https://synercore-import-schedule-production.up.railway.app
→ Check all 3 environments
→ Save
```

### 2. Redeploy
```
Vercel Dashboard
→ Deployments
→ Click ••• on latest
→ Redeploy
→ Wait for "Ready"
```

### 3. Verify
```
Open app: https://synercore-import-schedule.vercel.app
F12 → Console
Look for:
- No WebSocket error ✅
- ✓ Sentry frontend initialized ✅
- App fully functional ✅
```

---

## 🎯 Result

After this fix:

**Before:**
```
❌ WebSocket connection failed
❌ Sentry message not showing
❌ App trying to reach backend but can't
```

**After:**
```
✅ WebSocket connected
✅ Sentry initialized message shows
✅ Backend connected properly
✅ App fully functional
```

---

## 📱 Deployment URLs

Your setup has:
- **Frontend**: https://synercore-import-schedule.vercel.app (on Vercel)
- **Backend**: https://synercore-import-schedule-production.up.railway.app (on Railway)

These need to know about each other through environment variables!

---

## 🔒 Security Notes

The `VITE_API_BASE_URL` is safe to expose because:
- It's just the public API URL
- No secrets in the URL
- Clients need to know where the backend is
- Standard practice for web apps

---

## 📞 Still Having Issues?

1. **Verify Vercel has VITE_API_BASE_URL set**
   - Go to Settings > Environment Variables
   - Should see `VITE_API_BASE_URL` listed
   - Value should be: `https://synercore-import-schedule-production.up.railway.app`

2. **Verify deployment completed**
   - Go to Deployments tab
   - Latest should say "Ready"
   - Not "Building" or "Error"

3. **Clear browser cache & hard refresh**
   - Ctrl+Shift+Delete (clear cache)
   - Ctrl+F5 (hard refresh)
   - F12 (open console)

4. **Check app is working**
   - Try logging in
   - See if shipments load
   - Check Network tab for API calls

---

## ✨ Done!

Once you add `VITE_API_BASE_URL` to Vercel and redeploy:
- ✅ WebSocket will connect
- ✅ Backend API calls will work
- ✅ Sentry will initialize
- ✅ Your app will be fully functional 🎉

**Go add that environment variable now!** (Takes 5 minutes)
