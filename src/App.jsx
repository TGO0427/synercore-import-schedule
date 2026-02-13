// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import ShipmentTable from './components/ShipmentTable';
import ProductView from './components/ProductView';
import ArchiveView from './components/ArchiveView';
import ReportsView from './components/ReportsView';
import AdvancedReports from './components/AdvancedReports';
import WarehouseCapacity from './components/WarehouseCapacity';
import SupplierManagement from './components/SupplierManagement';
import RatesQuotes from './components/RatesQuotes';
import PostArrivalWorkflow from './components/PostArrivalWorkflow';
import WarehouseStored from './components/WarehouseStored';
import Dashboard from './components/Dashboard';
import FileUpload from './components/FileUpload';
import LoginPage from './components/LoginPage';
import NotificationContainer from './components/NotificationContainer';
import SynercoreLogo from './components/SynercoreLogo';
import AlertHub from './components/AlertHub';
import UserSettings from './components/UserSettings';
import HelpGuide from './components/HelpGuide';
import UserManagement from './components/UserManagement';
import NotificationPreferences from './components/NotificationPreferences';
import OfflineIndicator from './components/OfflineIndicator';
import ImportCosting from './components/ImportCosting';
import CostingRequests from './components/CostingRequests';
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
  const [notifications, setNotifications] = useState([]);
  const [activeView, setActiveView] = useState('shipping');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null); // null = no filter
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

  // Sidebar nav search
  const [navSearch, setNavSearch] = useState('');

  // Sidebar collapsible sections
  const [sidebarSections, setSidebarSections] = useState({
    masterData: true,
    operations: true,
    finance: true,
    reports: true,
  });
  const toggleSection = (key) => setSidebarSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Password Recovery state
  const [currentView, setCurrentView] = useState('login'); // 'login', 'forgotPassword', 'resetPassword'

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
      // Set loading before fetching
      setLoading(true);
      // Only fetch if authenticated
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

  // ---------- notifications ----------
  const addNotification = (type, message, options = {}) =>
    setNotifications(prev => [...prev, { id: Date.now() + Math.random(), type, message, ...options }]);

  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  const showSuccess = (m, o = {}) => { addNotification('success', m, o); };
  const showError   = (m, o = {}) => { addNotification('error', m, o); };
  const showWarning = (m, o = {}) => { addNotification('warning', m, o); };
  const showInfo    = (m, o = {}) => { addNotification('info', m, o); };
  const showDark    = (m, o = {}) => { addNotification('dark', m, o); };
  const showLight   = (m, o = {}) => { addNotification('light', m, o); };

  // ---------- alerts ----------
  // Whenever shipments change, recompute alerts
  useEffect(() => {
    setAlerts(prev => {
      const computed = computeShipmentAlerts(shipments);
      // preserve "read" state across recomputes
      const readSet = new Set(prev.filter(a => a.read).map(a => a.id));
      return computed.map(a => ({ ...a, read: readSet.has(a.id) ? true : a.read || false }));
    });
  }, [shipments]);

  // Alert handlers
  const handleAlertDismiss = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
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
        setLoading(true);
      }

      let response;
      let lastError;
      const maxRetries = 3;
      const retryDelay = 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetchWithTimeout(getApiUrl('/api/shipments?limit=1000'), {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
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
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
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
      console.log('[App] Shipments loaded:', {
        count: normalized.length,
        suppliers: [...new Set(normalized.map(s => s.supplier))].sort()
      });
    } catch (err) {
      console.error('App: Error fetching shipments:', err);
      if (!isBackgroundSync) showError(`Failed to load shipments: ${err.message}`);
    } finally {
      if (!isBackgroundSync) setLoading(false);
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

      if (!isBackgroundSync) setLoading(true);

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
        console.log('[App] Suppliers loaded:', {
          count: normalized.length,
          names: normalized.map(s => s.name).sort()
        });
        return normalized;
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      if (!isBackgroundSync) showError(err.message);
    } finally {
      if (!isBackgroundSync) setLoading(false);
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
    if (!confirm('Are you sure you want to delete this supplier?')) return;
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
  };

  const handleLogout = () => {
    authUtils.clearAuth();
    setIsAuthenticated(false);
    setUsername('');
    setActiveView('shipping');
  };

  // ---------- UI helpers ----------
  const handleStatusCardClick = (status) => {
    setStatusFilter(prev => (prev === status ? null : status));
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'shipping': {
        // Hide items that are fully arrived/received/stored or in PAW
        // Post-arrival workflow statuses and archived to exclude from shipping schedule
        const postArrivalStatuses = [
          'arrived_pta', 'arrived_klm', 'arrived_offsite',
          'unloading', 'inspection_pending', 'inspecting',
          'inspection_failed', 'inspection_passed',
          'receiving', 'received', 'stored', 'archived'
        ];

        let shippingShipments = shipments.filter(s =>
          !postArrivalStatuses.includes(s.latestStatus)
        );

        if (statusFilter) {
          shippingShipments = shippingShipments.filter(s => s.latestStatus === statusFilter);
        }

        // Count unique ORDER/REF - duplicates count as 1 shipment
        const uniqueOrderRefs = new Set(shippingShipments.map(s => s.orderRef).filter(Boolean));

        // Group shipments by status with unique orderRef counting
        const statusOrderRefs = {};
        shippingShipments.forEach(s => {
          if (s.latestStatus && s.orderRef) {
            if (!statusOrderRefs[s.latestStatus]) {
              statusOrderRefs[s.latestStatus] = new Set();
            }
            statusOrderRefs[s.latestStatus].add(s.orderRef);
          }
        });

        const stats = {
          total: uniqueOrderRefs.size,
          planned_airfreight: 0, planned_seafreight: 0,
          in_transit_airfreight: 0, in_transit_roadway: 0, in_transit_seaway: 0,
          moored: 0, berth_working: 0, berth_complete: 0,
          arrived_pta: 0, arrived_klm: 0, arrived_offsite: 0,
          unloading: 0, inspection_pending: 0, inspecting: 0,
          inspection_failed: 0, inspection_passed: 0,
          receiving: 0, received: 0, stored: 0,
          delayed: 0, cancelled: 0
        };

        // Set counts from unique orderRef sets
        Object.keys(statusOrderRefs).forEach(status => {
          if (stats.hasOwnProperty(status)) {
            stats[status] = statusOrderRefs[status].size;
          }
        });

        return (
          <div className="window-content">
            {/* stat cards */}
            <div className="stats-grid">
              <div className={`stat-card total ${statusFilter === null ? 'active' : ''}`}
                   onClick={() => setStatusFilter(null)}
                   style={{ cursor: 'pointer' }}>
                <h3>{stats.total}</h3><p>Total Shipments</p>
              </div>

              {/* planning */}
              {stats.planned_airfreight > 0 && (
                <div className={`stat-card ${statusFilter === 'planned_airfreight' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('planned_airfreight')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.planned_airfreight}</h3><p>Planned Airfreight</p>
                </div>
              )}
              {stats.planned_seafreight > 0 && (
                <div className={`stat-card ${statusFilter === 'planned_seafreight' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('planned_seafreight')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.planned_seafreight}</h3><p>Planned Seafreight</p>
                </div>
              )}

              {/* transit */}
              {stats.in_transit_airfreight > 0 && (
                <div className={`stat-card ${statusFilter === 'in_transit_airfreight' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('in_transit_airfreight')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.in_transit_airfreight}</h3><p>In Transit Air</p>
                </div>
              )}
              {stats.in_transit_roadway > 0 && (
                <div className={`stat-card ${statusFilter === 'in_transit_roadway' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('in_transit_roadway')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.in_transit_roadway}</h3><p>In Transit Road</p>
                </div>
              )}
              {stats.in_transit_seaway > 0 && (
                <div className={`stat-card ${statusFilter === 'in_transit_seaway' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('in_transit_seaway')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.in_transit_seaway}</h3><p>In Transit Sea</p>
                </div>
              )}
              {stats.moored > 0 && (
                <div className={`stat-card ${statusFilter === 'moored' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('moored')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.moored}</h3><p>Moored</p>
                </div>
              )}
              {stats.berth_working > 0 && (
                <div className={`stat-card ${statusFilter === 'berth_working' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('berth_working')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.berth_working}</h3><p>Berth Working</p>
                </div>
              )}
              {stats.berth_complete > 0 && (
                <div className={`stat-card ${statusFilter === 'berth_complete' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('berth_complete')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.berth_complete}</h3><p>Berth Complete</p>
                </div>
              )}

              {/* arrival */}
              {stats.arrived_pta > 0 && (
                <div className={`stat-card ${statusFilter === 'arrived_pta' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('arrived_pta')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.arrived_pta}</h3><p>Arrived PTA</p>
                </div>
              )}
              {stats.arrived_klm > 0 && (
                <div className={`stat-card ${statusFilter === 'arrived_klm' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('arrived_klm')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.arrived_klm}</h3><p>Arrived KLM</p>
                </div>
              )}

              {/* processing */}
              {stats.unloading > 0 && (
                <div className={`stat-card ${statusFilter === 'unloading' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('unloading')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.unloading}</h3><p>Unloading</p>
                </div>
              )}
              {stats.inspection_pending > 0 && (
                <div className={`stat-card ${statusFilter === 'inspection_pending' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('inspection_pending')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.inspection_pending}</h3><p>Inspection Pending</p>
                </div>
              )}
              {stats.inspecting > 0 && (
                <div className={`stat-card ${statusFilter === 'inspecting' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('inspecting')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.inspecting}</h3><p>Inspecting</p>
                </div>
              )}
              {stats.inspection_failed > 0 && (
                <div className={`stat-card alert ${statusFilter === 'inspection_failed' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('inspection_failed')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.inspection_failed}</h3><p>Inspection Failed</p>
                </div>
              )}
              {stats.inspection_passed > 0 && (
                <div className={`stat-card success ${statusFilter === 'inspection_passed' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('inspection_passed')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.inspection_passed}</h3><p>Inspection Passed</p>
                </div>
              )}
              {stats.receiving > 0 && (
                <div className={`stat-card ${statusFilter === 'receiving' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('receiving')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.receiving}</h3><p>Receiving</p>
                </div>
              )}

              {/* completion */}
              {stats.received > 0 && (
                <div className={`stat-card success ${statusFilter === 'received' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('received')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.received}</h3><p>Received</p>
                </div>
              )}
              {stats.stored > 0 && (
                <div className={`stat-card success ${statusFilter === 'stored' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('stored')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.stored}</h3><p>Stored</p>
                </div>
              )}

              {/* issues */}
              {stats.delayed > 0 && (
                <div className={`stat-card alert ${statusFilter === 'delayed' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('delayed')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.delayed}</h3><p>Delayed</p>
                </div>
              )}
              {stats.cancelled > 0 && (
                <div className={`stat-card cancelled ${statusFilter === 'cancelled' ? 'active' : ''}`}
                     onClick={() => handleStatusCardClick('cancelled')}
                     style={{ cursor: 'pointer' }}>
                  <h3>{stats.cancelled}</h3><p>Cancelled</p>
                </div>
              )}
            </div>

            {/* current filter chip */}
            {statusFilter && (
              <div style={{
                margin: '1rem 0',
                padding: '0.75rem 1rem',
                backgroundColor: '#e3f2fd',
                border: '1px solid #90caf9',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: '#1976d2', fontWeight: 'bold' }}>
                  🔍 Filtered by: {statusFilter.replace('_', ' ').toUpperCase()}
                </span>
                <button
                  onClick={() => setStatusFilter(null)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Clear Filter
                </button>
              </div>
            )}

            <FileUpload onFileUpload={handleFileUpload} loading={loading} />

            <ShipmentTable
              shipments={shippingShipments}
              onUpdateShipment={handleUpdateShipment}
              onDeleteShipment={handleDeleteShipment}
              onCreateShipment={handleCreateShipment}
              loading={loading}
            />
          </div>
        );
      }
      case 'products':
        return <ProductView shipments={shipments} onUpdateShipment={handleUpdateShipment} loading={loading} />;
      case 'archives':
        return <ArchiveView />;
      case 'reports':
        return <ReportsView shipments={shipments} statusFilter={statusFilter} onStatusFilter={handleStatusCardClick} />;
      case 'advanced-reports':
        return <AdvancedReports />;
      case 'dashboard':
        return <Dashboard shipments={shipments} />;
      case 'capacity':
        return <WarehouseCapacity shipments={shipments} />;
      case 'users':
        return isAdmin ? <UserManagement /> : (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Access Denied</h2>
            <p>You need administrator privileges to access User Management.</p>
          </div>
        );
      case 'suppliers':
        return (
          <SupplierManagement
            suppliers={suppliers}
            shipments={shipments}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onImportSchedule={handleImportSchedule}
            showSuccess={showSuccess}
            showError={showError}
            loading={loading}
          />
        );
      case 'rates':
        return <RatesQuotes showSuccess={showSuccess} showError={showError} loading={loading} />;
      case 'costing':
        return <ImportCosting />;
      case 'costing-requests':
        return isAdmin ? <CostingRequests /> : (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Access Denied</h2>
            <p>You need administrator privileges to view costing requests.</p>
          </div>
        );
      case 'workflow':
        return <PostArrivalWorkflow showSuccess={showSuccess} showError={showError} showWarning={showWarning} />;
      case 'stored': {
        const storedShipments = shipments.filter(s => s.latestStatus === 'stored');
        return (
          <WarehouseStored
            shipments={storedShipments}
            onUpdateShipment={handleUpdateShipment}
            onDeleteShipment={handleDeleteShipment}
            onArchiveShipment={handleArchiveShipment}
            loading={loading}
            showSuccess={showSuccess}
            showError={showError}
          />
        );
      }
      default:
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <SynercoreLogo size="large" />
            </div>
            <h2>Welcome to Import Supply Chain Management</h2>
            <p>Select a view from the sidebar to get started.</p>
          </div>
        );
    }
  };

  if (!isAuthenticated) {
    if (currentView === 'forgotPassword') {
      return <ForgotPassword onBack={() => setCurrentView('login')} />;
    }
    if (currentView === 'resetPassword') {
      return <ResetPassword onBack={() => setCurrentView('login')} />;
    }
    return (
      <LoginPage
        onLogin={handleLogin}
        onForgotPassword={() => setCurrentView('forgotPassword')}
      />
    );
  }

  // Show Supplier Portal if requested
  if (showSupplierPortal) {
    return <SupplierLogin onClose={() => setShowSupplierPortal(false)} />;
  }

  const currentUser = authUtils.getUser();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="container">
      <OfflineIndicator />
      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <h1>Import SCM</h1>
          <p className="sidebar-subtitle">Supply Chain Management</p>
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
            products: { label: 'Products & Warehouses', icon: '📋', view: 'products' },
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
                onClick={() => setActiveView(item.view)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
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

          return (
            <nav className="sidebar-nav">
              {/* Dashboard - standalone */}
              {match('Dashboard') && renderItem('dashboard')}

              {/* Grouped sections */}
              {renderSection('Master Data', 'masterData', ['suppliers', 'products'])}
              {renderSection('Operations', 'operations', ['shipping', 'workflow', 'capacity', 'stored', 'archives'])}
              {renderSection('Finance', 'finance', ['rates', 'costing', 'costingRequests'])}
              {renderSection('Reports', 'reports', ['reports', 'advancedReports'])}
            </nav>
          );
        })()}

        {/* External Resources (collapsible) */}
        <div style={{ padding: '0 12px', marginBottom: '8px' }}>
          <details style={{ color: 'rgba(255,255,255,0.7)' }}>
            <summary style={{
              fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '8px 10px', userSelect: 'none',
              listStyle: 'none'
            }}>
              External Resources ▸
            </summary>
            <div style={{ display: 'grid', gap: '4px', padding: '6px 0' }}>
              {[
                { label: 'Transnet Portal', url: 'https://www.transnet.net/SubsiteRender.aspx?id=8137383', icon: '🚢' },
                { label: 'Marine Traffic', url: 'https://www.marinetraffic.com/en/ais/home/shipid:157944/zoom:10', icon: '🌊' },
                { label: 'FreightNews', url: 'https://www.freightnews.co.za/customs/3610/3823-19', icon: '📰' },
                { label: 'Track-Trace', url: 'https://www.track-trace.com/', icon: '📍' },
                { label: 'MyDHLi Portal', url: 'https://keycloak.mydhli.com/auth/realms/DCI/protocol/openid-connect/auth?redirect_uri=https%3A%2F%2Fapp.mydhli.com%2Flogin&scope=openid+web-origins&response_type=code&client_id=myDHLi&ui_locales=en', icon: '📦' },
                { label: 'DSV Solutions', url: 'https://mydsv.com/new/frontpage/', icon: '🚛' },
                { label: 'Afrigistics', url: 'https://www.afrigistics.com/contact/', icon: '🌍' },
              ].map(link => (
                <button
                  key={link.label}
                  className="nav-item"
                  onClick={() => window.open(link.url, '_blank')}
                  style={{ fontSize: '12.5px' }}
                >
                  <span className="nav-icon">{link.icon}</span>
                  {link.label}
                </button>
              ))}
            </div>
          </details>
        </div>

        {/* Quick Stats */}
        <div style={{
          margin: '0 12px 8px', padding: '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '8px',
          fontSize: '12px', color: 'rgba(255,255,255,0.7)'
        }}>
          <div style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Quick Stats</div>
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
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <span className="nav-icon">📚</span> Help & Guide
          </button>
          <button className="nav-item" onClick={() => setSettingsOpen(true)}>
            <span className="nav-icon">⚙️</span> Settings
          </button>
          <button className="nav-item" onClick={() => setNotificationPrefsOpen(true)}>
            <span className="nav-icon">🔔</span> Notifications
          </button>
          <button className="nav-item" onClick={() => setShowSupplierPortal(true)}>
            <span className="nav-icon">🏢</span> Supplier Portal
          </button>
          {isAdmin && (
            <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => setActiveView('users')}>
              <span className="nav-icon">👥</span> User Management
            </button>
          )}
          <button className="nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">🚪</span> Logout
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
                onClick={() => setActiveView('costing-requests')}
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

        {renderMainContent()}
      </div>

      <NotificationContainer notifications={notifications} onRemoveNotification={removeNotification} />
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
