# Debugging Supplier Performance Metrics - Complete Guide

## Step 1: Open Browser Console

1. **Open DevTools**: Press `F12` or right-click → "Inspect"
2. **Go to Console tab**
3. **Keep console open while navigating**

## Step 2: Navigate to Suppliers View

1. **Click "🏢 Suppliers"** in the sidebar
2. **Watch the Console** - you should see logs appearing

## Step 3: Look for These Logs (In Order)

### Log 1: App.jsx Loading Suppliers
```
[App] Suppliers loaded: {count: 5, names: Array(5)}
```

**What to check:**
- ✅ Is count > 0? (If 0, suppliers table is empty)
- ✅ Are names listed? (Click the Array to expand)

### Log 2: App.jsx Loading Shipments
```
[App] Shipments loaded: {count: 25, suppliers: Array(4)}
```

**What to check:**
- ✅ Is count > 0? (If 0, shipments table is empty)
- ✅ Are suppliers listed? (Click Array to see names)

### Log 3: SupplierManagement Receives Props
```
[SupplierManagement] Received props: {suppliersCount: 5, shipmentsCount: 25, suppliers: Array(5), shipmentSuppliers: Array(4)}
```

**What to check:**
- ✅ Does suppliersCount match [App] output?
- ✅ Does shipmentsCount match [App] output?
- ✅ Are supplier names correct?

### Log 4: MetricsDebugPanel Mounts
```
[MetricsDebugPanel] Received data: {suppliersCount: 5, shipmentsCount: 25, suppliers: Array(5), shipmentsSample: Array(3)}
```

**What to check:**
- ✅ Does data match previous logs?
- ✅ Can you see shipmentsSample data?

### Log 5: SupplierKPICard Warnings (If No Match)
```
[SupplierKPICard] No matching shipments for supplier "ABC Supplier".
Available suppliers in data: [Array(4)]
```

**What to check:**
- ⚠️ If you see this, supplier name isn't matching shipment names
- ⚠️ Click the Array to see what names ARE in shipments
- ⚠️ Edit supplier or shipment to fix the name

---

## Diagnostic Flow Chart

```
START
  ↓
Is [App] Suppliers loaded: count > 0?
  ├─ NO  → Problem: No suppliers in database
  │       Fix: Create suppliers first
  │       Then re-check logs
  │
  └─ YES → Is [App] Shipments loaded: count > 0?
           ├─ NO  → Problem: No shipments in database
           │       Fix: Import shipments first
           │       Then re-check logs
           │
           └─ YES → Is SupplierManagement suppliersCount > 0?
                   ├─ NO  → Problem: Data not reaching component
                   │       Fix: Check if props are being passed
                   │       Reload page and try again
                   │
                   └─ YES → Scroll down to Debug Panel
                           Look at "Matched Suppliers" section
                           ├─ Empty? → Supplier names don't match!
                           │           Fix: Edit supplier/shipment names
                           │           to match exactly
                           │
                           └─ Has suppliers? → Should see KPI cards
                                               ├─ Shows data? → SUCCESS! ✓
                                               │
                                               └─ Shows 0%?  → Check if
                                                               shipments have
                                                               required fields
```

---

## Common Problems and Fixes

### Problem 1: No Logs Appear at All

**Cause:** Component not rendering or page not reloading

**Solution:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Wait 2-3 seconds for data to load
3. Check console again

### Problem 2: Suppliers Count is 0

**Cause:** No suppliers in database

**Solution:**
1. Go to Supplier Management
2. Click "+ Add New Supplier"
3. Fill in supplier details
4. Click "Add Supplier"
5. Return to Suppliers view
6. Check logs again

### Problem 3: Shipments Count is 0

**Cause:** No shipments imported

**Solution:**
1. Create a CSV file with shipment data:
   ```
   supplier,product_name,week_number,quantity
   "ABC Supplier","Product A",10,100
   "ABC Supplier","Product B",11,150
   ```

2. Go to Shipping Schedule
3. Click "📁 File Upload"
4. Select CSV file and upload
5. Wait for import to complete
6. Return to Suppliers view
7. Check logs again

### Problem 4: Suppliers and Shipments Both Have Data, But Metrics Show 0%

**Cause:** Supplier names don't match exactly

**Solution:**
1. Look at logs - expand supplier names arrays:
   - **suppliers:** ["ABC Supplier Inc"]
   - **shipmentSuppliers:** ["ABC Supplier"]

2. Notice the mismatch: "ABC Supplier Inc" vs "ABC Supplier"

