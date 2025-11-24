# Supplier Performance Metrics - Results Guide

## What the Metrics Now Show

All Supplier Performance Metrics are now drawn from the **Warehouse Storage Report**. This means they reflect only shipments that have physically arrived at and been stored in the warehouse.

## Metric Definitions

### 📈 On-Time Delivery %
**What it measures:** Percentage of warehouse shipments that arrived on or before their scheduled week

**Calculation:**
```
On-Time % = (Shipments received on time) / (Total warehouse shipments) × 100
```

**Status Filter:** Shipment must have status: `stored`, `received`, or `inspection_passed`

**Example:**
- Supplier has 10 total shipments
- 8 shipments are in warehouse (status: stored/received/inspection_passed)
- 7 of those 8 arrived on time
- Result: **87%**

**What triggers calculation:**
- Shipment has `weekNumber` (scheduled week)
- Shipment has `receivingDate` or `updatedAt` (actual arrival date)
- Shipment has warehouse status

---

### 🔍 Inspection Pass Rate %
**What it measures:** Percentage of warehouse shipments that passed inspection

**Calculation:**
```
Pass Rate % = (Shipments that passed inspection) / (Warehouse shipments inspected) × 100
```

**Status Filter:** Shipment must have warehouse status AND inspection data

**Example:**
- Supplier has 10 total shipments
- 8 shipments are in warehouse
- 5 warehouse shipments have been inspected
- 4 passed inspection, 1 failed
- Result: **80%**
- (Other 3 warehouse shipments not yet inspected, don't count)

**Special Cases:**
- **No data:** If no warehouse shipments have inspection data yet
- Shows "No data" in KPI card (this is correct)
- Inspection pass rate is optional - only shows when inspections exist

**What triggers calculation:**
- Shipment has warehouse status
- Shipment has `inspectionDate`
- Shipment has `inspectionStatus` (passed/failed)

---

### ⏱️ Avg Lead Time (days)
**What it measures:** Average number of days from scheduled delivery to actual warehouse arrival

**Calculation:**
```
Avg Lead Time = average(Actual date - Scheduled date) in days
```

**Status Filter:** Shipment must have warehouse status with dates

**Example:**
- Supplier has 10 total shipments
- 8 shipments are in warehouse
- 7 have receiving dates:
  - Shipment 1: 1 day early = -1 days
  - Shipment 2: 0 days (exactly on time) = 0 days
  - Shipment 3: 2 days late = 2 days
  - Shipment 4: 1 day early = -1 days
  - Shipment 5: 0 days = 0 days
  - Shipment 6: 3 days late = 3 days
  - Shipment 7: 1 day late = 1 days
- Average: (−1 + 0 + 2 + −1 + 0 + 3 + 1) ÷ 7 = 4 ÷ 7 ≈ **1 day**

**Interpretation:**
- Negative = Early arrival ✅
- Zero = Exactly on time ✅
- Positive = Late arrival ⚠️

**What triggers calculation:**
- Shipment has warehouse status
- Shipment has `receivingDate`
- Shipment has `weekNumber` or `selectedWeekDate`

---

### 📊 Supplier Grade
**What it measures:** Overall supplier performance rating (A, B, or C)

**Grade Criteria:**
| Grade | On-Time % | Quality % | Label | Color |
|-------|-----------|-----------|-------|-------|
| A | ≥ 85% | ≥ 90% or N/A | Excellent | 🟢 Green |
| B | ≥ 70% | ≥ 80% or N/A | Good | 🟡 Yellow |
| C | < 70% | < 80% | Needs Improvement | 🔴 Red |

**Examples:**
- On-Time: 90%, Quality: 95% → **Grade A (Excellent)** 🟢
- On-Time: 75%, Quality: 85% → **Grade B (Good)** 🟡
- On-Time: 60%, Quality: 70% → **Grade C (Needs Improvement)** 🔴
- On-Time: 85%, No quality data yet → **Grade A (Excellent)** 🟢 (quality N/A is acceptable)

---

### 📈 90-Day Trend
**What it measures:** Weekly performance trend over the last 90 days

**Shows:** Line graph displaying on-time % for each week

**Example:**
```
Week 1: 80%
Week 2: 85%
Week 3: 90%
Week 4: 87%
```

**Only includes:** Warehouse shipments from the last 90 days

---

### 📦 Total Shipments
**What it measures:** Total number of supplier's shipments in the warehouse

**Calculation:**
```
Total = Count of shipments with warehouse status
```

**Example:**
- Supplier has 10 total shipments in system
- 8 are in warehouse (status: stored/received/inspection_passed)
- **Displayed: 8**

**Why different from total?** Reflects inventory actually in warehouse, not all shipments (some may still be in transit)

---

## How to Read the KPI Cards

### Layout
```
┌─────────────────────────────┐
│  📈 On-Time Delivery        │
│                             │
│        87%                  │
│   [Sparkline trend]         │
│                             │
│  Grade: A (Excellent) 🟢    │
│                             │
│  Total Warehouse: 8/10 ✓    │
└─────────────────────────────┘
```

### What Each Section Means

**Percentage (87%)**
- Your on-time delivery rate for warehouse shipments
- Target: ≥ 85% for A grade

**Sparkline**
- Visual trend over 90 days
- Upward = Improving ⬆️
- Downward = Declining ⬇️
- Flat = Stable ➡️

**Grade (A - Excellent)**
- Overall performance rating
- Based on on-time + quality metrics

**Total Warehouse (8/10)**
- 8 = Shipments currently in warehouse
- 10 = Total shipments from this supplier
- Missing = Still in transit or pre-warehouse status

---

## When Metrics Show "No Data" or 0%

### Scenario 1: No Data (Inspection Pass Rate)
**Reason:** No warehouse shipments have been inspected yet

**Solution:**
1. Go to Shipping Schedule
2. Find warehouse shipment
3. Add `inspectionDate` and `inspectionStatus`
4. Save
5. Return to Suppliers view - metric should update

**This is normal** - Inspection is optional, not all suppliers may have quality data.

### Scenario 2: 0% (On-Time Delivery)
**Reason:** Warehouse shipments all arrived late

**Check Console:**
1. Open DevTools (F12)
2. Look for `[SupplierMetrics] On-time (Warehouse)` log
3. Check if `onTimeInWarehouse: 0`

**Possible causes:**
- All warehouse shipments missed scheduled date
- OR shipments don't have receiving dates set
- OR shipments don't have week numbers set

**Solution:**
1. Verify shipments have `weekNumber` (1-53)
2. Verify shipments have `receivingDate`
3. Check if they arrived before `selectedWeekDate`
4. Update if incorrect
5. Reload and check metrics

### Scenario 3: 0% (Lead Time or Low Total)
**Reason:** Not enough warehouse data

**Check Console:**
- Look for warehouse shipment count
- If `inWarehouse: 0`, shipments are still in transit
- If `warehouseShipments: 0`, change status to "stored" or "received"

**Solution:**
1. Update more shipments to warehouse status
2. Ensure they have receiving dates
3. Return to Suppliers view
4. Metrics will update automatically

---

## Comparing with Warehouse Storage Report

### Key Alignment
The Supplier Performance Metrics now use **exactly the same shipment filtering** as the Warehouse Storage Report:

**Both include shipments with status:**
- ✅ `stored`
- ✅ `received`
- ✅ `inspection_passed`

**Both exclude shipments with status:**
- ❌ `planned_airfreight`
- ❌ `in_transit_airfreight`
- ❌ `arrived_pta` (arrived but not yet stored)
- ❌ `arrived_klm`
- ❌ `arrived_offsite`

### Example
If Warehouse Storage Report shows:
```
AB Mauri: 8 shipments
```

Then Supplier Performance Metrics should show:
```
Total Warehouse: 8
```

If they don't match, check:
1. Supplier names match exactly (case-insensitive but whitespace matters)
2. Both are looking at same week/date range
3. Shipment statuses are correct

---

## Expected Console Logs

When viewing Suppliers page, you should see:

```
[SupplierMetrics] On-time (Warehouse): AB Mauri {
  totalShipments: 10,
  inWarehouse: 8,
  onTimeInWarehouse: 7,
  percentage: 87,
  warehouseStatuses: ["stored", "received"]
}

[SupplierMetrics] Inspection (Warehouse): AB Mauri {
  totalShipments: 10,
  warehouseShipments: 8,
  passed: 7,
  statuses: ["passed", "failed"],
  percentage: 87,
  sample: [...]
}

[SupplierMetrics] Lead Time (Warehouse): AB Mauri {
  totalShipments: 10,
  warehouseShipments: 8,
  avgDays: 2,
  sample: [1, 2, 3]
}
```

**Key indicators:**
- `inWarehouse` < `totalShipments` = Some shipments still in transit ✓
- `onTimeInWarehouse` > 0 = Some arrived on time ✓
- `percentage` > 0 = Metrics calculated successfully ✓
- `passed` ≥ 0 = Inspection data present ✓

---

## Quick Troubleshooting

| Problem | Check | Fix |
|---------|-------|-----|
| All metrics show 0% | `inWarehouse: 0` in console | Update shipment status to "stored" |
| Only Total shows data | Other logs don't exist | Check console for errors |
| Different from last month | Check week/date filter | Metrics auto-calculate from current data |
| Inspection says "No data" | `warehouseShipments: 0` with inspections | This is correct - no inspections yet |
| Grades all show C | Check on-time % value | Increase on-time delivery percentage |

---

## Summary

✅ **Metrics now focus exclusively on Warehouse Storage Report data**
- Only warehouse shipments (stored/received/inspection_passed) counted
- Directly aligned with physical warehouse inventory
- Clearer accountability for supplier warehouse performance
- Console logs show warehouse vs total shipment breakdown
- All calculations transparent and debuggable

🎯 **Your suppliers' metrics now accurately reflect warehouse operations performance!**
