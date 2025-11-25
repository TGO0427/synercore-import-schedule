# Quick Start: Add Sentry to Vercel (5 Minutes)

**For**: Adding REACT_APP_SENTRY_DSN environment variable to Vercel

---

## The Quick Path

```
1. Get DSN from Sentry.io (2 min)
   ↓
2. Open Vercel Dashboard (30 sec)
   ↓
3. Settings > Environment Variables (1 min)
   ↓
4. Add REACT_APP_SENTRY_DSN with your DSN (1 min)
   ↓
5. Redeploy & Verify (2 min)
   ↓
Done! ✅
```

---

## Step 1: Get Your Sentry DSN (2 minutes)

### New to Sentry? Create a free account:
1. Go to **https://sentry.io**
2. Click **Sign Up** (top right)
3. Create free account (no credit card)
4. Choose **React**
5. Name your project: **"Synercore Production"**
6. **Copy the DSN** (looks like):
   ```
   https://d614fb5d1cf7f1b3d5405de7f752ef44@o4510424369987584.ingest.us.sentry.io/4510424372936704
   ```

### Already have Sentry? Get your DSN:
1. Log in to https://sentry.io
2. Click your project (top left)
3. **Settings** → **Client Keys (DSN)**
4. **Copy the DSN**

✅ **You now have your DSN!**

---

## Step 2: Open Vercel (30 seconds)

1. Go to **https://vercel.com**
2. Log in
3. Click project: **synercore-import-schedule**

---

## Step 3: Go to Environment Variables (1 minute)

1. Click **Settings** tab (top)
2. Click **Environment Variables** (left menu)
3. You should see this page:
   ```
   Settings / Environment Variables

   [Add Environment Variable +]

   (list of existing variables)
   ```

---

## Step 4: Add the Variable (1 minute)

1. Click **Add Environment Variable** button
2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Name** | `REACT_APP_SENTRY_DSN` |
   | **Value** | (Paste your DSN from Step 1) |
   | **Environments** | ✅ Production ✅ Preview ✅ Development |

3. Click **Save**

That's it! ✅

---

## Step 5: Redeploy & Verify (2 minutes)

### Redeploy (automatic):
1. Click **Deployments** tab
2. Click the **three dots (•••)** on latest deployment
3. Click **Redeploy**
4. Wait ~2 minutes for deployment to finish

### Verify it works:
1. Open your app: **https://synercore-import-schedule.vercel.app**
2. Press **F12** (Developer Console)
3. Look for this message in Console tab:
   ```
   ✓ Sentry frontend initialized (production)
   ```

✅ **It's working!**

---

## ✅ Done!

Your Sentry error tracking is now live! 🎉

Errors will automatically be sent to your Sentry dashboard at https://sentry.io

---

## 🔍 What to do if it doesn't work

| Issue | Solution |
|-------|----------|
| Says "DSN not set" | Check variable name is exactly `REACT_APP_SENTRY_DSN` (case sensitive) |
| Still not working | Hard refresh browser (Ctrl+F5 or Cmd+Shift+R) |
| Invalid DSN error | Copy full DSN from Sentry (should start with `https://`) |
| Deployment failed | Check Vercel build logs for errors |
| Can't find Settings | Make sure you're on the right Vercel project |

---

## 🎯 Result

After completing these 5 steps:
- ✅ Sentry DSN added to Vercel
- ✅ Application redeployed
- ✅ Error tracking live
- ✅ Errors appear in Sentry dashboard

**Next**: Go to https://sentry.io and create a test error to see it tracked! 🚀

---

## 📞 Need detailed instructions?

See **VERCEL_ENV_SETUP.md** for step-by-step guide with screenshots and troubleshooting.
