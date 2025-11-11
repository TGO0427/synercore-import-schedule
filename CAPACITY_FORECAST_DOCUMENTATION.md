# 8-Week Capacity Forecast Documentation

## Overview

The 8-Week Capacity Forecast predicts bin usage for the next 8 weeks by analyzing incoming shipments and estimating warehouse occupancy. This helps with proactive inventory planning and preventing capacity overflow.

## What Is Being Measured?

The forecast predicts **bin usage** (not pallets) for the next 8 weeks by analyzing incoming shipments and estimating warehouse occupancy.

### Key Metrics

| Metric | Definition |
|--------|-----------|
| **Bins** | Individual storage units (the actual measurement unit) |
| **Pallets** | Incoming shipment quantities |
| **Capacity** | Max bins per warehouse (PRETORIA: 650, KLAPMUTS: 384, Offsite: 384) |
| **Projected Bins Used** | Estimated total bins occupied in each week |
| **% Utilization** | (Projected Bins Used / Total Capacity) × 100 |

## The Calculation Formula

For **each week** (Week 0 through Week 8):

```
1. INCOMING PALLETS = Sum of all shipments arriving that week
                       (filtered by: week number, warehouse, and "planned" status)

2. INCOMING BINS = Ceil(Incoming Pallets × 1)
                   (assumes 1 pallet = 1 bin)

3. ESTIMATED BINS USED (Current Week Only):
   = Current bins already in warehouse

4. ESTIMATED BINS USED (Future Weeks):
   = Current bins - (Incoming Bins × 0.3)
   (assumes 30% of stock naturally leaves the warehouse per week)

5. PROJECTED BINS USED = Round(Estimated Bins + Incoming Bins)

6. PERCENT USED = Round((Projected Bins / Total Capacity) × 100)
```

## Status Color Coding

| Alert Level | Utilization | Color | Action |
|------------|-------------|-------|--------|
| 🟢 **OK** | < 80% | Green | Normal operations |
| 🟡 **WARNING** | 80-95% | Yellow | Monitor closely |
| 🔴 **CRITICAL** | 95-100% | Orange | Redistribute stock |
| 🔴 **OVERFLOW** | > 100% | Red | Urgent action needed |

## Smart Recommendations

The forecast generates actionable recommendations:
- **OVERFLOW**: "Move X pallets to another warehouse"
- **CRITICAL**: "Consider redistributing from PRETORIA to KLAPMUTS if available"
- **WARNING**: "PRETORIA approaching capacity (XX%)"

## Data Filtering Criteria

Shipments are included in the forecast if they:
1. ✅ Have a scheduled week number
2. ✅ Are assigned to a specific warehouse
3. ✅ Have a "planned" status (includes):
   - planned_airfreight
   - planned_seafreight
   - in_transit_airfreight
   - in_transit_seaway
   - in_transit_roadway
   - moored
   - berth_working
   - berth_complete

## Decay Rate Explanation

### What is the Decay Rate?

The decay rate is **30% per week** - it represents the assumption that inventory naturally **decreases** each week as products leave the warehouse.

**Code Reference (capacityForecast.js, line 88):**
```javascript
estimatedBinsUsed = Math.max(0, (currentBinsUsed[warehouse] || 0) - (incomingBins * 0.3));
```

This means: **For each week, we subtract 30% of the incoming bins from the previous week's stock.**

### Why Does This Exist?

In a real warehouse:
- ✅ Products are sold/shipped to customers
- ✅ Items are returned or removed
- ✅ Stock naturally reduces over time
- ✅ Not everything sits forever

The decay rate tries to model this **natural reduction in inventory** so the forecast isn't overly pessimistic.

### How It Works - Step by Step

Let's say you have:
- **Current bins used**: 300
- **Week +1 incoming**: 100 pallets (= 100 bins)

**Current Week (Week 0):**
```
Estimated bins used = 300 (actual current state)
Incoming bins = 100
Projected bins = 300 + 100 = 400 bins
```

**Week +1:**
```
Estimated bins used = 300 - (100 × 0.3) = 300 - 30 = 270 bins
                      ↑        ↑     ↑
                   Start   Decay  Rate
                   point   amount

Incoming bins = 150
Projected bins = 270 + 150 = 420 bins
```

**Week +2:**
```
Estimated bins used = 270 - (150 × 0.3) = 270 - 45 = 225 bins
Incoming bins = 80
Projected bins = 225 + 80 = 305 bins
```

### Visual Example Timeline

```
Week 0 (Now):    300 bins + 100 incoming = 400 bins used (69% of 650)
Week +1:         270 bins + 150 incoming = 420 bins used (65% of 650)
Week +2:         225 bins + 80 incoming  = 305 bins used (47% of 650)
Week +3:         260 bins + 120 incoming = 380 bins used (58% of 650)
Week +4:         296 bins + 90 incoming  = 386 bins used (59% of 650)
...
```

Notice how the projected bins **fluctuates** based on:
1. How much stock naturally leaves (decay)
2. How much new stock arrives (incoming)

