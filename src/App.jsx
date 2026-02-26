// src/App.jsx
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import SynercoreLogo from './components/SynercoreLogo';
import { useNotification } from './contexts/NotificationContext';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionOverlay from './components/ConnectionOverlay';
import { VIEW_ROUTES } from './routes';

// Lazy-loaded pages (code-split for faster initial load)
const ArchiveView = lazy(() => import('./components/ArchiveView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AdvancedReports = lazy(() => import('./components/AdvancedReports'));
const WarehouseCapacity = lazy(() => import('./components/WarehouseCapacity'));
const SupplierManagement = lazy(() => import('./components/SupplierManagement'));
const RatesQuotes = lazy(() => import('./components/RatesQuotes'));
const PostArrivalWorkflow = lazy(() => import('./components/PostArrivalWorkflow'));
const WarehouseStored = lazy(() => import('./components/WarehouseStored'));
const ShippingView = lazy(() => import('./components/ShippingView'));
const AlertHub = lazy(() => import('./components/AlertHub'));
const UserSettings = lazy(() => import('./components/UserSettings'));
const HelpGuide = lazy(() => import('./components/HelpGuide'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const NotificationPreferences = lazy(() => import('./components/NotificationPreferences'));
const ImportCosting = lazy(() => import('./components/ImportCosting'));
const CostingRequests = lazy(() => import('./components/CostingRequests'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const LiveBoard = lazy(() => import('./components/LiveBoard'));
import SupplierLogin from './pages/SupplierLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { ExcelProcessor } from './utils/excelProcessor';
import { Supplier } from './types/supplier';
import useWebSocket from './hooks/useWebSocket';
import { computeShipmentAlerts, createCustomAlert } from './utils/alerts';
import { getApiUrl } from './config/api';
import { authUtils } from './utils/auth';
import { initWebVitals, logWebVitalsToConsole } from './utils/webVitals';
import { initializeAnalytics, trackLogin, trackLogout } from './config/analytics';
import './theme.css';

// Initialize monitoring
initWebVitals();
logWebVitalsToConsole();
initializeAnalytics();

// ----- real timeout helper for fetch (since fetch doesn't honor a "timeout" option) -----
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      credentials: 'include' // Include credentials with all requests
    });
  } finally {
    clearTimeout(id);
  }
}

// ----- authenticated fetch helper -----
function authFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    ...authUtils.getAuthHeader()
  };
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include credentials (cookies) with cross-origin requests
  });
}

