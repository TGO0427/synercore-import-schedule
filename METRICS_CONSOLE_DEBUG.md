# Supplier Performance Metrics - Console Debugging Guide

## The Issue You're Seeing

**Metrics showing only "Total Shipments" with other metrics at 0% or "No data"**

This means:
- ✅ Supplier-shipment name matching is working (total shipments count is correct)
- ❌ But the other metric calculations are returning 0 or null
- ❌ This usually means required fields are missing from shipment data

## How to Debug

### Step 1: Open Browser Console
1. Press `F12` or right-click → "Inspect"
2. Go to **Console** tab
3. Make sure **all messages are visible** (filter set to "All")

### Step 2: Navigate to Suppliers View
1. Click **"🏢 Suppliers"** in sidebar
2. **Keep the console open** - watch for new logs

### Step 3: Look for `[SupplierMetrics]` Logs

You'll see logs like this:

```
[SupplierMetrics] On-time: ABC Supplier {
  total: 5,
  arrived: 0,
  statuses: ["planned_airfreight"],
  percentage: 0
}
```

## What Each Log Tells You

### On-Time Delivery Log
```
[SupplierMetrics] On-time: ABC Supplier {
  total: 5,
  arrived: 0,
  statuses: ["planned_airfreight", "in_transit_airfreight"],
  percentage: 0
}
```

**Interpretation:**
- `total: 5` - 5 shipments for this supplier
- `arrived: 0` - 0 shipments have "arrived" status
- `statuses: [...]` - These are the statuses actually in your data
- `percentage: 0` - Result is 0% (expected if no arrived shipments)

**Why it might be 0:**
1. **Shipments not yet arrived** - Status is still "planned" or "in_transit"
   - Fix: Update shipment status to arrived (ARRIVED_PTA, ARRIVED_KLM, ARRIVED_OFFSITE, STORED, or RECEIVED)

2. **Status format different** - Your database has different status values
   - Fix: Update shipment status to match expected values

3. **All shipments are in pre-arrival states**
   - Expected: This is correct behavior
   - Fix: No action needed, wait for shipments to arrive

### Inspection Pass Rate Log
```
[SupplierMetrics] Inspection Pass Rate: ABC Supplier {
  total: 5,
  passed: 0,
  statuses: [null, "failed"],
  percentage: 0
}
```

**Interpretation:**
- `total: 5` - 5 shipments for this supplier
- `passed: 0` - 0 inspections passed
- `statuses: [null, "failed"]` - Some have no inspection, some failed
- `percentage: 0` - Result is 0%

**Why it might be 0 (or show "No data"):**
1. **No inspections done yet** - `inspectionDate` is null
   - Expected: Shows "No data" in KPI card (this is correct)
   - Fix: Perform inspections to generate data

2. **All inspections failed** - All have `inspectionStatus: "failed"`
   - Expected: This is correct behavior
   - Fix: No action needed or investigate quality issues

3. **Missing inspection data** - Required fields not populated
   - Fix: Update shipment inspection fields

### Lead Time Log
```
[SupplierMetrics] Lead Time: ABC Supplier {
  total: 5,
  withDates: 2,
  avgDays: 3,
  sample: [2, 4]
}
```

**Interpretation:**
- `total: 5` - 5 shipments for supplier
- `withDates: 2` - Only 2 have both `receivingDate` AND `weekNumber`
- `avgDays: 3` - Average 3 days from scheduled to actual
- `sample: [2, 4]` - First two lead times were 2 and 4 days

**Why it might be null:**
1. **No receiving dates** - Shipments haven't been received yet
   - Expected: Shows "N/A" in KPI card (this is correct)
   - Fix: Complete the receiving workflow

2. **Missing week numbers** - Some shipments don't have `weekNumber`
   - Fix: Add week number to all shipments

3. **No scheduled dates** - Missing both `selectedWeekDate` and `weekNumber`
   - Fix: Add these dates to shipments

## Real Examples

### Scenario 1: Perfect Data
```
[SupplierMetrics] On-time: ABC Supplier {
  total: 10,
  arrived: 9,
  statuses: ["arrived_pta", "stored", "received"],
  percentage: 90
}

[SupplierMetrics] Inspection Pass Rate: ABC Supplier {
  total: 9,
  passed: 8,
  statuses: ["passed", "failed"],
  percentage: 89
}

[SupplierMetrics] Lead Time: ABC Supplier {
  total: 10,
  withDates: 9,
  avgDays: 2,
  sample: [1, 2, 3]
}
```

**Result:** KPI cards show:
- ✅ On-Time: 90%
- ✅ Inspection Pass: 89%
- ✅ Avg Lead Time: 2 days
- ✅ Grade: A-Grade (Excellent)

