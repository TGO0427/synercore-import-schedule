# How to Add Environment Variables to Vercel

**Last Updated**: 2025-11-25
**Time to Complete**: 5 minutes
**Difficulty**: Beginner-Friendly ✅

---

## 📋 STEP-BY-STEP GUIDE

### **Step 1: Get Your Sentry DSN**

First, you need to get the DSN from your Sentry project.

#### Option A: If you already have a Sentry account
1. Go to https://sentry.io and log in
2. Click on your project name (top left)
3. Go to **Settings** (gear icon in top right)
4. Click **Client Keys (DSN)** on the left menu
5. Copy the full DSN (looks like this):
   ```
   https://d614fb5d1cf7f1b3d5405de7f752ef44@o4510424369987584.ingest.us.sentry.io/4510424372936704
   ```
6. **Keep this safe!** Don't share publicly

#### Option B: If you don't have Sentry yet
1. Go to https://sentry.io
2. Click **Sign Up** (top right)
3. Create free account (no credit card needed)
4. Choose **React** as your platform
5. Give your project a name (e.g., "Synercore Production")
6. Copy the DSN provided
7. You're done with Sentry setup!

---

### **Step 2: Go to Vercel Dashboard**

1. Open https://vercel.com
2. Log in with your account (same account you used to deploy the frontend)
3. You should see your projects listed
4. Click on **synercore-import-schedule** project

---

### **Step 3: Open Project Settings**

1. In your Vercel project page, look for the top navigation tabs
2. Click on **Settings** tab (between "Deployments" and "Git")
3. You should now see a left sidebar menu

---

### **Step 4: Find Environment Variables**

1. In the left sidebar under "Settings", click **Environment Variables**
2. You should see a page that says "Environment Variables"
3. There might be existing variables from previous setup

---

### **Step 5: Add the New Variable**

1. Click the **Add Environment Variable** button (top right)
2. A form will appear with three fields:

   **Field 1: Name**
   ```
   REACT_APP_SENTRY_DSN
   ```
   (Copy this exactly - case sensitive!)

   **Field 2: Value**
   ```
   https://your-key@your-project.ingest.us.sentry.io/123456
   ```
   (Paste your DSN from Step 1)

   **Field 3: Environments** (checkboxes)
   - ✅ Production (CHECK this)
   - ✅ Preview (CHECK this)
   - ✅ Development (CHECK this)

3. Click **Save**

---

### **Step 6: Verify It's Added**

After clicking Save, you should see your new variable in the list:

```
Name: REACT_APP_SENTRY_DSN
Value: https://***@o****...ingest.us.sentry.io/...
Environments: Production, Preview, Development
```

The value shows as `https://***@o****...` (hidden for security) - this is normal!

---

### **Step 7: Redeploy Your Application**

The environment variable won't take effect until you redeploy. You have two options:

#### Option A: Automatic (Easiest)
1. Go back to **Deployments** tab
2. Find your latest deployment
3. Click the **3 dots menu** (•••) on the right
4. Click **Redeploy**
5. Wait for it to complete (usually 2-3 minutes)

#### Option B: Push Code (if you made changes)
```bash
git add .
git commit -m "Update environment configuration"
git push origin main
```

Vercel will automatically redeploy when you push to GitHub.

---

### **Step 8: Verify It's Working**

After deployment completes:

1. Go to https://synercore-import-schedule.vercel.app
2. Open **Developer Console** (F12 or right-click > Inspect > Console tab)
3. Look for this message:
   ```
   ✓ Sentry frontend initialized (production)
   ```
   ✅ **This means it's working!**

4. Or, look for this message (if DSN not set):
   ```
   ⚠️ REACT_APP_SENTRY_DSN not set. Error tracking disabled.
   ```
   ❌ **This means variable wasn't loaded - try Step 7 again**

---

## 📸 VISUAL GUIDE

### Screenshot 1: Vercel Dashboard
```
Home  Deployments  Settings  Monitoring  Analytics
                   ^^^^^^^^^
                   Click here
```

### Screenshot 2: Settings Menu
```
Settings / Environment Variables
                    ^^^^^^^^^^^^^^^^^
                    Click here
```