3. Fix by either:
   **Option A:** Edit supplier name
   - Go to Supplier Management
   - Click supplier to edit
   - Change name from "ABC Supplier Inc" to "ABC Supplier"
   - Save

   **Option B:** Edit shipment supplier
   - Go to Shipping Schedule
   - Click shipment
   - Change supplier from "ABC Supplier" to "ABC Supplier Inc"
   - Save

4. Return to Suppliers view and check logs again

### Problem 5: Debug Panel Shows "No Matched Suppliers"

**Cause:** All supplier names have mismatches

**Solution:**
1. Open Debug Panel
2. Look at both columns:
   - Left: "Supplier Names" - your registered suppliers
   - Right: "Shipment Suppliers" - names in shipment data
3. Edit either suppliers or shipments to make names match
4. Ensure exact match (case-insensitive, whitespace matters)

### Problem 6: Metrics Show But Are All 0%

**Cause:** Shipments don't have required fields for calculation

**Solution:**
Check shipment data has:
1. ✅ **latestStatus** - One of: ARRIVED_PTA, ARRIVED_KLM, ARRIVED_OFFSITE, STORED, RECEIVED (for on-time %)
2. ✅ **weekNumber** - A number 1-53 (for lead time)
3. ✅ **selectedWeekDate** or **estimatedArrival** (for on-time date comparison)
4. ✅ **receivingDate** (optional, for lead time calculation)
5. ✅ **inspectionDate** + **inspectionStatus** (optional, for quality %)

If shipments are missing these fields:
- Go to Shipping Schedule
- Click shipment to edit
- Fill in the missing fields
- Save
- Metrics should update

---

## Advanced Debugging

### Check Exact Data Format

In console, run:
```javascript
// See exact shipment supplier names
fetch('/api/shipments')
  .then(r => r.json())
  .then(data => {
    const suppliers = [...new Set(data.map(s => s.supplier))];
    console.table(suppliers);
  });

// See exact supplier names
fetch('/api/suppliers')
  .then(r => r.json())
  .then(data => {
    const names = data.map(s => s.name);
    console.table(names);
  });
```

### Test API Endpoints Directly

```bash
# Get all supplier metrics (backend calculation)
curl https://your-app.com/api/suppliers/metrics/all

# Get specific supplier metrics
curl https://your-app.com/api/suppliers/1/metrics
```

### Check Database Directly

If you have database access:
```sql
-- Count suppliers
SELECT COUNT(*) as supplier_count FROM suppliers;

-- Count shipments
SELECT COUNT(*) as shipment_count FROM shipments;

-- See unique supplier names in shipments
SELECT DISTINCT supplier FROM shipments ORDER BY supplier;

-- See supplier names
SELECT name FROM suppliers ORDER BY name;
```

---

## Expected Console Output (Success Case)

```
[App] Suppliers loaded: {count: 3, names: ["ABC Supplier", "XYZ Corp", "Global Trading"]}

[App] Shipments loaded: {count: 15, suppliers: ["ABC Supplier", "Global Trading", "XYZ Corp"]}

[SupplierManagement] Received props: {suppliersCount: 3, shipmentsCount: 15, suppliers: Array(3), shipmentSuppliers: Array(3)}

[MetricsDebugPanel] Received data: {suppliersCount: 3, shipmentsCount: 15, suppliers: Array(3), shipmentsSample: Array(3)}

(No [SupplierKPICard] warnings)

→ KPI cards display with data! ✓
```

## Expected Console Output (Failure Case)

```
[App] Suppliers loaded: {count: 3, names: ["ABC Supplier Inc", "XYZ Corp", "Global Trading"]}

[App] Shipments loaded: {count: 15, suppliers: ["ABC Supplier", "Global Trading", "XYZ Corp"]}

[SupplierManagement] Received props: {...}

[MetricsDebugPanel] Received data: {...}

[SupplierKPICard] No matching shipments for supplier "ABC Supplier Inc".
Available suppliers in data: ["ABC Supplier", "Global Trading", "XYZ Corp"]

→ Debug Panel shows "ABC Supplier Inc" under "Unmmatched Suppliers"
→ KPI cards show 0% metrics
→ Fix: Change "ABC Supplier Inc" to "ABC Supplier" in suppliers
```

---

## Still Not Working?

1. **Clear browser cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Click "Clear all"

2. **Clear localStorage:**
   - Run in console: `localStorage.clear()`
   - Reload page and log in again

3. **Hard refresh:**
   - `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

4. **Check database directly:**
   - Verify suppliers exist in database
   - Verify shipments exist in database
   - Verify names match exactly

5. **Check server logs:**
   - Look for errors in server console
   - Check for API response errors

6. **Test API manually:**
   - Use curl or Postman to test endpoints
   - Verify data is coming from backend
