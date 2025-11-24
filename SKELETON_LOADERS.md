# Loading Skeletons - Usage Guide

This guide explains how to use the skeleton loader components to improve loading UX.

## Quick Start

### Import
```javascript
import { SkeletonTable, SkeletonForm, SkeletonShipmentTable } from './components/SkeletonLoaders';
```

### Basic Usage
```javascript
import { SkeletonWrapper, SkeletonTable } from './components/SkeletonLoaders';

function MyComponent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  return (
    <SkeletonWrapper
      isLoading={loading}
      skeleton={() => <SkeletonTable rows={10} columns={5} />}
    >
      <YourActualTable data={data} />
    </SkeletonWrapper>
  );
}
```

---

## Available Components

### 1. **SkeletonPulse** - Basic Building Block
Generic skeleton element with customizable dimensions and animation.

**Props:**
- `width` (string, default: '100%') - Width of skeleton
- `height` (string, default: '20px') - Height of skeleton
- `borderRadius` (string, default: '4px') - Border radius
- `className` (string, default: '') - Additional CSS class

**Example:**
```javascript
<SkeletonPulse width="200px" height="40px" borderRadius="6px" />
```

---

### 2. **SkeletonTable** - Full Table
Simulates a complete table with header and rows.

**Props:**
- `rows` (number, default: 5) - Number of rows to show
- `columns` (number, default: 5) - Number of columns

**Example:**
```javascript
function ShipmentList() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    fetchShipments().then(data => {
      setShipments(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <SkeletonTable rows={10} columns={5} />;
  return <ShipmentTable shipments={shipments} />;
}
```

---

### 3. **SkeletonShipmentTable** - Specialized for Shipments
Optimized skeleton specifically for shipment table views.

**Props:**
- `rows` (number, default: 10) - Number of skeleton rows

**Example:**
```javascript
import { SkeletonShipmentTable } from './components/SkeletonLoaders';

function ShipmentSchedule() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  return (
    <>
      {loading ? (
        <SkeletonShipmentTable rows={15} />
      ) : (
        <ShipmentTable shipments={shipments} />
      )}
    </>
  );
}
```

---

### 4. **SkeletonForm** - Form Fields
Simulates a form with multiple input fields.

**Props:**
- `fields` (number, default: 4) - Number of form fields

**Example:**
```javascript
import { SkeletonForm } from './components/SkeletonLoaders';

function EditSupplier() {
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);

  useEffect(() => {
    fetchSupplier().then(data => {
      setSupplier(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <SkeletonForm fields={5} />;
  return <SupplierForm supplier={supplier} />;
}
```

---

### 5. **SkeletonCard** - Single Card
Simulates a card with image, title, and content.

**Example:**
```javascript
<SkeletonCard />
```

---

### 6. **SkeletonCardGrid** - Multiple Cards
Grid of skeleton cards.

**Props:**
- `count` (number, default: 4) - Number of cards
- `columns` (number, default: 4) - Number of columns

**Example:**
```javascript
import { SkeletonCardGrid } from './components/SkeletonLoaders';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);

  return (
    <>
      {loading ? (
        <SkeletonCardGrid count={8} columns={4} />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}
    </>
  );
}
```

---

### 7. **SkeletonList** - List of Items
Simulates a list with multiple items.

**Props:**
- `items` (number, default: 5) - Number of list items

**Example:**
```javascript
import { SkeletonList } from './components/SkeletonLoaders';

function UserList() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  return (
    <>
      {loading ? (
        <SkeletonList items={8} />
      ) : (
        <UserListComponent users={users} />
      )}
    </>
  );
}
```

---

### 8. **SkeletonHeader** - Page Header
Simulates a page header with navigation.

**Example:**
```javascript
<SkeletonHeader />
```

---

### 9. **SkeletonPage** - Full Page
Complete page skeleton with header, sidebar, and main content.

**Example:**
```javascript
import { SkeletonPage } from './components/SkeletonLoaders';

function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  return loading ? <SkeletonPage /> : <Dashboard />;
}
```

---

### 10. **SkeletonWrapper** - Conditional Wrapper
Wrapper component that conditionally shows skeleton or content.

