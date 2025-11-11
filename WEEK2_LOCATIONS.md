# 📍 WEEK 2 Features - Location Guide

## Your App Tabs
You have these tabs in the navigation (left sidebar):
- 📦 Shipping Schedule
- 🏢 **Suppliers** ← This is where SupplierManagement lives!
- 🏭 **Warehouse Capacity** ← This is where we enhance capacity viewing!
- 📋 Product & Warehouse
- 📋 Post-Arrival Workflow
- 📊 Reports
- 📈 Advanced Reports
- 📦 Shipment Archives
- 💰 Rates & Quotes
- 🏪 Warehouse Stored
- (Admin only) 👥 User Management

---

## Where You'll See the New Features

### 1. 📊 Supplier KPI Dashboard
**Location:** Click on the `🏢 Suppliers` button in the left sidebar

**Current state:** Shows supplier list with document management
**New addition:** KPI metrics section at the top of each supplier card

**What you'll see:**
```
┌─────────────────────────────────────────────────┐
│ SUPPLIER MANAGEMENT                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─ Siemens AG ──────────────────────────────┐  │
│ │  📈 On-Time Delivery: 87% (↑ +5%)         │  │
│ │  ✅ Inspection Pass Rate: 94% (✓ Excellent)  │
│ │  ⏱️  Avg Lead Time: 32 days                │  │
│ │  📦 Total Shipments: 45                   │  │
│ │                                            │  │
│ │  [90-Day Trend Chart] ▲▲▼▲▲              │  │
│ │  Status: A-Grade Supplier                │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌─ Schneider Electric ──────────────────────┐  │
│ │  📈 On-Time Delivery: 72% (↓ -8%)         │  │
│ │  ✅ Inspection Pass Rate: 81% (⚠️ Warning)  │
│ │  ⏱️  Avg Lead Time: 45 days                │  │
│ │  📦 Total Shipments: 28                   │  │
│ │                                            │  │
│ │  [90-Day Trend Chart] ▲▼▼▼▲              │  │
│ │  Status: B-Grade Supplier                │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**File to modify:** `src/components/SupplierManagement.jsx`
**New component to create:** `src/components/SupplierKPICard.jsx`

**Metrics Calculated:**
- ✅ **On-Time Delivery %** = (Shipments arrived by scheduled week / Total shipments) × 100
- ✅ **Inspection Pass Rate %** = (Passed inspections / Total inspections) × 100
- ✅ **Average Lead Time (days)** = Average(Actual arrival - Scheduled arrival)
- ✅ **Total Shipments** = Count of all shipments from this supplier
- ✅ **90-Day Trend** = Line chart showing metric changes over last 90 days

**Grading System:**
- 🟢 **A-Grade:** On-Time > 85%, Pass Rate > 90%
- 🟡 **B-Grade:** On-Time 70-85%, Pass Rate 80-90%
- 🔴 **C-Grade:** On-Time < 70%, Pass Rate < 80%

---

### 2. 📈 Warehouse Capacity Trends
**Location:** Click on the `🏭 Warehouse Capacity` button in the left sidebar

**Current state:** Shows real-time bin usage for 3 warehouses
**New addition:** Historical trends + 8-week forecast below current metrics

**What you'll see:**
```
┌─────────────────────────────────────────────────────────────┐
│ WAREHOUSE CAPACITY MANAGEMENT                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [CURRENT STATUS - Already exists in your app]             │
│ PRETORIA:  ████████░░ 81% (528/650 bins)                 │
│ KLAPMUTS:  ███░░░░░░░ 32% (123/384 bins)                 │
│ OFFSITE:   ██░░░░░░░░ 18% (69/384 bins)                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [NEW] 30-DAY CAPACITY HISTORY                             │
│                                                             │
│ PRETORIA Trend:                                            │
│ 100%│          ╱╲    ╱╲                    Current: 81%    │
│  80%├─────────╱  ╲╱╲╱  ╲╱──────────────────────           │
│  60%├────────────────────────────                          │
│  40%├────────────────────────────                          │
│  20%├────────────────────────────                          │
│   0%└────────────────────────────────                      │
│      30d ago                      Today                    │
│      ↑ Peak: 92% (5 days ago)                             │
│      ↓ Low: 65% (18 days ago)                             │
│      📊 Trend: Gradually increasing                        │
│                                                             │
│ KLAPMUTS Trend:                                            │
│ 100%├─────────────────────────────────                    │
│  80%├─────────────────────────────────                    │
│  60%│   ╱╲      ╱╲                                         │
│  40%├──╱  ╲────╱  ╲───────────────────────                │
│  20%├──────────────────────────────                       │
│   0%└────────────────────────────────                     │
│      30d ago                      Today                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [NEW] 8-WEEK CAPACITY FORECAST                            │
│                                                             │
│ Based on planned arrivals + current inventory             │
│                                                             │
│ Week  │ PRETORIA → │ KLAPMUTS → │ OFFSITE → │ Alert      │
│ Now   │ 528/650    │ 123/384    │ 69/384    │ ✓ OK       │
│ +1w   │ 587/650    │ 156/384    │ 142/384   │ ⚠️ WARN    │
│ +2w   │ 615/650    │ 198/384    │ 198/384   │ ⚠️ WARN    │
│ +3w   │ 642/650    │ 243/384    │ 234/384   │ 🔴 CRITICAL│
│ +4w   │ 598/650    │ 187/384    │ 156/384   │ ✓ OK       │
│ +5w   │ 612/650    │ 201/384    │ 178/384   │ ✓ OK       │
│ +6w   │ 628/650    │ 219/384    │ 195/384   │ ⚠️ WARN    │
│ +7w   │ 651/650    │ 267/384    │ 287/384   │ 🔴 OVERFLOW│
│ +8w   │ 645/650    │ 256/384    │ 271/384   │ 🔴 OVERFLOW│
│                                                             │
│ 💡 Recommendations:                                        │
│    • Week +3: Move 50 pallets from PRETORIA to KLAPMUTS  │
│    • Week +7: Expect overflow - arrange offsite storage   │
│    • Week +8: Incoming from 3 suppliers delays needed     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Export as PDF] [Share Forecast] [View Details]            │
└─────────────────────────────────────────────────────────────┘
```

**File to modify:** `src/components/WarehouseCapacity.jsx`
**New components to create:**
- `src/components/CapacityTrendChart.jsx` (line chart showing 30-day history)
- `src/components/CapacityForecast.jsx` (8-week prediction table)

**Data Captured:**
- ✅ Daily snapshot of bins_used per warehouse (stored in `warehouse_capacity_history` table)
- ✅ Incoming shipments per week per warehouse (from shipment week_number + receiving_warehouse)
- ✅ 8-week forecast using current + incoming

**Alerts Generated:**
- 🟢 **OK:** < 80% capacity
- 🟡 **WARNING:** 80-95% capacity
- 🔴 **CRITICAL:** > 95% capacity
- 🔴 **OVERFLOW:** > 100% capacity

---

## Implementation Timeline for WEEK 2

### Phase 1: Supplier KPI Dashboard (2 hours)
1. **Add KPI calculation engine** (`src/utils/supplierMetrics.js`)
   - Calculate on-time delivery % per supplier
   - Calculate inspection pass rate % per supplier
   - Calculate average lead time per supplier
   - Grade suppliers A/B/C

2. **Create SupplierKPICard component** (shows metrics for one supplier)
   - Display KPI badges with trending indicators
   - Show 90-day trend sparkline chart
   - Display supplier grade

3. **Integrate into SupplierManagement**
   - Render KPI card above each supplier
   - Add sorting by KPI metrics
   - Add filter for supplier grades

### Phase 2: Warehouse Capacity Trends (2 hours)
1. **Create CapacityTrendChart component**
   - 30-day historical line chart
   - Peak/low indicators
   - Trend direction annotation

2. **Create CapacityForecast component**
   - Calculation engine for 8-week forecast
   - Smart recommendations (redistribution, delays)
   - Color-coded alerts (OK/WARN/CRITICAL/OVERFLOW)

3. **Integrate into WarehouseCapacity**
   - Insert history chart below current status
   - Insert forecast table below history
   - Add recommendation notifications

---

## Database Changes Required

### For Supplier KPIs:
- ✅ Uses existing `shipments` table (already has: latest_status, inspection_date, inspection_status, received_quantity, receiving_date)
- ✅ Uses existing `suppliers` table
- **No new tables needed** - All data already captured!

### For Capacity Trends:
- ✅ Uses existing `warehouse_capacity_history` table (already created in your migrations)
  - Already logs: warehouse_name, bins_used, changed_at
- **Query optimization:** Add index on (warehouse_name, changed_at)
  ```sql
  CREATE INDEX IF NOT EXISTS idx_warehouse_capacity_history_warehouse_date
  ON warehouse_capacity_history(warehouse_name, changed_at DESC);
  ```

---

## Ready to Build?

Both features require:
- ✅ Existing data (no migrations needed)
- ✅ New UI components only
- ✅ New utility functions for calculations

**Estimated Build Time:** 4 hours total (2 hrs each)
**Testing Time:** 30 mins
**Total:** ~4.5 hours

Should I start building **WEEK 2** now? 🚀
