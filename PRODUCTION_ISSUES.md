# Production Issues and Solutions

## Issue 1: 403 Token Expired on Logout

### What's Happening
```
Failed to load resource: the server responded with a status of 403 ()
```

When you logout, the app gets a 403 error from `/api/auth/logout`.

### Why
- JWT tokens have an **expiration time** (usually 15 minutes)
- Old tokens from development/staging don't work on production
- After production deployment, previous tokens are invalid
- Logout endpoint requires a valid token

### Solution

**For Development/Testing:**
1. **Log in again** - Get a fresh token
2. Token should now be valid for 15 minutes
3. Logout should work immediately after login

**For Production:**
1. Clear browser localStorage
   ```javascript
   // Open DevTools Console and run:
   localStorage.clear();
   localStorage.removeItem('auth_access_token');
   localStorage.removeItem('auth_refresh_token');
   ```

2. Refresh the page and log in again
3. Token will be valid for your session
4. Logout should work properly

**For the App:**
- Add automatic token refresh 60 seconds before expiry (already implemented)
- Token should auto-refresh every 15 minutes
- Only old/stale tokens cause 403 errors

### Long-term Fix
- Tokens refresh automatically via `/api/auth/refresh`
- No action needed if app is running continuously
- Only happens when:
  - Browser is closed and reopened (token expired)
  - Switching between dev/production
  - Server restarts with new JWT_SECRET

---

## Issue 2: Week Number Validation Error

### What's Happening
```
Error: Week number must be between 1 and 53
```

When creating a shipment, the week number validation fails.

### Why
- Week numbers must be between 1-53 (ISO week year standard)
- Being sent: 0, 54+, null, or non-integer values

### Solutions

**Check what's being sent:**
1. Open DevTools → Network tab
2. Filter by XHR (XMLHttpRequest)
3. Find the failed shipment creation request
4. Click it and check "Request" tab
5. Look for `weekNumber` value

**Common issues:**

**Problem: Week number is 0**
- Solution: Change to 1-53 range
- Week 1 = First week of year
- Week 53 = Last week (only in some years)

**Problem: Week number > 53**
- Solution: Modulo with 53 (convert to 1-53)
- Example: Week 54 → Week 1 next year

**Problem: Week number is null or missing**
- Solution: Make field optional or provide default
- Can skip importing if week number is missing

**Problem: Week number is string ("01" instead of 1)**
- Solution: Convert to integer before sending
- JavaScript: `parseInt(weekNumber, 10)`

### For File Imports
When importing from Excel/CSV, ensure:
1. Week column contains **integers 1-53**
2. No text values like "Week 1" (should be just "1")
3. No empty cells (either fill or skip that row)
4. No formulas that evaluate to > 53 or < 1

### Temporary Workaround
If you don't have week numbers:
1. Generate them based on dates:
   ```javascript
   const getWeekNumber = (date) => {
     const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
     const dayNum = d.getUTCDay() || 7;
     d.setUTCDate(d.getUTCDate() + 4 - dayNum);
     const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
     return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
   };
   ```

2. Or use estimated date based on week:
   ```javascript
   const dateFromWeek = (year, week) => {
     const simple = new Date(year, 0, 1 + (week - 1) * 7);
     return simple;
   };
   ```

---

## Issue 3: Supplier Name Matching - Some Suppliers Have No Shipments

### What's Happening
```
[SupplierKPICard] No matching shipments for supplier "Deltaris".
Available suppliers in data: Array(9)
```

Some suppliers show metrics (all 0%) but the debug panel shows no matching shipments.

### Why
Supplier name in `suppliers` table doesn't match supplier name in `shipments` table:
- Different spelling
- Different capitalization
- Extra/missing whitespace
- Different abbreviations

Example:
```
Suppliers table: "Deltaris Inc"
Shipments table: "Deltaris"
→ No match! (even though it's the same company)
```

### Solutions

