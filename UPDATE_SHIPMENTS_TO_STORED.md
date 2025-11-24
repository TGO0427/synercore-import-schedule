# Quick Fix: Update Shipments to Warehouse Status

## The Issue

Your metrics show:
```
[SupplierMetrics] On-time (Warehouse): AROMSA {
  totalShipments: 4,
  inWarehouse: 0,        ← PROBLEM! No warehouse shipments
  percentage: 0
}
```

**Why?** Your shipments are in PRE-WAREHOUSE statuses like:
- `planned_airfreight`
- `in_transit_airfreight`
- `arrived_pta`

Metrics only count WAREHOUSE statuses:
- `stored` ✅
- `received` ✅
- `inspection_passed` ✅

---

## Solution: Update Shipments to "Stored" Status

### Option 1: Direct Database Update (FASTEST - 1 minute)

Run this SQL command:

```sql
-- Update ALL shipments to 'stored' status
UPDATE shipments
SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;

-- Verify the update
SELECT COUNT(*) as total, COUNT(CASE WHEN latest_status = 'stored' THEN 1 END) as stored_count
FROM shipments;
```

**Expected result:** All rows should have `latest_status = 'stored'`

---

### Option 2: Via UI (Slower but Safe)

1. **Go to Shipping Schedule**
2. **For each shipment:**
   - Click to edit
   - Change status to: `stored`
   - Save

3. **Or use Bulk Update (if available):**
   - Select all shipments (checkbox)
   - Click "Bulk Status Update"
   - Set to: `stored`
   - Save all

---

### Option 3: Via API Script

```bash
# Update via API (requires auth token)
curl -X POST https://synercore-import-schedule-production.up.railway.app/api/shipments/{shipment_id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latestStatus": "stored"}'
```

---

## After Update - What to Expect

### Console Should Show:
```javascript
[SupplierMetrics] On-time (Warehouse): AROMSA {
  totalShipments: 4,
  inWarehouse: 4,          ← NOW ALL IN WAREHOUSE!
  onTimeInWarehouse: 3,
  percentage: 75,          ← REAL PERCENTAGE!
  warehouseStatuses: ["stored"]
}

[SupplierMetrics] Inspection (Warehouse): AROMSA {
  totalShipments: 4,
  warehouseShipments: 4,
  passed: 2,
  percentage: 50
}

[SupplierMetrics] Lead Time (Warehouse): AROMSA {
  totalShipments: 4,
  warehouseShipments: 4,
  avgDays: 2
}
```

✅ **Metrics now working!**

### KPI Cards Will Show:
```
📈 On-Time Delivery
75%
[Sparkline trend]
Grade: B (Good) 🟡
Total Warehouse: 4 ✓
```

---

## Why This Works

The warehouse metrics system specifically filters for warehouse statuses:

```javascript
// From src/utils/supplierMetrics.js
const isInWarehouse = [
  'stored',           // ✅ Included
  'received',         // ✅ Included
  'inspection_passed' // ✅ Included
  // 'arrived_pta', 'in_transit_airfreight', etc. are NOT included
].includes(s.latestStatus);
```

So your shipments must have one of these three statuses to be counted.

---

## Valid Warehouse Status Progression

Ideally, shipments should follow this workflow:

```
Planned/In Transit
  ↓
Arrived (pta/klm/offsite)
  ↓
Unloading
  ↓
Inspection Pending
  ↓
Inspecting
  ↓
Inspection Passed (or Failed)
  ↓
Receiving
  ↓
Received
  ↓
STORED ← Final status
```

For testing/demos, you can jump directly to `stored`.

---

## Complete List of Valid Statuses

**Pre-Warehouse (Not counted by metrics):**
- planned_airfreight
- planned_seafreight
- in_transit_airfreight
- air_customs_clearance
- in_transit_roadway
- in_transit_seaway
- moored
- berth_working
- berth_complete
- arrived_pta
- arrived_klm
- arrived_offsite
- delayed
- cancelled

**Post-Warehouse Workflow (Counted by metrics):**
- unloading
- inspection_pending
- inspecting
- inspection_failed
- inspection_passed ✅
- receiving
- received ✅
- stored ✅ (RECOMMENDED)

---

## Step-by-Step: Quick Database Fix

1. **Open your database client** (pgAdmin, DBeaver, etc.)

2. **Run this SQL:**
   ```sql
   UPDATE shipments
   SET latest_status = 'stored', updated_at = CURRENT_TIMESTAMP;
   ```

3. **Verify:**
   ```sql
   SELECT latest_status, COUNT(*) FROM shipments GROUP BY latest_status;
   ```
   Should show all rows with `stored`

4. **Test in App:**
   - Hard refresh (Ctrl+Shift+R)
   - Go to Suppliers view
   - Check console
   - Metrics should now show percentages!

---

## Troubleshooting

### Still showing inWarehouse: 0?
- Check that update was applied: `SELECT DISTINCT latest_status FROM shipments;`
- Hard refresh browser (Ctrl+Shift+R)
- Check if receiving_date is set (needed for some calculations)

### Metrics show 0% after status update?
- Check if shipments have `weekNumber` set
- Check if shipments have `receivingDate` set
- Both are used for on-time calculation

### Need to revert changes?
```sql
UPDATE shipments
SET latest_status = 'planned_airfreight'
WHERE latest_status = 'stored';
```

---

## Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Run SQL UPDATE to set status to 'stored' | 1 min |
| 2 | Hard refresh browser | 1 min |
| 3 | Check console for metric calculations | 1 min |
| 4 | Verify KPI cards show percentages | 1 min |

**Total: 4 minutes to working metrics!** ✅

---

## Next: Fine-Tune Your Data

After getting metrics working, you might want to:

1. **Set accurate dates:** Update `receivingDate`, `weekNumber` for accurate lead time
2. **Add inspection data:** Set `inspectionDate`, `inspectionStatus` for quality metrics
3. **Progress shipments:** Move them through proper workflow (arrived → inspection → received → stored)

But for now, just get them to `'stored'` status and metrics will display! 🚀