**Props:**
- `isLoading` (boolean) - Whether to show skeleton
- `skeleton` (React component) - Skeleton to show while loading
- `children` (React elements) - Content to show when loaded

**Example:**
```javascript
import { SkeletonWrapper, SkeletonTable } from './components/SkeletonLoaders';

function ShipmentData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  return (
    <SkeletonWrapper
      isLoading={loading}
      skeleton={() => <SkeletonTable rows={12} columns={6} />}
    >
      <ShipmentTable data={data} />
    </SkeletonWrapper>
  );
}
```

---

## Real-World Examples

### Example 1: ShipmentTable with Loading State
```javascript
import { useState, useEffect } from 'react';
import { SkeletonShipmentTable } from './components/SkeletonLoaders';
import ShipmentTable from './components/ShipmentTable';

function ShipmentScheduleView() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadShipments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/shipments');
        const data = await response.json();
        setShipments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadShipments();
  }, []);

  if (error) return <div className="error">Error: {error}</div>;
  if (loading) return <SkeletonShipmentTable rows={15} />;

  return <ShipmentTable shipments={shipments} />;
}

export default ShipmentScheduleView;
```

---

### Example 2: Form with Skeleton
```javascript
import { useState, useEffect } from 'react';
import { SkeletonForm } from './components/SkeletonLoaders';

function EditUserForm({ userId }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(userData => {
      setUser(userData);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <SkeletonForm fields={6} />;

  return (
    <form>
      <input defaultValue={user.name} />
      <input defaultValue={user.email} />
      {/* ... more fields ... */}
    </form>
  );
}

export default EditUserForm;
```

---

### Example 3: Dashboard with Multiple Loaders
```javascript
import { useState, useEffect } from 'react';
import { SkeletonCardGrid, SkeletonTable } from './components/SkeletonLoaders';

function Dashboard() {
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchMetrics().then(data => {
        setMetrics(data);
        setLoadingMetrics(false);
      }),
      fetchShipments().then(data => {
        setShipments(data);
        setLoadingShipments(false);
      })
    ]);
  }, []);

  return (
    <div>
      <section>
        <h2>Metrics</h2>
        {loadingMetrics ? (
          <SkeletonCardGrid count={6} columns={3} />
        ) : (
          <MetricsGrid metrics={metrics} />
        )}
      </section>

      <section>
        <h2>Recent Shipments</h2>
        {loadingShipments ? (
          <SkeletonTable rows={8} columns={5} />
        ) : (
          <ShipmentTable shipments={shipments} />
        )}
      </section>
    </div>
  );
}

export default Dashboard;
```

---

## Styling & Customization

### Animation Speed
The pulse animation can be customized by modifying the CSS:

```css
.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite; /* Change 1.5s duration */
}
```

### Colors
For light/dark mode, the CSS includes media queries:

```css
@media (prefers-color-scheme: dark) {
  .skeleton-pulse {
    background-color: #2a2a2a; /* Dark mode color */
  }
}
```

### Custom Skeleton
Create a custom skeleton by combining SkeletonPulse components:

```javascript
function CustomSkeleton() {
  return (
    <div className="custom-skeleton">
      <SkeletonPulse width="100%" height="60px" />
      <SkeletonPulse width="80%" height="20px" />
      <SkeletonPulse width="90%" height="20px" />
    </div>
  );
}
```

---

## Best Practices

1. **Show skeleton immediately** - Skeleton should appear as soon as loading state is true
2. **Maintain layout** - Skeleton dimensions should match final content dimensions
3. **Duration** - Keep loading states short; optimize API calls
4. **Accessibility** - Skeletons should be marked as loading with appropriate ARIA labels
5. **Responsive** - Test skeletons on different screen sizes
6. **Performance** - Use SkeletonWrapper for automatic switching between states

---

## Integration with Existing Components

Update your existing components to use skeleton loaders:

```javascript
// Before
<ShipmentTable shipments={shipments} loading={loading} />

// After (Better UX)
{loading ? (
  <SkeletonShipmentTable rows={10} />
) : (
  <ShipmentTable shipments={shipments} />
)}
```

---

## Support

For issues or feature requests, refer to the component implementations in:
- `/src/components/SkeletonLoaders.jsx`
- `/src/components/SkeletonLoaders.css`