### The Problem With Current Decay Rate

The current model has an issue:

**Line 88 uses:**
```javascript
estimatedBinsUsed = Math.max(0, (currentBinsUsed[warehouse] || 0) - (incomingBins * 0.3));
```

This **always subtracts from the ORIGINAL current bins**, NOT cumulative decay.

#### ❌ Current (Incorrect) Behavior:
```
Week 0: Start with 300 bins
Week 1: 300 - (100 × 0.3) = 270 bins
Week 2: 300 - (150 × 0.3) = 255 bins  ← Always subtracts from original 300!
Week 3: 300 - (80 × 0.3)  = 276 bins  ← Not cumulative
```

#### ✅ What It Should Do (Cumulative):
```
Week 0: Start with 300 bins
Week 1: 300 - 30 = 270 bins (30 left this week)
Week 2: 270 - 45 = 225 bins (45 left this week)
Week 3: 225 - 24 = 201 bins (24 left this week)
```

### When Decay Rate Matters Most

The decay rate becomes most important when:

| Scenario | Impact |
|----------|--------|
| **High incoming every week** | Keeps forecast optimistic (fewer days without relief) |
| **Sporadic incoming** | More significant decay between shipments |
| **Warehouse with slow-moving items** | Decay too high (needs adjustment) |
| **Warehouse with fast-moving items** | Decay too low (needs adjustment) |

**Example: Fast-moving warehouse (retail):**
- Current rate: 30% per week might be too low
- Could be 50-70% per week

**Example: Slow-moving warehouse (long-term storage):**
- Current rate: 30% per week might be too high
- Could be 5-10% per week

### The 30% Assumption Breakdown

Where does 30% come from? The code comment says:
> "Assume some items leave warehouse each week (50% reduction of old stock per month)"

**Translation:**
- 50% of stock leaves per month
- Per week = approximately **12% per week**...

**But the code uses 30%!** This is likely a conservative estimate to account for:
- Processing delays
- Returns and rejects
- Damaged goods removal
- Stock transfers between warehouses

### Real-World vs. Forecast

| Real Scenario | Current Forecast | Reality Check |
|---------------|------------------|---------------|
| 100 bins arrive, sell 30 that week | Decay removes 30 | ✅ Realistic |
| 100 bins arrive, sell 50 that week | Decay removes 30 | ❌ Too optimistic |
| 0 bins arrive, have 200 in stock | Decay removes 0 | ❌ Too pessimistic |
| Multiple small orders arrive | Decay per pallet | ❌ Can be inaccurate |

## Example Calculation

```
Current Week (Week 45):
- PRETORIA has 400 bins used
- 50 pallets scheduled to arrive (= 50 bins incoming)
- Projected: 400 + 50 = 450 bins
- Capacity: 650 bins
- Utilization: (450/650) × 100 = 69% ✅ OK

Week +1 (Week 46):
- 80 pallets scheduled to arrive (= 80 bins incoming)
- Estimated used: 400 - (80 × 0.3) = 376 bins (decay)
- Projected: 376 + 80 = 456 bins
- Utilization: (456/650) × 100 = 70% ✅ OK
```

## Why This Matters

✅ **Proactive Planning**: See capacity issues 8 weeks in advance
✅ **Inventory Redistribution**: Move stock between warehouses early
✅ **Budget Planning**: Plan for additional storage if needed
✅ **Supplier Communication**: Alert suppliers to delay/expedite shipments

## Implementation Details

- **Location**: `src/utils/capacityForecast.js`
- **Component**: `src/components/CapacityForecastTable.jsx`
- **Warehouse Capacities**:
  - PRETORIA: 650 bins
  - KLAPMUTS: 384 bins
  - Offsite: 384 bins
- **Decay Rate**: 30% per week (configurable in `capacityForecast.js`)
- **Forecast Weeks**: 0 (current) through 8 (8 weeks ahead)

## Future Enhancements

1. **Make decay rate configurable** - Different per warehouse type
2. **Implement cumulative decay** - More accurate week-to-week tracking
3. **Historical analysis** - Calculate actual decay rate from past data
4. **Seasonal adjustments** - Account for peak/off-peak periods
5. **Custom alerts** - User-defined utilization thresholds
6. **Export forecasts** - Save/compare forecasts over time

## Configuration

To adjust the decay rate, modify `capacityForecast.js`:

```javascript
// Line 88 - Change the 0.3 value
estimatedBinsUsed = Math.max(0, (currentBinsUsed[warehouse] || 0) - (incomingBins * 0.3));
//                                                                                    ↑
//                                                                    Adjust this (0.0 - 1.0)
```

- **0.1**: Very conservative (10% decay per week)
- **0.3**: Current setting (30% decay per week)
- **0.5**: Aggressive (50% decay per week)

## Related Files

- `src/utils/capacityForecast.js` - Forecast calculation logic
- `src/components/CapacityForecastTable.jsx` - UI display component
- `src/components/WarehouseCapacity.jsx` - Parent component