### Screenshot 3: Add Variable Form
```
┌─────────────────────────────────────┐
│ Add Environment Variable             │
├─────────────────────────────────────┤
│                                     │
│ Name: [REACT_APP_SENTRY_DSN]        │
│                                     │
│ Value: [https://key@project...]     │
│                                     │
│ Environments:                       │
│ ☑ Production                        │
│ ☑ Preview                           │
│ ☑ Development                       │
│                                     │
│ [Cancel]  [Save]                    │
└─────────────────────────────────────┘
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Have Sentry DSN copied (from Sentry.io)
- [ ] Logged into Vercel
- [ ] Found Settings > Environment Variables
- [ ] Added `REACT_APP_SENTRY_DSN` with correct value
- [ ] Selected all three environments (Production, Preview, Development)
- [ ] Clicked Save
- [ ] Redeployed the application
- [ ] Saw "✓ Sentry frontend initialized" in console

---

## 🐛 TROUBLESHOOTING

### Problem 1: "⚠️ REACT_APP_SENTRY_DSN not set"
**Solution**:
1. Double-check the variable name: `REACT_APP_SENTRY_DSN` (case-sensitive!)
2. Make sure you selected all three environments
3. Try redeploying again (wait 5 minutes)
4. Clear browser cache (Ctrl+Shift+Delete)
5. Hard refresh (Ctrl+F5)

### Problem 2: "Invalid DSN" error
**Solution**:
1. Copy the full DSN from Sentry (not partial)
2. Paste it exactly - no extra spaces
3. DSN should start with `https://`
4. Should contain `@o` and `.ingest.us.sentry.io`

### Problem 3: Still not working after deploy
**Solution**:
1. Check Vercel deployment status (should say "Ready")
2. Check your git branch (should be main/master)
3. Open DevTools Console (F12)
4. Check for any error messages
5. Try rebuilding: Settings > Deployments > Redeploy

### Problem 4: Can't find Vercel Settings
**Solution**:
1. Make sure you're in the right project
2. Click the project name (top of page)
3. You should see tabs: **Deployments**, **Settings**, etc.
4. If tabs missing, try refreshing the page

---

## 🔒 SECURITY REMINDER

✅ **DO**:
- Use the actual DSN from Sentry
- Keep DSN secret (but it's hidden in Vercel)
- Use environment variables (not hardcoding)

❌ **DON'T**:
- Share your DSN publicly
- Commit DSN to GitHub
- Hardcode it in source code
- Use old/inactive DSNs

---

## 📱 QUICK REFERENCE

| Step | Action | Details |
|------|--------|---------|
| 1 | Get DSN | From https://sentry.io |
| 2 | Open Vercel | https://vercel.com |
| 3 | Select Project | synercore-import-schedule |
| 4 | Click Settings | Top navigation |
| 5 | Click Env Variables | Left sidebar |
| 6 | Add Variable | Name: `REACT_APP_SENTRY_DSN` |
| 7 | Paste Value | Your DSN from Sentry |
| 8 | Select All Envs | Production, Preview, Development |
| 9 | Save | Click Save button |
| 10 | Redeploy | Deployments > Redeploy |
| 11 | Verify | Check console for ✓ message |

---

## 🎯 YOU'RE DONE!

Once you see this in your browser console:
```javascript
✓ Sentry frontend initialized (production)
```

Your Sentry error tracking is **live and working!** 🎉

---

## 📞 NEED HELP?

### Still Stuck?
1. Check your DSN format (should be `https://key@o####...`)
2. Verify variable name is exactly `REACT_APP_SENTRY_DSN`
3. Make sure all 3 environments are checked
4. Wait 5 minutes for Vercel to fully deploy
5. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R on Mac)

### Common Issues:
- **Variable not showing**: Refresh page
- **Still says not set**: Clear browser cache & hard refresh
- **Deployment failed**: Check build logs in Vercel
- **Wrong DSN**: Copy again from Sentry, not partial text

---

## 🔗 HELPFUL LINKS

- **Vercel Docs**: https://vercel.com/docs/environment-variables
- **Sentry Setup**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Your Project**: https://synercore-import-schedule.vercel.app
- **Sentry Dashboard**: https://sentry.io

---

**Next Steps**:
1. ✅ Add `REACT_APP_SENTRY_DSN` to Vercel
2. ✅ Redeploy application
3. ✅ Verify in browser console
4. ✅ Start tracking errors in Sentry! 🎉

---

**Questions?** Refer to:
- `SENTRY_SECURITY_GUIDE.md` - Security & privacy
- `SETUP_MONITORING.md` - Full monitoring setup
- `API_COMPLETE_DOCUMENTATION.md` - API endpoints