function App() {
  const [shipments, setShipments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingCountRef = useRef(0);
  const startLoading = () => { loadingCountRef.current += 1; setLoading(true); };
  const stopLoading = () => { loadingCountRef.current = Math.max(0, loadingCountRef.current - 1); if (loadingCountRef.current === 0) setLoading(false); };
  const { showSuccess, showError, showWarning, showInfo, confirm: confirmAction } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showSupplierPortal, setShowSupplierPortal] = useState(false); // New state for supplier portal

  // Alert Hub state
  const [alertHubOpen, setAlertHubOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  // User Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Help Guide state
  const [helpOpen, setHelpOpen] = useState(false);

  // Notification Preferences state
  const [notificationPrefsOpen, setNotificationPrefsOpen] = useState(false);

  // Costing Requests badge count (admin only)
  const [costingRequestCount, setCostingRequestCount] = useState(0);

  // Live Board mode
  const [liveBoardOpen, setLiveBoardOpen] = useState(false);

  // Sidebar nav search + collapse
  const [navSearch, setNavSearch] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sidebar collapsible sections
  const [sidebarSections, setSidebarSections] = useState({
    masterData: true,
    operations: true,
    finance: true,
    reports: true,
    resources: false,
  });
  const toggleSection = (key) => setSidebarSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Password recovery is now handled by routes

  // WebSocket integration
  const { isConnected: wsConnected, onShipmentUpdate, onDocumentUpload, joinShipment, leaveShipment } = useWebSocket();

  // prevent hammering the API during background polling
  const lastFetchRef = useRef({ shipments: 0, suppliers: 0 });
  const FETCH_COOLDOWN = 5000; // 5s
  const initializedRef = useRef(false); // Track if we've done initial fetch

  // ---------- WebSocket real-time updates ----------
  // Listen for shipment updates and refresh affected shipments
  useEffect(() => {
    const unsubscribe = onShipmentUpdate((data) => {
      setShipments(prev => prev.map(s => {
        if (s.id === data.shipmentId) {
          return {
            ...s,
            latestStatus: data.status || s.latestStatus,
            inspectionStatus: data.inspectionStatus || s.inspectionStatus,
            actualArrivalDate: data.actualArrivalDate || s.actualArrivalDate,
            ...data.shipment
          };
        }
        return s;
      }));
      setLastSyncTime(new Date());
    });

    return unsubscribe;
  }, [onShipmentUpdate]);

  // Listen for document uploads
  useEffect(() => {
    const unsubscribe = onDocumentUpload((data) => {
      // Trigger notification about document upload
      showInfo(`📄 Document uploaded: ${data.document.fileName} for shipment ${data.shipmentId}`);
    });

    return unsubscribe;
  }, [onDocumentUpload]);

  // ---------- boot ----------
  useEffect(() => {
    // Check for new JWT-based auth first (only run once)
    if (initializedRef.current) return;

    const user = authUtils.getUser();
    const isAuth = user && authUtils.isAuthenticated() && !authUtils.isTokenExpired();

    if (isAuth) {
      initializedRef.current = true;
      setIsAuthenticated(true);
      setUsername(user.username);
      fetchShipments();
      fetchSuppliers();
    } else {
      // Clear any stale auth data
      if (authUtils.isAuthenticated() || authUtils.getUser()) {
        authUtils.clearAuth();
      }
    }
  }, []); // Empty dependency array - run once on mount

  // ---------- polling fallback ----------
  useEffect(() => {
    // Only poll if WebSocket is not connected (fallback to polling)
    const poll = setInterval(() => {
      // Only poll if authenticated and WebSocket not connected
      if (authUtils.isAuthenticated() && !wsConnected) {
        fetchShipments(true); // background sync
        fetchSuppliers(true);
      }
    }, 30000);

    return () => clearInterval(poll);
  }, [wsConnected]);

  // ---------- alerts ----------
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissedAlerts') || '[]')); }
    catch { return new Set(); }
  });

  // Whenever shipments change, recompute alerts
  useEffect(() => {
    setAlerts(prev => {
      const computed = computeShipmentAlerts(shipments);
      // preserve "read" state across recomputes, filter out dismissed
      const readSet = new Set(prev.filter(a => a.read).map(a => a.id));
      return computed
        .filter(a => !dismissedAlertIds.has(a.id))
        .map(a => ({ ...a, read: readSet.has(a.id) ? true : a.read || false }));
    });
  }, [shipments, dismissedAlertIds]);

  // Alert handlers
  const handleAlertDismiss = (id) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('dismissedAlerts', JSON.stringify([...next]));
      return next;
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };
  const handleAlertMarkRead = (id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));

  // Helper function to push custom alerts
  const pushAlert = (alert) => setAlerts(prev => [
    createCustomAlert(alert.severity || 'info', alert.title, alert.description, alert.meta),
    ...prev
  ]);

  // Poll for costing request count (admin only)
  useEffect(() => {
    if (!isAuthenticated) return;
    const currentUser = authUtils.getUser();
    if (currentUser?.role !== 'admin') return;

    const fetchRequestCount = async () => {
      try {
        const res = await authFetch(getApiUrl('/api/costing-requests/count'));
        if (res.ok) {
          const data = await res.json();
          setCostingRequestCount(data.count || 0);
        }
      } catch (err) {
        // Silently fail - not critical
      }
    };

    fetchRequestCount();
    const interval = setInterval(fetchRequestCount, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ---------- data: shipments ----------
  const fetchShipments = async (isBackgroundSync = false) => {
    try {
      const now = Date.now();
      if (isBackgroundSync && (now - lastFetchRef.current.shipments) < FETCH_COOLDOWN) {
        return;
      }
      lastFetchRef.current.shipments = now;

      if (!isBackgroundSync) {
        startLoading();
      }

      let response;
      let lastError;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetchWithTimeout(getApiUrl('/api/shipments?limit=1000'), {
            headers: {
              ...(isBackgroundSync ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {}),
              ...authUtils.getAuthHeader()
            }
          }, 10000);

          if (response.ok) break;

          if (response.status === 503 || response.status >= 500) {
            const body = await response.text().catch(() => '');
            throw new Error(`Server error ${response.status}: ${body}`);
          } else {
            const body = await response.text().catch(() => '');
            throw new Error(`Failed to fetch shipments: ${response.status} ${body}`);
          }
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }

      if (!response || !response.ok) throw lastError || new Error('Failed to fetch shipments after retries');

      const data = await response.json();

      // Convert snake_case API response to camelCase for frontend
      const normalized = (data.data || []).map(s => ({
        id: s.id,
        orderRef: s.order_ref || s.orderRef,
        supplier: s.supplier,
        productName: s.product_name || s.productName,
        quantity: Number(s.quantity) || 0,
        palletQty: Number(s.pallet_qty || s.palletQty) || 0,
        cbm: Number(s.cbm) || 0,
        latestStatus: s.latest_status || s.latestStatus,
        weekNumber: Number(s.week_number || s.weekNumber) || 0,
        weekDate: s.week_date || s.weekDate,
        selectedWeekDate: s.selected_week_date || s.selectedWeekDate,
        finalPod: s.final_pod || s.finalPod,
        receivingWarehouse: s.receiving_warehouse || s.receivingWarehouse,
        forwardingAgent: s.forwarding_agent || s.forwardingAgent,
        vesselName: s.vessel_name || s.vesselName,
        incoterm: s.incoterm,
        notes: s.notes,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt,
        receivedQuantity: s.received_quantity || s.receivedQuantity ? Number(s.received_quantity || s.receivedQuantity) : null,
        // Post-arrival workflow fields
        unloadingStartDate: s.unloading_start_date || s.unloadingStartDate,
        unloadingCompletedDate: s.unloading_completed_date || s.unloadingCompletedDate,
        inspectionDate: s.inspection_date || s.inspectionDate,
        inspectionStatus: s.inspection_status || s.inspectionStatus,
        inspectionNotes: s.inspection_notes || s.inspectionNotes,
        inspectedBy: s.inspected_by || s.inspectedBy,
        receivingDate: s.receiving_date || s.receivingDate,
        receivingStatus: s.receiving_status || s.receivingStatus,
        receivingNotes: s.receiving_notes || s.receivingNotes,
        receivedBy: s.received_by || s.receivedBy,
        discrepancies: s.discrepancies,
        rejectionDate: s.rejection_date || s.rejectionDate,
        rejectionReason: s.rejection_reason || s.rejectionReason,
        rejectedBy: s.rejected_by || s.rejectedBy
      }));

      // Always replace array to force downstream children (WeekCalendar) to re-render with fresh values
      setShipments(normalized);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('App: Error fetching shipments:', err);
      if (!isBackgroundSync) showError(`Failed to load shipments: ${err.message}`);
    } finally {
      if (!isBackgroundSync) stopLoading();
    }
  };

  // ---------- data: suppliers ----------
  const fetchSuppliers = async (isBackgroundSync = false) => {
    try {
      const now = Date.now();
      if (isBackgroundSync && (now - lastFetchRef.current.suppliers) < FETCH_COOLDOWN) {
        return;
      }
      lastFetchRef.current.suppliers = now;

      if (!isBackgroundSync) startLoading();

      const res = await fetchWithTimeout(getApiUrl('/api/suppliers'), {
        headers: authUtils.getAuthHeader()
      }, 10000);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();

      const normalized = (data.data || data || []).map(s => Object.assign(new Supplier({}), s));
      setSuppliers(prev => {
        if (prev.length === normalized.length && prev.length > 0) {
          if (prev[0]?.id === normalized[0]?.id) return prev;
        }
        return normalized;
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      if (!isBackgroundSync) showError(err.message);
    } finally {
      if (!isBackgroundSync) stopLoading();
    }
  };

  // ---------- CRUD: suppliers ----------
  const handleAddSupplier = async (supplier) => {
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
      });
      if (!response.ok) throw new Error('Failed to add supplier');
      await fetchSuppliers();
      showSuccess('Supplier added successfully');
    } catch (err) { showError(err.message); }
  };

  const handleUpdateSupplier = async (id, updates) => {
    try {
      const response = await authFetch(getApiUrl(`/api/suppliers/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update supplier');
      await fetchSuppliers();
      showSuccess('Supplier updated successfully');
    } catch (err) { showError(err.message); }
  };

  const handleDeleteSupplier = async (id) => {
    if (!(await confirmAction({ title: 'Delete Supplier', message: 'Are you sure you want to delete this supplier?', type: 'danger', confirmText: 'Delete' }))) return;
    try {
      const response = await authFetch(getApiUrl(`/api/suppliers/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete supplier');
      await fetchSuppliers();
      showSuccess('Supplier deleted successfully');
    } catch (err) { showError(err.message); }
  };

  // ---------- import schedule / file upload ----------
  const handleImportSchedule = async (supplierId, scheduleData, documents = []) => {
    try {
      setLoading(true);

      const response = await authFetch(getApiUrl(`/api/suppliers/${supplierId}/import`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData, documents })
      });
      if (!response.ok) throw new Error('Failed to import schedule');

      const result = await response.json();
      if (result.scheduleData && result.scheduleData.length > 0) {
        const shipmentsResponse = await authFetch(getApiUrl('/api/shipments/bulk-import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.scheduleData)
        });
        if (!shipmentsResponse.ok) throw new Error('Failed to save imported schedule');

        await fetchShipments();
        showSuccess(`Successfully imported ${result.scheduleData.length} items from ${result.supplier.name}`);
      }
    } catch (err) {
      console.error('Error importing schedule:', err);
      showError(err.message);
    } finally { setLoading(false); }
  };

  const handleFileUpload = async (file) => {
    try {
      setLoading(true);

      const processedShipments = await ExcelProcessor.parseExcelFile(file);
      if (processedShipments.length === 0) throw new Error('No data found in Excel file');

      const toPlain = (s) => ({
        id: s.id,
        supplier: s.supplier,
        orderRef: s.orderRef,
        finalPod: s.finalPod,
        latestStatus: s.latestStatus,
        weekNumber: Number(s.weekNumber) || 0,
        productName: s.productName,
        quantity: Number(s.quantity) || 0,
        palletQty: Number(s.palletQty) || 0,
        receivingWarehouse: s.receivingWarehouse,
        forwardingAgent: s.forwardingAgent ?? '',
        vesselName: s.vesselName ?? '',
        incoterm: s.incoterm ?? '',
        notes: s.notes ?? '',
      });

      const payload = processedShipments.map(toPlain);

      const response = await authFetch(getApiUrl('/api/shipments/bulk-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('App: Failed bulk import:', response.status, errorText);
        throw new Error(`Failed bulk import: ${response.status}`);
      }

      await response.json();

      // Auto-create suppliers from imported shipments
      const uniqueSuppliers = [...new Set(processedShipments.map(s => s.supplier).filter(Boolean))];
      for (const supplierName of uniqueSuppliers) {
        try {
          await handleAddSupplier({ name: supplierName });
        } catch (err) {
          // Supplier already exists or failed to create - suppress error
        }
      }

      showSuccess(`Successfully imported ${payload.length} shipments and ${uniqueSuppliers.length} suppliers`);
      await fetchShipments();
      await fetchSuppliers();

      // Ensure palletQty is preserved in UI after import (match by orderRef)
      const palletQtyByOrderRef = new Map(payload.map(s => [s.orderRef, s.palletQty]));
      setShipments(prev => prev.map(s => ({ ...s, palletQty: palletQtyByOrderRef.get(s.orderRef) ?? s.palletQty })));
    } catch (err) {
      console.error('App: File upload error:', err);
      showError(`Failed to process file: ${err.message}`);
    } finally { setLoading(false); }
  };

  // ---------- CRUD: shipments ----------
  const handleUpdateShipment = async (id, updates) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update shipment');

      // Pull fresh data so WeekCalendar & selectedWeekDate reflect the change
      await fetchShipments();
      showSuccess('Shipment updated successfully');
    } catch (err) { showError(err.message); }
  };

  const handleDeleteShipment = async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete shipment');
      await fetchShipments();
      showSuccess('Shipment deleted successfully');
    } catch (err) { showError(err.message); }
  };

  const handleArchiveShipment = async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}/archive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to archive shipment');
      await fetchShipments();
      showSuccess('Shipment archived successfully');
    } catch (err) { showError(err.message); }
  };

  const handleCreateShipment = async (shipmentData) => {
    try {
      const response = await authFetch(getApiUrl('/api/shipments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (Array.isArray(errorData?.details) ? errorData.details.map((d) => d.msg).join(', ') : null) ||
                            errorData?.error ||
                            'Failed to create shipment';
        throw new Error(errorMessage);
      }
      await fetchShipments();
      showSuccess('Shipment added successfully');
    } catch (err) {
      console.error('Shipment creation error:', err);
      showError(err.message);
      throw err;
    }
  };

  // ---------- auth ----------
  const handleLogin = (loginUsername) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', loginUsername);
    setIsAuthenticated(true);
    setUsername(loginUsername);
    // Immediately fetch data after login instead of waiting for 30s poll
    initializedRef.current = true;
    fetchShipments();
    fetchSuppliers();
  };

  const handleLogout = () => {
    authUtils.clearAuth();
    setIsAuthenticated(false);
    setUsername('');
    navigate('/login');
  };

  // ---------- helper: derive active view from URL ----------
  const activeView = (() => {
    const path = location.pathname;
    if (path === '/shipping' || path === '/') return 'shipping';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/suppliers') return 'suppliers';
    if (path === '/workflow') return 'workflow';
    if (path === '/capacity') return 'capacity';
    if (path === '/stored') return 'stored';
    if (path === '/archives') return 'archives';
    if (path === '/rates') return 'rates';
    if (path === '/costing') return 'costing';
    if (path === '/costing-requests') return 'costing-requests';
    if (path === '/reports') return 'reports';
    if (path === '/advanced-reports') return 'advanced-reports';
    if (path === '/users') return 'users';
    return 'shipping';
  })();

  const StoredWrapper = () => {
    const storedShipments = shipments.filter(s => s.latestStatus === 'stored' || s.latestStatus === 'archived');
    return (
      <WarehouseStored
        shipments={storedShipments}
        onUpdateShipment={handleUpdateShipment}
        onDeleteShipment={handleDeleteShipment}
        onArchiveShipment={handleArchiveShipment}
        loading={loading}
      />
    );
  };

  const AccessDenied = () => (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Access Denied</h2>
      <p>You need administrator privileges to access this page.</p>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword onBack={() => navigate('/login')} />} />
        <Route path="/reset-password" element={<ResetPassword onBack={() => navigate('/login')} />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} onForgotPassword={() => navigate('/forgot-password')} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Show Supplier Portal if requested
  if (showSupplierPortal) {
    return <SupplierLogin onClose={() => setShowSupplierPortal(false)} />;
  }

  const currentUser = authUtils.getUser();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className={`container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <OfflineIndicator />
      <ConnectionOverlay />
      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-title">
            <h1>Import SCM</h1>
            <p className="sidebar-subtitle">Supply Chain Management</p>
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search menu..."
            value={navSearch}
            onChange={e => setNavSearch(e.target.value)}
          />
        </div>

        {/* Navigation */}
        {(() => {
          const q = navSearch.toLowerCase();

          const navItems = {
            dashboard: { label: 'Dashboard', icon: '📊', view: 'dashboard' },
            // Master Data
            suppliers: { label: 'Suppliers', icon: '🏢', view: 'suppliers' },
            // Operations
            shipping: { label: 'Shipping Schedule', icon: '📦', view: 'shipping' },
            workflow: { label: 'Post-Arrival Workflow', icon: '📋', view: 'workflow' },
            capacity: { label: 'Warehouse Capacity', icon: '🏭', view: 'capacity' },
            stored: { label: 'Stored Stock', icon: '🏪', view: 'stored' },
            archives: { label: 'Shipment Archives', icon: '📦', view: 'archives' },
            // Finance
            rates: { label: 'Rates & Quotes', icon: '💰', view: 'rates' },
            costing: { label: 'Import Costing', icon: '📊', view: 'costing' },
            costingRequests: { label: 'Cost Requests', icon: '📋', view: 'costing-requests', adminOnly: true, badge: costingRequestCount },
            // Reports
            reports: { label: 'Reports', icon: '📊', view: 'reports' },
            advancedReports: { label: 'Advanced Reports', icon: '📈', view: 'advanced-reports' },
          };

          const match = (label) => !q || label.toLowerCase().includes(q);

          const renderItem = (key) => {
            const item = navItems[key];
            if (!item) return null;
            if (item.adminOnly && !isAdmin) return null;
            if (!match(item.label)) return null;
            return (
              <button
                key={key}
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                onClick={() => navigate(VIEW_ROUTES[item.view] || '/shipping')}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          };

          const renderSection = (title, sectionKey, itemKeys) => {
            const visibleItems = itemKeys.filter(k => {
              const item = navItems[k];
              if (!item) return false;
              if (item.adminOnly && !isAdmin) return false;
              return match(item.label);
            });
            // If search is active and no items match, hide section
            if (q && visibleItems.length === 0) return null;
            // If search is active, force sections open
            const isOpen = q ? true : sidebarSections[sectionKey];

            return (
              <div className="nav-section" key={sectionKey}>
                <div className="nav-section-header" onClick={() => !q && toggleSection(sectionKey)}>
                  {title}
                  <span className={`chevron ${isOpen ? 'open' : ''}`}>▸</span>
                </div>
                <div className={`nav-section-items ${isOpen ? 'expanded' : 'collapsed'}`}>
                  {visibleItems.map(k => renderItem(k))}
                </div>
              </div>
            );
          };

          const externalLinks = [
            { label: 'Transnet Portal', url: 'https://www.transnet.net/SubsiteRender.aspx?id=8137383', icon: '🚢' },
            { label: 'Marine Traffic', url: 'https://www.marinetraffic.com/en/ais/home/shipid:157944/zoom:10', icon: '🌊' },
            { label: 'FreightNews', url: 'https://www.freightnews.co.za/customs/3610/3823-19', icon: '📰' },
            { label: 'Track-Trace', url: 'https://www.track-trace.com/', icon: '📍' },
            { label: 'MyDHLi Portal', url: 'https://keycloak.mydhli.com/auth/realms/DCI/protocol/openid-connect/auth?redirect_uri=https%3A%2F%2Fapp.mydhli.com%2Flogin&scope=openid+web-origins&response_type=code&client_id=myDHLi&ui_locales=en', icon: '📦' },
            { label: 'DSV Solutions', url: 'https://mydsv.com/new/frontpage/', icon: '🚛' },
            { label: 'Afrigistics', url: 'https://www.afrigistics.com/contact/', icon: '🌍' },
          ];
          const resourcesVisible = !q ? externalLinks : externalLinks.filter(l => l.label.toLowerCase().includes(q));
          const resourcesOpen = q ? resourcesVisible.length > 0 : sidebarSections.resources;

          return (
            <nav className="sidebar-nav">
              {/* Dashboard - standalone */}
              {match('Dashboard') && renderItem('dashboard')}

              {/* Grouped sections */}
              {renderSection('Master Data', 'masterData', ['suppliers'])}
              {renderSection('Operations', 'operations', ['shipping', 'workflow', 'capacity', 'stored', 'archives'])}
              {renderSection('Finance', 'finance', ['rates', 'costing', 'costingRequests'])}
              {renderSection('Reports', 'reports', ['reports', 'advancedReports'])}

              {/* External Resources — card at bottom */}
              {!sidebarCollapsed && (!q || resourcesVisible.length > 0) && (
                <div className="sidebar-resources">
                  <div className="nav-section-header" onClick={() => !q && toggleSection('resources')}>
                    Resources
                    <span className={`chevron ${resourcesOpen ? 'open' : ''}`}>▸</span>
                  </div>
                  <div className={`nav-section-items ${resourcesOpen ? 'expanded' : 'collapsed'}`}>
                    {resourcesVisible.map(link => (
                      <button
                        key={link.label}
                        className="nav-item"
                        onClick={() => window.open(link.url, '_blank')}
                      >
                        <span className="nav-icon">{link.icon}</span>
                        <span className="nav-label">{link.label}</span>
                        <span className="nav-external">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          );
        })()}

        {/* Quick Stats */}
        <div className="sidebar-quick-stats" style={{
          margin: '0 12px 8px', padding: '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '12px', color: '#94a3b8'
        }}>
          <div style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>Quick Stats</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>Total Items</span><strong>{shipments.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>In Transit</span><strong>{shipments.filter(s => s.latestStatus === 'in_transit_roadway' || s.latestStatus === 'in_transit_seaway').length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Delayed</span><strong style={{ color: '#fbbf24' }}>{shipments.filter(s => s.latestStatus === 'delayed').length}</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setHelpOpen(true)} title={sidebarCollapsed ? 'Help & Guide' : undefined}>
            <span className="nav-icon">📚</span> <span className="nav-label">Help & Guide</span>
          </button>
          <button className="nav-item" onClick={() => setSettingsOpen(true)} title={sidebarCollapsed ? 'Settings' : undefined}>
            <span className="nav-icon">⚙️</span> <span className="nav-label">Settings</span>
          </button>
          <button className="nav-item" onClick={() => setNotificationPrefsOpen(true)} title={sidebarCollapsed ? 'Notifications' : undefined}>
            <span className="nav-icon">🔔</span> <span className="nav-label">Notifications</span>
          </button>
          <button className="nav-item" onClick={() => setShowSupplierPortal(true)} title={sidebarCollapsed ? 'Supplier Portal' : undefined}>
            <span className="nav-icon">🏢</span> <span className="nav-label">Supplier Portal</span>
          </button>
          {isAdmin && (
            <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => navigate('/users')} title={sidebarCollapsed ? 'User Management' : undefined}>
              <span className="nav-icon">👥</span> <span className="nav-label">User Management</span>
            </button>
          )}
          <button className="nav-item logout" onClick={handleLogout} title={sidebarCollapsed ? 'Logout' : undefined}>
            <span className="nav-icon">🚪</span> <span className="nav-label">Logout</span>
          </button>
        </div>
      </div>

      {/* main panel */}
      <div className="main-content">
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem',
          borderBottom: '1px solid var(--border)', marginBottom: '1rem',
          background: 'var(--surface)', width: '100%'
        }}>
          <SynercoreLogo size="medium" />
          <GlobalSearch shipments={shipments} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-500)' }}>
              Logged in as: <strong style={{ color: 'var(--text-900)' }}>{username}</strong>
            </div>
            <button
              onClick={() => setAlertHubOpen(true)}
              className="btn btn-info"
              style={{
                position: 'relative',
                fontSize: '0.9rem'
              }}
              title="Open Alert Hub"
            >
              ⚠️ Alerts
              {alerts.filter(a => !a.read).length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '20px',
                  height: '20px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {alerts.filter(a => !a.read).length}
                </span>
              )}
            </button>
            {isAdmin && costingRequestCount > 0 && (
              <button
                onClick={() => navigate('/costing-requests')}
                className="btn"
                style={{
                  position: 'relative',
                  fontSize: '0.9rem',
                  backgroundColor: 'var(--warning)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
                title="View costing requests"
              >
                Costing Requests
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: '20px',
                  height: '20px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {costingRequestCount}
                </span>
              </button>
            )}
          </div>
        </div>

        <ErrorBoundary>
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>Loading...</div>}>
            <Routes>
              <Route path="/shipping" element={
                <ShippingView
                  shipments={shipments}
                  onFileUpload={handleFileUpload}
                  onUpdateShipment={handleUpdateShipment}
                  onDeleteShipment={handleDeleteShipment}
                  onCreateShipment={handleCreateShipment}
                  loading={loading}
                />
              } />
              <Route path="/dashboard" element={
                <Dashboard shipments={shipments} onOpenLiveBoard={() => setLiveBoardOpen(true)} />
              } />
              <Route path="/suppliers" element={
                <SupplierManagement
                  suppliers={suppliers}
                  shipments={shipments}
                  onAddSupplier={handleAddSupplier}
                  onUpdateSupplier={handleUpdateSupplier}
                  onDeleteSupplier={handleDeleteSupplier}
                  onImportSchedule={handleImportSchedule}
                  loading={loading}
                />
              } />
              <Route path="/workflow" element={<PostArrivalWorkflow />} />
              <Route path="/capacity" element={<WarehouseCapacity shipments={shipments} />} />
              <Route path="/stored" element={<StoredWrapper />} />
              <Route path="/archives" element={<ArchiveView />} />
              <Route path="/rates" element={<RatesQuotes loading={loading} />} />
              <Route path="/costing" element={<ImportCosting />} />
              <Route path="/costing-requests" element={isAdmin ? <CostingRequests /> : <AccessDenied />} />
              <Route path="/reports" element={<ReportsView shipments={shipments} />} />
              <Route path="/advanced-reports" element={<AdvancedReports />} />
              <Route path="/users" element={isAdmin ? <UserManagement /> : <AccessDenied />} />
              <Route path="/" element={<Navigate to="/shipping" replace />} />
              <Route path="*" element={<Navigate to="/shipping" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {liveBoardOpen && (
        <LiveBoard
          shipments={shipments}
          onClose={() => setLiveBoardOpen(false)}
          onRefresh={() => fetchShipments(true)}
        />
      )}
      <AlertHub
        open={alertHubOpen}
        onClose={() => setAlertHubOpen(false)}
        alerts={alerts}
        onDismiss={handleAlertDismiss}
        onMarkRead={handleAlertMarkRead}
      />
      {settingsOpen && (
        <UserSettings
          username={username}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {notificationPrefsOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '8px'
          }}>
            <NotificationPreferences
              onClose={() => setNotificationPrefsOpen(false)}
            />
          </div>
        </div>
      )}
      {helpOpen && (
        <HelpGuide
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