**Option 1: Fix Supplier Names (Recommended)**
1. Go to Supplier Management
2. Edit the supplier
3. Check the name matches **exactly** with shipment data
4. Save changes

**Option 2: Update Shipments**
1. Go to Shipping Schedule
2. Find shipments from that supplier
3. Edit each shipment
4. Change supplier name to match supplier record
5. Save

**Option 3: Check Database Directly**
```sql
-- Show all unique supplier names in shipments
SELECT DISTINCT supplier FROM shipments ORDER BY supplier;

-- Show all supplier names in suppliers table
SELECT name FROM suppliers ORDER BY name;

-- Find mismatches
SELECT DISTINCT s.supplier FROM shipments s
LEFT JOIN suppliers su ON LOWER(TRIM(s.supplier)) = LOWER(TRIM(su.name))
WHERE su.id IS NULL;
```

### Debug Steps

1. **Check the Debug Panel** (Development only)
   - Go to Suppliers view
   - Scroll to "📊 Metrics Debug Panel"
   - Under "Shipment Suppliers" section, see exact names from shipments
   - Compare with "Supplier Names" section

2. **Check Browser Console:**
   ```
   [SupplierKPICard] No matching shipments for supplier "Deltaris"
   Available suppliers in data: [...]
   ```
   - This shows what supplier names **actually exist** in shipment data

3. **Fix Names to Match**
   - Edit supplier name OR edit shipment supplier name
   - Make them match exactly (case doesn't matter, but spaces do)

### Example Fix

Before:
```
Suppliers: ["Deltaris Inc", "Futura", "Halavet"]
Shipments: ["Deltaris", "FUTURA TRADING", "Halavet"]
```

After:
```
Suppliers: ["Deltaris", "Futura Trading", "Halavet"]
Shipments: ["Deltaris", "Futura Trading", "Halavet"]
```

Now metrics will display!

---

## Diagnosis Checklist

### For 403 Logout Error:
- [ ] Check if token is expired (> 15 min old)
- [ ] Clear localStorage and log in again
- [ ] Check server logs for JWT_SECRET mismatch
- [ ] Verify JWT_SECRET environment variable is set

### For Week Number Error:
- [ ] Check week number is 1-53
- [ ] Verify it's an integer, not string
- [ ] Check file doesn't have formulas returning invalid values
- [ ] Validate import file before uploading

### For Supplier Name Mismatch:
- [ ] Open Debug Panel in development
- [ ] Compare supplier names in both columns
- [ ] Edit supplier or shipment to fix names
- [ ] Verify names match exactly (whitespace matters)
- [ ] Re-check debug panel to confirm match

---

## Environment Variables Checklist

### Required on Production:
```bash
JWT_SECRET=<your-secret-key>
DATABASE_URL=postgresql://...
PORT=5001
```

### Optional but Recommended:
```bash
VITE_API_BASE_URL=https://your-production-url
ALLOWED_ORIGINS=https://your-production-url
NODE_ENV=production
```

### If Missing:
- 403 errors on auth endpoints (missing JWT_SECRET)
- Database connection fails (missing DATABASE_URL)
- CORS errors (missing ALLOWED_ORIGINS)

---

## Testing Workflow

1. **Fresh Login Test**
   - Clear all storage
   - Log in with credentials
   - Verify no 403 errors
   - Can access all pages

2. **Token Expiry Test**
   - Wait 15+ minutes
   - Try an API call
   - Should auto-refresh token
   - No 403 errors

3. **Shipment Import Test**
   - Upload CSV with week numbers 1-53
   - Check console for validation errors
   - Verify shipments appear

4. **Supplier Metrics Test**
   - Create supplier
   - Import shipments for that supplier
   - Check debug panel for name match
   - Verify KPI cards show data

---

## Support Resources

- **Token Issues**: Check auth.js authentication middleware
- **Week Numbers**: Check validation.js rules
- **Supplier Matching**: Check supplierMetrics.js `getSupplierShipments()`
- **Debug Panel**: Check MetricsDebugPanel.jsx for data diagnostics
