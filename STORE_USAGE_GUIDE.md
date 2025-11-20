# Zustand Store Usage Guide

Quick reference for using Zustand stores in the application.

## Basic Usage

### Import Stores
```jsx
import { useShipmentStore, useSupplierStore, useUIStore, useAuthStore } from '../stores';
```

### Using in Components
```jsx
function MyComponent() {
  // Destructure what you need
  const { shipments, loading, fetchShipments } = useShipmentStore();
  const { activeView, setActiveView } = useUIStore();

  // Use like normal state
  return (
    <div>
      {loading ? 'Loading...' : shipments.length} shipments
    </div>
  );
}
```

---

## Store Reference

### useShipmentStore

#### State
```jsx
const {
  shipments,      // Array of shipments
  loading,        // Boolean - loading state
  error,          // String - error message
  statusFilter,   // String - current status filter
  lastSyncTime,   // Date - last sync timestamp
} = useShipmentStore();
```

#### Actions - Fetch
```jsx
// Fetch all shipments
const { fetchShipments } = useShipmentStore();
await fetchShipments();

// Fetch by status
const { fetchShipmentsByStatus } = useShipmentStore();
await fetchShipmentsByStatus('in_transit_airfreight');
```

#### Actions - CRUD
```jsx
const { createShipment, updateShipment, deleteShipment } = useShipmentStore();

// Create
const shipment = await createShipment({
  orderRef: 'ORD123',
  supplier: 'ABC Corp',
  quantity: 100,
});

// Update
await updateShipment('shipment-id', {
  latestStatus: 'arrived_pta',
  notes: 'Updated notes'
});

// Delete
await deleteShipment('shipment-id');
```

#### Actions - Workflow
```jsx
const {
  startUnloading,
  startInspection,
  completeInspection,
  startReceiving,
  markAsStored,
} = useShipmentStore();

await startUnloading('shipment-id');
await startInspection('shipment-id');
await completeInspection('shipment-id', true); // true = passed, false = failed
await startReceiving('shipment-id');
await markAsStored('shipment-id');
```

#### Actions - Real-time
```jsx
const { updateShipmentFromWebSocket } = useShipmentStore();

// Called from WebSocket handler
updateShipmentFromWebSocket('shipment-id', {
  latestStatus: 'arrived_klm',
  updatedAt: new Date(),
});
```

#### Actions - Utilities
```jsx
const { setStatusFilter, clearError } = useShipmentStore();

setStatusFilter('planned_airfreight');
clearError();
```

---

### useSupplierStore

#### State
```jsx
const {
  suppliers,  // Array of suppliers
  loading,    // Boolean - loading state
  error,      // String - error message
} = useSupplierStore();
```

#### Actions
```jsx
const {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  clearError,
} = useSupplierStore();

// Fetch
await fetchSuppliers();

// Create
const supplier = await createSupplier({
  name: 'New Supplier Inc',
  email: 'contact@supplier.com',
  phone: '+1-555-0000',
  country: 'China',
});

// Update
await updateSupplier('supplier-id', {
  name: 'Updated Name',
  email: 'newemail@supplier.com',
});

// Delete
await deleteSupplier('supplier-id');
```

---

### useUIStore

#### State
```jsx
const {
  // View
  activeView,  // 'shipping', 'products', 'archive', etc.

  // Alerts
  alertHubOpen,
  alerts,      // Array of alerts

  // Modals
  settingsOpen,
  helpOpen,
  notificationPrefsOpen,

  // UI
  showSupplierPortal,
  wsConnected,
  isLoading,
  isOnline,
  notification,
} = useUIStore();
```

#### Actions - View Management
```jsx
const { setActiveView } = useUIStore();
setActiveView('reports');
```

#### Actions - Alert Hub
```jsx
const {
  toggleAlertHub,
  openAlertHub,
  closeAlertHub,
  addAlert,
  removeAlert,
  clearAlerts,
} = useUIStore();

addAlert({
  type: 'warning',
  message: 'Shipment delayed',
  duration: 5000,
});
```

#### Actions - Modals
```jsx
const {
  toggleSettings,
  openSettings,
  closeSettings,
  toggleHelp,
  openHelp,
  closeHelp,
  // ... similar for notifications
} = useUIStore();

openSettings();
```

#### Actions - UI
```jsx
const {
  setShowSupplierPortal,
  setWSConnected,
  setLoading,
  setOnline,
  showNotification,
  clearNotification,
  reset,
} = useUIStore();

showNotification({
  type: 'success',
  message: 'Changes saved!',
});
```

---

### useAuthStore

#### State
```jsx
const {
  isAuthenticated,  // Boolean
  username,         // String
  userId,           // String
  userRole,         // 'user' | 'admin'
  error,            // String
  loading,          // Boolean
} = useAuthStore();
```

