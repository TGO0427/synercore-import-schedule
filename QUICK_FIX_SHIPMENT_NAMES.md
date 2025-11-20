# QUICK FIX: Shipment Supplier Names (5 Minutes)

## The Problem (In 30 Seconds)

You have shipments with **two different spellings** of the same supplier:
- `"Shakti Chemicals"` (WRONG - mixed case)
- `"SHAKTI CHEMICALS"` (CORRECT - uppercase)

Metrics can't figure out which one to use, so they fail.

---

## The Fix (Choose One Method)

### ⚡ Method 1: Database SQL (30 seconds)

```sql
UPDATE shipments
SET supplier = 'SHAKTI CHEMICALS'
WHERE supplier = 'Shakti Chemicals';
```

**Done!** All shipments now have correct name.

---

### 🖱️ Method 2: Manual UI (5 minutes)

1. **Go to Shipping Schedule**
2. **Look for supplier field with "Shakti Chemicals"** (mixed case)
3. **Click to edit** that cell
4. **Change to** `SHAKTI CHEMICALS`
5. **Save**
6. **Repeat** for any other "Shakti Chemicals" entries

---

## Verify the Fix (1 minute)

### In Database:
```sql
SELECT DISTINCT supplier FROM shipments ORDER BY supplier;
```

Should show:
```
AB Mauri
AROMSA
FUTURA INGREDIENTS
MARCEL TRADING
QUERCYL
QIDA CHEMICAL
SACCO
SHAKTI CHEMICALS    ← Only uppercase!
TRISTAR
```

NO "Shakti Chemicals" (mixed case)

### In App:
1. Refresh browser
2. Open DevTools (F12)
3. Go to Suppliers view
4. Check Console tab
5. Should see: `[SupplierMetrics] On-time (Warehouse): SHAKTI CHEMICALS`
6. Should NOT see: `No matching shipments`

---

## Expected After Fix

```
[SupplierMetrics] On-time (Warehouse): SHAKTI CHEMICALS {
  percentage: 80
}

[SupplierMetrics] Inspection (Warehouse): SHAKTI CHEMICALS {
  percentage: 60
}

[SupplierMetrics] Lead Time (Warehouse): SHAKTI CHEMICALS {
  avgDays: 2
}
```

✅ **Metrics working!**

---

## Done! 🎉

Your metrics will now show real data!

If you want more details, see: **FIX_SHIPMENT_SUPPLIER_NAMES.md**
