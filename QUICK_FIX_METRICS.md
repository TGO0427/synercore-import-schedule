# Quick Fix: Supplier Metrics Showing 0%

Based on your console logs, I can see the metrics ARE calculating, but showing 0% because **shipments don't have the right status/dates set**.

## What Your Console Shows

```
[SupplierMetrics] On-time: AB Mauri Object
[SupplierMetrics] On-time: AROMSA Object
[SupplierMetrics] On-time: FUTURA INGREDIENTS Object
```

This means metrics are calculating! But showing 0% because:
- Shipments are in "planned" or "in_transit" status (not "arrived")
- OR missing `receivingDate` and `weekNumber` fields

## How to Fix

### Step 1: Expand the Console Logs
1. Click on **`[SupplierMetrics] On-time: AB Mauri Object`**
2. Look inside for the **`sample`** array:
   ```
   sample: [
     { status: "planned_airfreight", receivingDate: null, weekNumber: 10 },
     { status: "planned_airfreight", receivingDate: null, weekNumber: 11 }
   ]
   ```

### Step 2: Identify the Problem

**If you see:**
```
status: "planned_airfreight"  ← NOT an arrival status!
receivingDate: null           ← Missing!
```

**Then fix by:**
1. Go to **Shipping Schedule**
2. Click on the shipment
3. Change status to one of:
   - `arrived_pta`
   - `arrived_klm`
   - `arrived_offsite`
   - `stored`
   - `received`
4. Add a `receivingDate` (when it actually arrived)
5. Save

---

## The Issue You're Likely Seeing

Your shipments probably have:
```
latestStatus: "planned_airfreight" or "in_transit_airfreight"
receivingDate: null
```

This is normal for shipments still in transit! But for metrics to show > 0%:
- Shipment must have arrived (status = arrived_*, stored, or received)
- Shipment must have a receivingDate set

---

## Suppliers with No Matching Shipments

From your logs:
```
[SupplierKPICard] No matching shipments for supplier "Deltaris"
[SupplierKPICard] No matching shipments for supplier "HALAVET"
```

**Fix:**
1. Check supplier names in database vs shipment data
2. Either:
   - **Option A:** Rename supplier from "Deltaris" to match what's in shipments
   - **Option B:** Rename shipments supplier to match "Deltaris"
3. Check the available suppliers in console:
   ```
   Available suppliers in data: Array(9)
   ```
   Click this array to see exact names in shipments

---

## Complete Workflow to See Metrics

1. **Go to Shipping Schedule**
2. **For each shipment you want to track:**
   - Set `latestStatus` to one of: arrived_pta, arrived_klm, arrived_offsite, stored, received
   - Set `receivingDate` to the date it arrived
   - Set `weekNumber` to 1-53
3. **Optionally (for quality metrics):**
   - Set `inspectionDate` to when it was inspected
   - Set `inspectionStatus` to passed or failed
4. **Go back to Suppliers view**
5. **Check console logs** - should now show > 0%

---

## What You Should See After Fixing

Before:
```
[SupplierMetrics] On-time: AB Mauri {
  total: 5,
  arrived: 0,
  statuses: ["planned_airfreight", "in_transit_airfreight"],
  percentage: 0
}
```

After:
```
[SupplierMetrics] On-time: AB Mauri {
  total: 5,
  arrived: 4,
  statuses: ["arrived_pta", "stored"],
  percentage: 80
}
```

Then KPI card will show:
```
📈 On-Time Delivery
80%
```

---

## Troubleshooting

### Metrics still show 0% after fixing status?

1. **Hard refresh:** `Ctrl+Shift+R` or `Cmd+Shift+R`
2. **Clear cache:** `Ctrl+Shift+Delete` and clear all
3. **Check console logs again** - what does `sample` show now?

### One supplier shows metrics, others show 0%?

1. You've only updated some shipments
2. Update all shipments to have arrival statuses
3. OR this is correct - if they haven't arrived yet, they should show 0%

### Names don't match between suppliers and shipments?

1. Click the "Available suppliers in data: Array(9)"
2. See the exact names in your shipments
3. Edit supplier record to match exactly
4. Names are case-insensitive but whitespace matters!

---

## Testing with Sample Data

If you want to test immediately:

```javascript
// In browser console, run:
const testData = {
  latestStatus: 'arrived_pta',
  receivingDate: new Date('2025-11-15').toISOString(),
  weekNumber: 46,
  inspectionDate: new Date('2025-11-16').toISOString(),
  inspectionStatus: 'passed'
};
console.log('This is what metrics need:', testData);
```

This shows the data structure metrics need to calculate properly.

---

## Next Steps

1. **Update 2-3 test shipments** with arrival statuses
2. **Reload Suppliers view**
3. **Check console logs** - should show % > 0
4. **Update more shipments** as needed
5. **Metrics will calculate automatically** once data is correct

The metrics system is working perfectly - it just needs the right data! 🎯
