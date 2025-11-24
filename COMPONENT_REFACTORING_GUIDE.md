# Component Refactoring Guide

## Overview
This guide explains how to refactor monolithic components into smaller, focused components using Zustand stores to eliminate prop drilling.

## Problem Statement

### Before (Monolithic)
```jsx
// ShipmentTable.jsx - 2,133 lines
export function ShipmentTable({
  shipments,
  loading,
  onUpdate,
  onDelete,
  onArchive,
  onFilter,
  onSort,
  // ... 20+ more props
}) {
  // 2,000+ lines of:
  // - Filtering logic
  // - Sorting logic
  // - Inline editing
  // - Bulk actions
  // - Archiving
  // - Status updates
}
```

**Issues:**
- Hard to test (need to provide 20+ props)
- Hard to maintain (many responsibilities)
- Hard to reuse (tightly coupled to parent)
- Slow to develop (conflicts, cognitive load)
- Impossible to understand at a glance

### After (Modular + Zustand)
```jsx
// ShipmentTable.jsx - ~200 lines
export function ShipmentTable() {
  const { shipments, loading } = useShipmentStore();

  return (
    <div>
      <ShipmentFilters />
      <ShipmentTableView />
      <ShipmentBulkActions />
      <ShipmentPagination />
    </div>
  );
}

// Each sub-component is focused and reusable
```

**Benefits:**
- Easier to test (no prop drilling)
- Easier to maintain (single responsibility)
- Easier to reuse (can use in other views)
- Faster to develop (parallel work possible)
- Self-documenting (clear purpose)

---

## Refactoring Process

### Step 1: Create Custom Hooks (if needed)
Extract complex logic into custom hooks:

```jsx
// src/hooks/useShipmentFiltering.js
export function useShipmentFiltering(shipments) {
  const [filters, setFilters] = useState({
    status: null,
    supplier: null,
    week: null,
  });

  const filtered = useMemo(() => {
    return shipments.filter(s => {
      if (filters.status && s.latestStatus !== filters.status) return false;
      if (filters.supplier && s.supplier !== filters.supplier) return false;
      if (filters.week && s.weekNumber !== filters.week) return false;
      return true;
    });
  }, [shipments, filters]);

  return { filters, setFilters, filtered };
}
```

### Step 2: Create Sub-components
Break monolithic component into focused sub-components:

```jsx
// src/components/ShipmentManagement/

// 1. ShipmentFilters.jsx - Handles filtering UI
// 2. ShipmentTableView.jsx - Renders table rows
// 3. ShipmentEditor.jsx - Inline editing
// 4. ShipmentBulkActions.jsx - Bulk operations
// 5. ShipmentPagination.jsx - Pagination controls
```

### Step 3: Use Zustand Stores Instead of Props

**Before (Props):**
```jsx
<ShipmentTableView
  shipments={shipments}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
/>
```

**After (Zustand):**
```jsx
function ShipmentTableView() {
  const { shipments, updateShipment, deleteShipment } = useShipmentStore();

  return (
    // render
  );
}
```

### Step 4: Organize Components into Feature Folders

```
src/components/ShipmentManagement/
├── index.js
├── ShipmentTable.jsx          # Main component (container)
├── ShipmentFilters.jsx        # Filter controls
├── ShipmentTableView.jsx      # Table view
├── ShipmentEditor.jsx         # Inline editor
├── ShipmentBulkActions.jsx    # Bulk operations
├── ShipmentPagination.jsx     # Pagination
├── ShipmentRow.jsx            # Single row
├── useShipmentData.js         # Custom hook (if needed)
└── shipmentManagement.css
```

### Step 5: Create Shared Components

```
src/components/Common/
├── DataTable.jsx              # Reusable table component
├── FormInput.jsx              # Reusable form input
├── Modal.jsx                  # Reusable modal
├── LoadingSpinner.jsx         # Loading indicator
├── Pagination.jsx             # Reusable pagination
├── Filters.jsx                # Reusable filter panel
└── common.css
```

---

## Example: Refactoring ShipmentTable

### Original (Monolithic - 2,133 lines)
```jsx
// src/components/ShipmentTable.jsx
export function ShipmentTable({
  shipments, loading, onUpdate, onDelete,
  suppliers, onFilter, onSort, ...props
}) {
  const [filters, setFilters] = useState({});
  const [sorting, setSorting] = useState({});
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);

  // 2,100+ more lines...

  return (
    <div className="shipment-table-wrapper">
      {/* Filters */}
      {/* Table */}
      {/* Bulk actions */}
      {/* Pagination */}
      {/* Inline editor */}
    </div>
  );
}
```

### Refactored (Modular + Zustand)

#### 1. Main Container (~200 lines)
```jsx
// src/components/ShipmentManagement/ShipmentTable.jsx
import { useShipmentStore } from '../../stores';
import ShipmentFilters from './ShipmentFilters';
import ShipmentTableView from './ShipmentTableView';
import ShipmentBulkActions from './ShipmentBulkActions';
import ShipmentPagination from './ShipmentPagination';

export function ShipmentTable() {
  const { shipments, loading, fetchShipments } = useShipmentStore();

  useEffect(() => {
    fetchShipments();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="shipment-table-wrapper">
      <ShipmentFilters />
      <ShipmentTableView shipments={shipments} />
      <ShipmentBulkActions />
      <ShipmentPagination />
    </div>
  );
}
```