#### Actions - Authentication
```jsx
const {
  login,
  logout,
  register,
  initialize,
} = useAuthStore();

// Login
try {
  await login('username', 'password');
} catch (error) {
  console.error('Login failed:', error);
}

// Register
try {
  await register('newuser', 'email@example.com', 'password123', 'Full Name');
} catch (error) {
  console.error('Registration failed:', error);
}

// Logout
logout();

// Initialize on app load
useEffect(() => {
  useAuthStore.getState().initialize();
}, []);
```

#### Actions - Password Management
```jsx
const {
  changePassword,
  forgotPassword,
  resetPassword,
} = useAuthStore();

// Change password
await changePassword('oldPassword', 'newPassword');

// Forgot password
await forgotPassword('email@example.com');

// Reset password
await resetPassword('email@example.com', 'reset-token', 'newPassword');
```

#### Actions - Token Management
```jsx
const { refreshToken } = useAuthStore();

try {
  const newAccessToken = await refreshToken();
} catch (error) {
  // Automatically logs out on refresh failure
}
```

---

## Common Patterns

### Loading State
```jsx
function ShipmentList() {
  const { shipments, loading, fetchShipments } = useShipmentStore();

  useEffect(() => {
    fetchShipments();
  }, []);

  if (loading) return <Spinner />;
  return <div>{shipments.map(s => <ShipmentRow key={s.id} shipment={s} />)}</div>;
}
```

### Error Handling
```jsx
function ShipmentForm() {
  const { createShipment, error, clearError } = useShipmentStore();

  const handleSubmit = async (data) => {
    try {
      await createShipment(data);
      // Success!
    } catch (err) {
      // Error already in store
    }
  };

  return (
    <>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        {/* form fields */}
      </form>
    </>
  );
}
```

### Computed Values
```jsx
function Dashboard() {
  const { shipments } = useShipmentStore();

  // Compute derived data
  const statistics = useMemo(() => ({
    total: shipments.length,
    inTransit: shipments.filter(s => s.latestStatus.includes('in_transit')).length,
    arrived: shipments.filter(s => s.latestStatus.includes('arrived')).length,
  }), [shipments]);

  return <Stats stats={statistics} />;
}
```

### Conditional Rendering
```jsx
function ShipmentActions({ shipmentId }) {
  const { userRole } = useAuthStore();

  return (
    <div>
      {userRole === 'admin' && (
        <button onClick={() => deleteShipment(shipmentId)}>Delete</button>
      )}
    </div>
  );
}
```

### Multiple Stores
```jsx
function ComplexComponent() {
  const { shipments, updateShipment } = useShipmentStore();
  const { suppliers } = useSupplierStore();
  const { activeView } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <LoginPage />;

  return <div>{/* render based on multiple stores */}</div>;
}
```

---

## Performance Tips

### Subscribe to Specific Fields
Instead of:
```jsx
const store = useShipmentStore(); // Re-renders on any state change
```

Do:
```jsx
const shipments = useShipmentStore((state) => state.shipments);
const loading = useShipmentStore((state) => state.loading);
// Only re-renders when shipments or loading changes
```

### Using useMemo with Store Data
```jsx
const { shipments } = useShipmentStore();

const filteredShipments = useMemo(() => {
  return shipments.filter(/* condition */);
}, [shipments]);
```

### Batching Updates
```jsx
// Bad - 3 re-renders
useShipmentStore.setState({ shipments: newShipments });
useShipmentStore.setState({ loading: false });

// Good - 1 re-render
useShipmentStore.setState({
  shipments: newShipments,
  loading: false,
});
```

---

## Debugging

### Enable Redux DevTools
DevTools are automatically enabled in development. View them in Redux DevTools browser extension.

### Check Current State
```jsx
// In browser console
useShipmentStore.getState();
```

### Subscribe to Changes
```jsx
// Log all changes
const unsubscribe = useShipmentStore.subscribe(
  (state) => console.log('Store changed:', state)
);

// Unsubscribe later
unsubscribe();
```

---

## Migration from Props

### Before (with props)
```jsx
<ShipmentTable
  shipments={shipments}
  loading={loading}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
/>
```

### After (with stores)
```jsx
<ShipmentTable />

// Inside ShipmentTable:
function ShipmentTable() {
  const { shipments, loading, updateShipment, deleteShipment } = useShipmentStore();
  // No props needed!
}
```

---

## Testing with Stores

### Mock Store in Tests
```jsx
import { useShipmentStore } from '../stores';

describe('ShipmentTable', () => {
  it('renders shipments', () => {
    // Set mock data
    useShipmentStore.setState({
      shipments: [mockShipment],
      loading: false,
    });

    render(<ShipmentTable />);
    expect(screen.getByText(mockShipment.orderRef)).toBeInTheDocument();
  });

  it('handles error state', () => {
    useShipmentStore.setState({
      shipments: [],
      error: 'Failed to load',
    });

    render(<ShipmentTable />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});
```

---

## Questions?

Check the store files directly:
- `src/stores/shipmentStore.js`
- `src/stores/supplierStore.js`
- `src/stores/uiStore.js`
- `src/stores/authStore.js`

Or see COMPONENT_REFACTORING_GUIDE.md for architectural patterns.