### Scenario 2: Shipments Not Arrived Yet
```
[SupplierMetrics] On-time: ABC Supplier {
  total: 5,
  arrived: 0,
  statuses: ["planned_airfreight", "in_transit_airfreight"],
  percentage: 0
}
```

**Result:** KPI cards show:
- ⚠️ On-Time: 0% (expected - shipments still in transit)
- ⚠️ Inspection Pass: No data (expected - not arrived yet)
- ⚠️ Avg Lead Time: N/A (expected - no receiving dates)

**Action:** This is normal. Wait for shipments to arrive and complete workflow.

### Scenario 3: Missing Data Fields
```
[SupplierMetrics] Lead Time: ABC Supplier {
  total: 5,
  withDates: 0,
  avgDays: 0,
  sample: []
}
```

**Result:** KPI cards show:
- ⚠️ Avg Lead Time: N/A

**Problem:** None of the 5 shipments have both `receivingDate` AND `weekNumber`

**Solution:**
1. Check shipment data
2. Add receiving dates to completed shipments
3. Ensure week numbers are set (1-53)

## Console Log Locations

The logs will appear **EVERY TIME** you:
1. Navigate to Suppliers view
2. Data reloads from API
3. Metrics are recalculated

Look for these prefixes in console:
- `[App]` - Data loading
- `[SupplierManagement]` - Data received by component
- `[MetricsDebugPanel]` - Debug panel renders
- `[SupplierKPICard]` - KPI card warnings
- `[SupplierMetrics]` - **← This shows why metrics are 0**

## Diagnostic Workflow

```
KPI cards show all metrics with data?
  ├─ YES → SUCCESS! ✓ Metrics are working
  │
  └─ NO → Open Console and look for [SupplierMetrics] logs
         │
         ├─ On-time: percentage = 0?
         │  ├─ arrived: 0
         │  │ └─ Fix: Update shipment status to arrived
         │  │
         │  └─ statuses: ["planned_airfreight", ...]
         │     └─ Fix: No shipments have arrived status yet
         │
         ├─ Lead Time: withDates = 0?
         │  ├─ total > 0 but withDates = 0
         │  │ └─ Fix: Add receivingDate and weekNumber to shipments
         │  │
         │  └─ Some shipments missing dates
         │     └─ Fix: Update shipment workflow
         │
         └─ Inspection Pass Rate: Not logged?
            └─ No inspections done yet (expected)
               Fix: Complete inspection workflow
```

## Required Fields for Each Metric

### On-Time Delivery %
**Required:**
- ✅ `latestStatus` - Must be: arrived_pta, arrived_klm, arrived_offsite, stored, or received
- ✅ `weekNumber` - Must be 1-53
- ✅ `receivingDate` or `updatedAt` - When shipment arrived

**Optional:**
- `selectedWeekDate` - Scheduled arrival date

### Inspection Pass Rate %
**Required:**
- ✅ `inspectionDate` - Must be set to have data
- ✅ `inspectionStatus` - Must be: passed, failed

**Note:** Shows "No data" if no inspections. This is correct.

### Average Lead Time
**Required:**
- ✅ `receivingDate` - Actual arrival date
- ✅ `weekNumber` - Scheduled week
- ✅ `selectedWeekDate` OR `weekNumber` - For scheduled date

**Note:** Shows "N/A" if no receiving dates. This is correct.

### Total Shipments
**Required:**
- ✅ `supplier` - Must match supplier name

**Note:** Always shows if supplier name matches.

## Checking Shipment Fields

To verify what data is in your shipments:

```javascript
// In browser console, run:
fetch('/api/shipments')
  .then(r => r.json())
  .then(data => {
    const sample = data[0];
    console.table({
      'Has latestStatus': !!sample.latestStatus,
      'Has receivingDate': !!sample.receivingDate,
      'Has weekNumber': !!sample.weekNumber,
      'Has inspectionDate': !!sample.inspectionDate,
      'Has inspectionStatus': !!sample.inspectionStatus,
      'latestStatus value': sample.latestStatus,
      'inspectionStatus value': sample.inspectionStatus
    });
  });
```

This shows you exactly what fields are populated in your shipment data.

## Still Not Working?

1. **Check all console logs** - Look for errors
2. **Check [SupplierMetrics] logs** - See exactly why metrics are 0
3. **Check shipment data** - Run the fetch command above
4. **Compare with required fields** - Verify all needed fields are present
5. **Update shipments** - Add missing required fields
6. **Reload page** - `Ctrl+Shift+R` or `Cmd+Shift+R`
7. **Check console again** - New logs should show with updated data