#### 2. Filters Component (~100 lines)
```jsx
// src/components/ShipmentManagement/ShipmentFilters.jsx
import { useState } from 'react';
import { useShipmentStore } from '../../stores';

export function ShipmentFilters() {
  const [filters, setFilters] = useState({
    status: null,
    supplier: null,
    week: null,
  });

  const { fetchShipmentsByStatus } = useShipmentStore();

  const handleStatusChange = (status) => {
    setFilters(prev => ({ ...prev, status }));
    fetchShipmentsByStatus(status);
  };

  return (
    <div className="shipment-filters">
      <select onChange={(e) => handleStatusChange(e.target.value)}>
        <option value="">All Status</option>
        {/* Status options */}
      </select>
      {/* More filters */}
    </div>
  );
}
```

#### 3. Table View Component (~150 lines)
```jsx
// src/components/ShipmentManagement/ShipmentTableView.jsx
import ShipmentRow from './ShipmentRow';

export function ShipmentTableView({ shipments }) {
  return (
    <div className="shipment-table">
      <table>
        <thead>
          <tr>
            <th>Order Ref</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map(shipment => (
            <ShipmentRow key={shipment.id} shipment={shipment} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### 4. Single Row Component (~80 lines)
```jsx
// src/components/ShipmentManagement/ShipmentRow.jsx
import { useShipmentStore } from '../../stores';

export function ShipmentRow({ shipment }) {
  const { updateShipment, deleteShipment } = useShipmentStore();
  const [editing, setEditing] = useState(false);

  const handleUpdate = async (updates) => {
    await updateShipment(shipment.id, updates);
    setEditing(false);
  };

  return (
    <tr className="shipment-row">
      <td>{shipment.orderRef}</td>
      <td>{shipment.supplier}</td>
      <td>
        {editing ? (
          <StatusEditor
            current={shipment.latestStatus}
            onSave={handleUpdate}
          />
        ) : (
          shipment.latestStatus
        )}
      </td>
      <td>
        <button onClick={() => setEditing(true)}>Edit</button>
        <button onClick={() => deleteShipment(shipment.id)}>Delete</button>
      </td>
    </tr>
  );
}
```

#### 5. Bulk Actions Component (~100 lines)
```jsx
// src/components/ShipmentManagement/ShipmentBulkActions.jsx
import { useState } from 'react';
import { useShipmentStore } from '../../stores';

export function ShipmentBulkActions() {
  const [selected, setSelected] = useState([]);
  const { updateShipment } = useShipmentStore();

  const handleBulkUpdate = async (status) => {
    for (const id of selected) {
      await updateShipment(id, { latestStatus: status });
    }
    setSelected([]);
  };

  return (
    <div className="bulk-actions">
      <button onClick={() => handleBulkUpdate('archived')}>
        Archive ({selected.length})
      </button>
      {/* More bulk actions */}
    </div>
  );
}
```

---

## Benefits of This Refactoring

### Code Quality
- ✅ Each component <300 LOC (from 2,000+)
- ✅ Single responsibility principle
- ✅ No prop drilling
- ✅ Easier to test

### Developer Experience
- ✅ Easier to find code
- ✅ Parallel development possible
- ✅ Faster code reviews
- ✅ Fewer merge conflicts

### Reusability
- ✅ ShipmentRow can be used in mobile view
- ✅ ShipmentFilters can be used in reports
- ✅ Common components shared across features

### Maintainability
- ✅ Changes isolated to specific components
- ✅ No cascading prop changes
- ✅ Clear data flow (via Zustand store)

---

## Migration Checklist

- [ ] Create Zustand stores (shipment, supplier, ui, auth)
- [ ] Create custom hooks (useShipmentFiltering, etc.)
- [ ] Create sub-components for ShipmentTable
- [ ] Update ShipmentTable to use sub-components
- [ ] Test with Zustand stores instead of props
- [ ] Update WarehouseCapacity component similarly
- [ ] Update SupplierManagement component similarly
- [ ] Create reusable Common components
- [ ] Update tests to use Zustand stores
- [ ] Remove prop drilling from App.jsx

---

## Testing with Zustand Stores

### Before (Prop-based testing)
```jsx
describe('ShipmentTableView', () => {
  it('should render shipments', () => {
    render(
      <ShipmentTableView
        shipments={[mockShipment]}
        onUpdate={jest.fn()}
        // ... 10+ more props
      />
    );
  });
});
```

### After (Store-based testing)
```jsx
describe('ShipmentTableView', () => {
  it('should render shipments from store', () => {
    // Mock the store
    useShipmentStore.setState({
      shipments: [mockShipment],
    });

    render(<ShipmentTableView />);

    expect(screen.getByText(mockShipment.orderRef)).toBeInTheDocument();
  });
});
```

---

## Next Steps

1. **Implement Zustand stores** (✓ Done)
2. **Create folder structure** for components
3. **Break down ShipmentTable** into sub-components
4. **Create Common components** (DataTable, Modal, etc.)
5. **Update App.jsx** to use stores instead of state
6. **Create tests** for new components
7. **Do the same for WarehouseCapacity** and **SupplierManagement**
