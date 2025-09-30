// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import ShipmentTable from './components/ShipmentTable';
import ProductView from './components/ProductView';
import ArchiveView from './components/ArchiveView';
import ReportsView from './components/ReportsView';
import WarehouseCapacity from './components/WarehouseCapacity';
import SupplierManagement from './components/SupplierManagement';
import RatesQuotes from './components/RatesQuotes';
import PostArrivalWorkflow from './components/PostArrivalWorkflow';
import WarehouseStored from './components/WarehouseStored';
import FileUpload from './components/FileUpload';
import LoginPage from './components/LoginPage';
import NotificationContainer from './components/NotificationContainer';
import SynercoreLogo from './components/SynercoreLogo';
import AlertHub from './components/AlertHub';
import { ExcelProcessor } from './utils/excelProcessor';
import { Supplier } from './types/supplier';
import { computeShipmentAlerts, createCustomAlert } from './utils/alerts';
import { getApiUrl } from './config/api';
import './theme.css';

// ----- real timeout helper for fetch (since fetch doesn't honor a "timeout" option) -----
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
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

  // Alert Hub state
  const [alertHubOpen, setAlertHubOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);

  // prevent hammering the API during background polling
  const lastFetchRef = useRef({ shipments: 0, suppliers: 0 });
  const FETCH_COOLDOWN = 5000; // 5s

  // ---------- boot ----------
  useEffect(() => {
    console.log('App: Component mounted, starting initialization...');

    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedUsername = localStorage.getItem('username');
    if (savedAuth === 'true' && savedUsername) {
      setIsAuthenticated(true);
      setUsername(savedUsername);
    }

    fetchShipments();
    fetchSuppliers();

    const poll = setInterval(() => {
      console.log('App: Auto-refreshing data for real-time sync...');
      fetchShipments(true); // background sync
      fetchSuppliers(true);
    }, 30000);

    return () => clearInterval(poll);
  }, []);

  // ---------- notifications ----------
  const addNotification = (type, message, options = {}) =>
    setNotifications(prev => [...prev, { id: Date.now() + Math.random(), type, message, ...options }]);

  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));
  const showSuccess = (m, o = {}) => { console.log('📢 success:', m); addNotification('success', m, o); };
  const showError   = (m, o = {}) => { console.log('📢 error:', m);   addNotification('error', m, o); };
  const showWarning = (m, o = {}) => { console.log('📢 warn:', m);    addNotification('warning', m, o); };

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

  const showInfo    = (m, o = {}) => { console.log('📢 info:', m);    addNotification('info', m, o); };

  // ---------- data: shipments ----------
  const fetchShipments = async (isBackgroundSync = false) => {
    try {
      const now = Date.now();
      if (isBackgroundSync && (now - lastFetchRef.current.shipments) < FETCH_COOLDOWN) {
        console.log('App: Skipping shipments fetch - too soon since last fetch');
        return;
      }
      lastFetchRef.current.shipments = now;

      if (!isBackgroundSync) {
        console.log('App: Fetching shipments from API...');
        setLoading(true);
      }

      let response;
      let lastError;
      const maxRetries = 3;
      const retryDelay = 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetchWithTimeout(getApiUrl('/api/shipments'), {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          }, 10000);

          console.log(`App: Fetch attempt ${attempt}, response status: ${response.status}`);

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
          console.warn(`App: Fetch attempt failed: ${err.message}`);
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
        }
      }

      if (!response || !response.ok) throw lastError || new Error('Failed to fetch shipments after retries');

      const data = await response.json();
      console.log('App: Received shipments data:', data.length, 'items');

      const normalized = (data || []).map(s => ({
        ...s,
        quantity: Number(s.quantity) || 0,
        cbm: Number(s.cbm) || 0,
        weekNumber: Number(s.weekNumber) || 0,
      }));

      console.table(normalized.slice(0, 5).map(x => ({ prod: x.productName, cbm: x.cbm, type: typeof x.cbm })));

      // Always replace array to force downstream children (WeekCalendar) to re-render with fresh values
      setShipments(normalized);
      setLastSyncTime(new Date());
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
        console.log('App: Skipping suppliers fetch - too soon since last fetch');
        return;
      }
      lastFetchRef.current.suppliers = now;

      if (!isBackgroundSync) setLoading(true);

      const res = await fetchWithTimeout(getApiUrl('/api/suppliers'), {}, 10000);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();

      const normalized = data.map(s => Object.assign(new Supplier({}), s));
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
      if (!isBackgroundSync) setLoading(false);
    }
  };

  // ---------- CRUD: suppliers ----------
  const handleAddSupplier = async (supplier) => {
    try {
      const response = await fetch(getApiUrl('/api/suppliers'), {
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
      const response = await fetch(getApiUrl(`/api/suppliers/${id}`), {
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
      const response = await fetch(getApiUrl(`/api/suppliers/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete supplier');
      await fetchSuppliers();
      showSuccess('Supplier deleted successfully');
    } catch (err) { showError(err.message); }
  };

  // ---------- import schedule / file upload ----------
  const handleImportSchedule = async (supplierId, scheduleData, documents = []) => {
    try {
      setLoading(true);

      const response = await fetch(getApiUrl(`/api/suppliers/${supplierId}/import`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData, documents })
      });
      if (!response.ok) throw new Error('Failed to import schedule');

      const result = await response.json();
      if (result.scheduleData && result.scheduleData.length > 0) {
        const shipmentsResponse = await fetch(getApiUrl('/api/shipments/bulk-import'), {
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
      console.log('App: Starting file upload:', file.name);
      setLoading(true);

      const processedShipments = await ExcelProcessor.parseExcelFile(file);
      console.log('App: Received processed shipments:', processedShipments.length);
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
        cbm: Number(s.cbm) || 0,
        receivingWarehouse: s.receivingWarehouse,
        notes: s.notes ?? '',
      });

      const payload = processedShipments.map(toPlain);

      console.table(payload.slice(0, 5).map(x => ({
        prod: x.productName, qty: x.quantity, cbm: x.cbm, type: typeof x.cbm
      })));

      const response = await fetch(getApiUrl('/api/shipments/bulk-import'), {
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
      showSuccess(`Successfully imported ${payload.length} shipments`);
      await fetchShipments();

      // If server dropped CBM, patch UI using what we just sent (match by orderRef)
      const cbmByOrderRef = new Map(payload.map(s => [s.orderRef, s.cbm]));
      setShipments(prev => prev.map(s => ({ ...s, cbm: cbmByOrderRef.get(s.orderRef) ?? s.cbm })));
    } catch (err) {
      console.error('App: File upload error:', err);
      showError(`Failed to process file: ${err.message}`);
    } finally { setLoading(false); }
  };

  // ---------- CRUD: shipments ----------
  const handleUpdateShipment = async (id, updates) => {
    try {
      const response = await fetch(getApiUrl(`/api/shipments/${id}`), {
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
      const response = await fetch(getApiUrl(`/api/shipments/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete shipment');
      await fetchShipments();
      showSuccess('Shipment deleted successfully');
    } catch (err) { showError(err.message); }
  };

  const handleArchiveShipment = async (id) => {
    try {
      const response = await fetch(getApiUrl('/api/shipments/manual-archive'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentIds: [id] })
      });
      if (!response.ok) throw new Error('Failed to archive shipment');
      await fetchShipments();
      showSuccess('Shipment archived successfully');
    } catch (err) { showError(err.message); }
  };

  const handleCreateShipment = async (shipmentData) => {
    try {
      const response = await fetch(getApiUrl('/api/shipments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });
      if (!response.ok) throw new Error('Failed to create shipment');
      await fetchShipments();
      showSuccess('Shipment added successfully');
    } catch (err) {
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
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
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
        let shippingShipments = shipments.filter(s =>
          s.latestStatus !== 'arrived_pta' &&
          s.latestStatus !== 'arrived_klm' &&
          s.latestStatus !== 'stored' &&
          s.latestStatus !== 'received' &&
          !s.isInPostArrivalWorkflow?.()
        );

        if (statusFilter) {
          shippingShipments = shippingShipments.filter(s => s.latestStatus === statusFilter);
        }
        console.log('📦 Shipping Schedule - Total shipments:', shipments.length);
        console.log('📦 Shipping Schedule - Filtered shipments:', shippingShipments.length);

        const stats = {
          total: shippingShipments.length,
          planned_airfreight: 0, planned_seafreight: 0,
          in_transit_airfreight: 0, in_transit_roadway: 0, in_transit_seaway: 0,
          moored: 0, berth_working: 0, berth_complete: 0,
          arrived_pta: 0, arrived_klm: 0,
          unloading: 0, inspection_pending: 0, inspecting: 0,
          inspection_failed: 0, inspection_passed: 0,
          receiving: 0, received: 0, stored: 0,
          delayed: 0, cancelled: 0
        };
        shippingShipments.forEach(s => { if (stats.hasOwnProperty(s.latestStatus)) stats[s.latestStatus]++; });

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
      case 'capacity':
        return <WarehouseCapacity shipments={shipments} />;
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
      case 'workflow':
        return <PostArrivalWorkflow />;
      case 'stored': {
        const storedShipments = shipments.filter(s => s.latestStatus === 'stored');
        console.log('🏪 Warehouse Stored - Total shipments:', shipments.length);
        console.log('🏪 Warehouse Stored - Filtered stored shipments:', storedShipments.length);
        return (
          <WarehouseStored
            shipments={storedShipments}
            onUpdateShipment={handleUpdateShipment}
            onDeleteShipment={handleDeleteShipment}
            onArchiveShipment={handleArchiveShipment}
            loading={loading}
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
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="container">
      <div className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Import Supply Chain Management</h2>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
            title={`Logged in as ${username}`}
          >
            Logout
          </button>
        </div>

        <ul className="sidebar-nav">
          <li><button className={activeView === 'suppliers' ? 'active' : ''} onClick={() => setActiveView('suppliers')}>🏢 Suppliers</button></li>
          <li><button className={activeView === 'capacity' ? 'active' : ''} onClick={() => setActiveView('capacity')}>🏭 Warehouse Capacity</button></li>
          <li><button className={activeView === 'products' ? 'active' : ''} onClick={() => setActiveView('products')}>📋 Product & Warehouse</button></li>
          <li><button className={activeView === 'shipping' ? 'active' : ''} onClick={() => setActiveView('shipping')}>📦 Shipping Schedule</button></li>
          <li><button className={activeView === 'workflow' ? 'active' : ''} onClick={() => setActiveView('workflow')}>📋 Post-Arrival Workflow</button></li>
          <li><button className={activeView === 'reports' ? 'active' : ''} onClick={() => setActiveView('reports')}>📊 Reports</button></li>
          <li><button className={activeView === 'archives' ? 'active' : ''} onClick={() => setActiveView('archives')}>📦 Shipment Archives</button></li>
          <li><button className={activeView === 'rates' ? 'active' : ''} onClick={() => setActiveView('rates')}>💰 Rates & Quotes</button></li>
          <li><button className={activeView === 'stored' ? 'active' : ''} onClick={() => setActiveView('stored')}>🏪 Warehouse Stored</button></li>
        </ul>

        {/* External links & quick stats unchanged (kept for brevity) */}
        {/* --- External Resources --- */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', opacity: 0.8 }}>External Resources</h4>
          <button
            onClick={() => window.open('https://www.transnet.net/SubsiteRender.aspx?id=8137383', '_blank')}
            style={{
              width: '100%', padding: '0.75rem', backgroundColor: '#0066cc', color: 'white', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = '#0052a3'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = '#0066cc'; e.target.style.transform = 'translateY(0)'; }}
            title="Open Transnet website in new tab"
          >
            🚢 Transnet Portal
          </button>

          <button
            onClick={() => window.open('https://www.marinetraffic.com/en/ais/home/shipid:157944/zoom:10', '_blank')}
            style={{
              width: '100%', padding: '0.75rem', backgroundColor: '#1e7e8c', color: 'white', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease', marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = '#165f6a'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = '#1e7e8c'; e.target.style.transform = 'translateY(0)'; }}
            title="Open MarineTraffic ship tracking in new tab"
          >
            🌊 Marine Traffic
          </button>

          <button
            onClick={() => window.open('https://www.freightnews.co.za/customs/3610/3823-19', '_blank')}
            style={{
              width: '100%', padding: '0.75rem', backgroundColor: '#e85d04', color: 'white', border: 'none',
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease', marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = '#dc5404'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = '#e85d04'; e.target.style.transform = 'translateY(0)'; }}
            title="Open FreightNews customs information in new tab"
          >
            📰 FreightNews Customs
          </button>

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <h5 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Freight Forwarding
            </h5>

            <button
              onClick={() => window.open('https://keycloak.mydhli.com/auth/realms/DCI/protocol/openid-connect/auth?redirect_uri=https%3A%2F%2Fapp.mydhli.com%2Flogin&scope=openid+web-origins&response_type=code&client_id=myDHLi&ui_locales=en', '_blank')}
              style={{
                width: '100%', padding: '0.6rem', backgroundColor: '#d40511', color: 'white', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease', marginBottom: '0.4rem'
              }}
              onMouseEnter={(e) => { e.target.style.backgroundColor = '#b50410'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = '#d40511'; e.target.style.transform = 'translateY(0)'; }}
              title="Access MyDHLi platform"
            >
              📦 MyDHLi Portal
            </button>

            <button
              onClick={() => window.open('https://mydsv.com/new/frontpage/', '_blank')}
              style={{
                width: '100%', padding: '0.6rem', backgroundColor: '#003d6b', color: 'white', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease', marginBottom: '0.4rem'
              }}
              onMouseEnter={(e) => { e.target.style.backgroundColor = '#002d4f'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = '#003d6b'; e.target.style.transform = 'translateY(0)'; }}
              title="Get DSV freight forwarding quotes"
            >
              🚛 DSV Solutions
            </button>

            <button
              onClick={() => window.open('https://www.afrigistics.com/contact/', '_blank')}
              style={{
                width: '100%', padding: '0.6rem', backgroundColor: '#1a5f2f', color: 'white', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.target.style.backgroundColor = '#134521'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.backgroundColor = '#1a5f2f'; e.target.style.transform = 'translateY(0)'; }}
              title="Contact Afrigistics for freight forwarding quotes"
            >
              🌍 Afrigistics
            </button>
          </div>
        </div>

        {/* current view */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          borderLeft: '4px solid #fff'
        }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.25rem' }}>Active View:</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            {activeView === 'suppliers' ? '🏢 Suppliers' :
             activeView === 'capacity' ? '🏭 Warehouse Capacity' :
             activeView === 'products' ? '📋 Product & Warehouse' :
             activeView === 'shipping' ? '📦 Shipping Schedule' :
             activeView === 'workflow' ? '📋 Post-Arrival Workflow' :
             activeView === 'reports' ? '📊 Reports' :
             activeView === 'archives' ? '📦 Shipment Archives' :
             activeView === 'rates' ? '💰 Rates & Quotes' :
             activeView === 'stored' ? '🏪 Warehouse Stored' :
             '❓ Select View'}
          </p>
        </div>

        {/* quick stats */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Quick Stats</h4>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Items:</span><strong>{shipments.length}</strong>
            </p>
            <p style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>In Transit:</span>
              <strong>{shipments.filter(s => s.latestStatus === 'in_transit_roadway' || s.latestStatus === 'in_transit_seaway').length}</strong>
            </p>
            <p style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Delayed:</span>
              <strong style={{ color: '#ffeb3b' }}>{shipments.filter(s => s.latestStatus === 'delayed').length}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* main panel */}
      <div className="main-content">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem',
          borderBottom: '1px solid #eee', marginBottom: '1rem', width: '100%'
        }}>
          <SynercoreLogo size="medium" />
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
                backgroundColor: '#ef4444',
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
    </div>
  );
}

export default App;
