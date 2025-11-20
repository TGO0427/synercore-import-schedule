# How to Run the SQL Command

You need to run this command in your database:

```sql
UPDATE shipments SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;
```

Here are **3 ways** to do it, from easiest to more advanced:

---

## Method 1: Railway PostgreSQL GUI (EASIEST) ✅

This is the easiest way if your database is on Railway.

### Step 1: Go to Railway Dashboard
1. Open: https://railway.app/
2. Log in with your account
3. Click on your project: **synercore-import-schedule**

### Step 2: Find Database
1. In the left sidebar, click **Plugins**
2. Look for **PostgreSQL** in the list
3. Click on it

### Step 3: Open SQL Editor
1. Click the **Data** tab at the top
2. You should see a SQL editor/console
3. Or click **PostgreSQL** → **Connect** → choose a SQL client

### Step 4: Paste and Run
1. **Copy this command:**
   ```sql
   UPDATE shipments SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;
   ```

2. **Paste it** into the SQL editor

3. **Click Run** (or press Ctrl+Enter)

4. **You should see:** `UPDATE 28` (or similar number - means 28 rows updated)

### Step 5: Verify
Paste this command to verify:
```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN latest_status = 'stored' THEN 1 END) as stored_count
FROM shipments;
```

Should show: `total: 28, stored_count: 28` (or whatever your count is)

---

## Method 2: pgAdmin (More Control)

If you have pgAdmin installed:

### Step 1: Open pgAdmin
- Open pgAdmin in your browser (usually localhost:5050)
- Log in

### Step 2: Connect to Database
1. Left sidebar → **Servers** → your database server
2. Enter password if prompted
3. Expand to see databases
4. Click your database

### Step 3: Open Query Tool
1. Right-click on your database
2. Select **Query Tool** (or top menu: **Tools** → **Query Tool**)

### Step 4: Paste and Execute
1. Copy the SQL command:
   ```sql
   UPDATE shipments SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;
   ```

2. Paste into the query window

3. Click **Execute** button (play icon) or press F5

4. Check the **Messages** tab - should say something like:
   ```
   UPDATE 28
   Query returned successfully in X ms.
   ```

---

## Method 3: Command Line (Terminal)

If you're comfortable with terminal:

### Step 1: Get Connection String
Your Railway DATABASE_URL looks like:
```
postgresql://username:password@host:port/database
```

### Step 2: Open Terminal/Command Prompt

**On Windows:**
- Press `Win + R`
- Type `cmd`
- Press Enter

**On Mac:**
- Press `Cmd + Space`
- Type `terminal`
- Press Enter

**On Linux:**
- Open your terminal application

### Step 3: Run psql Command

**Replace the connection string with your actual one:**

```bash
psql postgresql://username:password@host:port/database -c "UPDATE shipments SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;"
```

**Or connect interactively:**

```bash
psql postgresql://username:password@host:port/database
```

Then type:
```sql
UPDATE shipments SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;
```

Then type: `\q` to exit

---

## If You Don't Know Your Database Credentials

### Option A: Check Railway Dashboard
1. Go to Railway.app
2. Click your project
3. Click **PostgreSQL** plugin
4. Look for **Variables** tab
5. Copy the **DATABASE_URL**

### Option B: Check Your .env File (Local)
If you have a `.env` file in your project:
```
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Option C: Ask Me!
If you're stuck, you can share the steps you've tried and I can help further.

---

## QUICKEST METHOD SUMMARY

**If on Railway:**
1. Go to https://railway.app/
2. Click your project → PostgreSQL plugin → Data tab
3. Copy and paste the SQL command
4. Click Run
5. Done! ✅

**Total time: 2 minutes**

---

## After Running the Command

### Step 1: Verify It Worked
Paste this in the same SQL editor:
```sql
SELECT COUNT(*) FROM shipments WHERE latest_status = 'stored';
```

Should return a number (your shipment count)

### Step 2: Refresh Your App
1. Hard refresh browser: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
2. Go to **Suppliers** view
3. Open DevTools: **F12**
4. Check **Console** tab

### Step 3: Look for Success
You should see:
```
[SupplierMetrics] On-time (Warehouse): AROMSA {
  totalShipments: 4,
  inWarehouse: 4,          ← NOT 0!
  percentage: 75           ← REAL NUMBER!
}
```

✅ **Metrics are now working!**

---

## Troubleshooting

### Error: "Command not recognized" (Terminal)
- **Solution:** Make sure PostgreSQL is installed
- **Or use Method 1 (Railway GUI)** - no installation needed

### Error: "permission denied"
- **Solution:** Check your password/credentials
- **Check DATABASE_URL** in Railway dashboard

### Command runs but nothing happens
- **Check:** Are you connected to the right database?
- **Check:** Did you include the semicolon (`;`) at the end?

### Still showing inWarehouse: 0 after fix?
1. Hard refresh browser: **Ctrl+Shift+R**
2. Clear cache: **Ctrl+Shift+Delete** → Clear all
3. Log out and log back in
4. Reload page

---

## Success Checklist

- [ ] Found your database (Railway/pgAdmin/local)
- [ ] Opened SQL editor/query tool
- [ ] Copied the SQL command
- [ ] Ran/executed the command
- [ ] Saw "UPDATE X" message (success confirmation)
- [ ] Verified with SELECT command
- [ ] Hard refreshed browser
- [ ] Checked console in Suppliers view
- [ ] See metrics with REAL percentages! ✅

---

## Still Stuck?

1. **Which method are you using?** (Railway, pgAdmin, Terminal?)
2. **What error message do you see?** (copy-paste it)
3. **What happened?** (nothing, error, etc.)

Let me know and I can provide more specific help! 🚀
