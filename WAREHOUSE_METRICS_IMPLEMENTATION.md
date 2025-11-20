# Warehouse Storage Metrics Implementation

## Overview

All supplier performance metrics have been updated to draw exclusively from the Warehouse Storage Report data. This means metrics now only calculate based on shipments that have reached the warehouse (status: `stored`, `received`, or `inspection_passed`).

## Changes Made

### 1. On-Time Delivery Percentage
**File:** `src/utils/supplierMetrics.js:28-84`

**What Changed:**
- Filters shipments to only those with warehouse statuses (stored, received, inspection_passed)
- Calculates percentage as: `(onTimeInWarehouse / totalWarehouseShipments) * 100`
- Distinguishes between total shipments and warehouse shipments in logging

**Console Output:**
```
[SupplierMetrics] On-time (Warehouse): AB Mauri {
  totalShipments: 10,
  inWarehouse: 8,
  onTimeInWarehouse: 7,
  percentage: 87,
  warehouseStatuses: ["stored", "received"]
}
```

**Impact:** Only shipments that physically made it to the warehouse are counted.

---

### 2. Inspection Pass Rate
**File:** `src/utils/supplierMetrics.js:90-132`

**What Changed:**
- Filters to warehouse shipments that have inspection data (inspectionDate + inspectionStatus)
- Calculates percentage only for warehouse shipments with inspections
- Returns `null` if no warehouse inspections exist

**Console Output:**
```
[SupplierMetrics] Inspection (Warehouse): AB Mauri {
  totalShipments: 10,
  warehouseShipments: 8,
  passed: 7,
  statuses: ["passed", "failed"],
  percentage: 87,
  sample: [
    { inspectionStatus: "passed", inspectionDate: "2025-11-16", latestStatus: "stored" },
    { inspectionStatus: "passed", inspectionDate: "2025-11-17", latestStatus: "inspection_passed" }
  ]
}
```

**Impact:** Quality metrics only reflect inspected warehouse shipments.

---

### 3. Average Lead Time
**File:** `src/utils/supplierMetrics.js:139-178`

**What Changed:**
- Filters to warehouse shipments with receiving dates and week numbers
- Calculates average lead time only from warehouse shipments
- Returns `null` if no warehouse shipments with dates exist

**Console Output:**
```
[SupplierMetrics] Lead Time (Warehouse): AB Mauri {
  totalShipments: 10,
  warehouseShipments: 8,
  avgDays: 2,
  sample: [1, 2, 3]
}
```

**Impact:** Lead time reflects only time to warehouse, not total supply chain time.

---

### 4. 90-Day Trend Calculation
**File:** `src/utils/supplierMetrics.js:185-233`

**What Changed:**
- Only includes warehouse shipments in weekly grouping
- Trend reflects warehouse performance metrics over 90 days
- Filters out pre-warehouse shipments from trend analysis

**Console Output:** (Implicit in KPI card sparklines)

**Impact:** Trend lines show warehouse performance trends, not arrival trends.

---

### 5. Total Shipments Count
**File:** `src/utils/supplierMetrics.js:266-280`

**What Changed:**
- Returns count of warehouse shipments only (not all supplier shipments)
- Provides accurate denominator for percentage calculations

**Impact:** Total shown in KPI cards represents warehouse inventory count.

---

### 6. On-Time Check Helper
**File:** `src/utils/supplierMetrics.js:286-304`

**What Changed:**
- Updated `isShipmentOnTime()` to only consider warehouse statuses
- Used by trend calculations to determine on-time status

**Impact:** Consistent warehouse-focused logic throughout calculations.

---

## Status Format Support

All methods support both database and code status formats:

**Warehouse Status Values Recognized:**
- `ShipmentStatus.STORED` or `'stored'`
- `ShipmentStatus.RECEIVED` or `'received'`
- `ShipmentStatus.INSPECTION_PASSED` or `'inspection_passed'`

**Case-Insensitive Inspection Status Matching:**
- `'PASSED'`, `'passed'`, or `InspectionStatus.PASSED`

---

## Data Flow

```
Shipments Collection
    ↓
Filter by Supplier Name (case-insensitive)
    ↓
Filter by Warehouse Status (stored/received/inspection_passed)
    ↓
Calculate Metrics
    ├─ On-Time %: (onTimeInWarehouse / totalWarehouse) * 100
    ├─ Inspection %: (passedInspections / warehouseInspected) * 100
    ├─ Lead Time: avg(actualDate - scheduledDate)
    ├─ 90-Day Trend: weekly warehouse performance
    └─ Total: warehouse shipment count
```

---

## Console Logging Pattern

Every metric calculation logs with this pattern:
```javascript
console.log(`[SupplierMetrics] [Metric Name] (Warehouse): ${supplierName}`, {
  totalShipments: [all supplier shipments],
  warehouseShipments: [shipments in warehouse],
  [metric-specific data],
  percentage: [result]
});
```

**To Debug:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to Suppliers view
4. Look for `[SupplierMetrics]` logs
5. Expand the log object to see warehouse vs total counts

---

## Expected Results

### Before Implementation (Old Logic)
- Metrics could include "arrived" shipments not yet in warehouse
- Inconsistent data sources (not tied to Warehouse Storage Report)
- Metrics showed metrics for pre-warehouse statuses

### After Implementation (Warehouse-Focused)
- Metrics ONLY include warehouse inventory (stored/received/inspection_passed)
- Data directly aligns with Warehouse Storage Report view
- Metrics reflect actual warehouse performance
- Clearer supplier accountability for warehouse operations

---

## Testing Checklist

When verifying the implementation:

1. ✅ Open browser console
2. ✅ Navigate to Suppliers view
3. ✅ Look for `[SupplierMetrics]` logs with "(Warehouse)" in the name
4. ✅ Verify `inWarehouse` counts are less than or equal to `totalShipments`
5. ✅ Check that metrics show percentages > 0 (if warehouse shipments exist)
6. ✅ Verify KPI cards display warehouse-based metrics
7. ✅ Compare with Warehouse Storage Report to confirm data alignment

---

## Troubleshooting

### Metrics Still Show 0%
- Check console logs for warehouse shipment count
- If `inWarehouse: 0`, shipments may still be in "planned" or "in_transit" status
- Update shipment status to "stored" or "received" to include in metrics

### Metrics Show Different Values Than Warehouse Report
- Verify shipment statuses match warehouse report filtering
- Check for status format mismatches (uppercase vs lowercase)
- Ensure week numbers and dates are populated
- Clear cache: Ctrl+Shift+Delete, then reload

### Missing Inspection Data
- Inspection logs should show `warehouseShipments` count
- If no inspections, percentage returns `null` (shown as "No data" in KPI cards)
- This is expected behavior - no inspections yet

---

## Code Commits

1. **Commit 1:** `b3d724b` - Update supplier metrics to filter for warehouse stored shipments
2. **Commit 2:** `74dd9b0` - Apply warehouse filtering to all supplier metrics calculations

Both commits maintain backward compatibility while refocusing metrics on warehouse data exclusively.
