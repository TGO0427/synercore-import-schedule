import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
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
import { ExcelProcessor } from './utils/excelProcessor';
import { Supplier } from './types/supplier';

function App() {
  const [shipments, setShipments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeView, setActiveView] = useState('shipping');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);  // null means no filter

  useEffect(() => {
    console.log('App: Component mounted, starting initialization...');

    // Check for existing authentication
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedUsername = localStorage.getItem('username');

    if (savedAuth === 'true' && savedUsername) {
      setIsAuthenticated(true);
      setUsername(savedUsername);
    }

    fetchShipments();
    fetchSuppliers();

    // Set up automatic data refresh every 10 seconds for real-time updates
    const pollInterval = setInterval(() => {
      console.log('App: Auto-refreshing data for real-time sync...');
      fetchShipments(true); // true indicates this is a background sync
      fetchSuppliers(true);
    }, 10000); // 10 seconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(pollInterval);
    };
    
    // Test XLSX library loading
    try {
      console.log('App: Testing module imports...');
      import('./utils/excelProcessor').then(module => {
        console.log('App: ExcelProcessor imported successfully', module);
      }).catch(importError => {
        console.error('App: Failed to import ExcelProcessor:', importError);
      });
    } catch (error) {
      console.error('App: Error testing imports:', error);
    }
  }, []);

  // Notification helpers
  const addNotification = (type, message, options = {}) => {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      message,
      ...options
    };
    setNotifications(prev => [...prev, notification]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showSuccess = (message, options = {}) => {
    console.log('📢 Showing success notification:', message);
    return addNotification('success', message, options);
  };
  const showError = (message, options = {}) => {
    console.log('📢 Showing error notification:', message);
    return addNotification('error', message, options);
  };
  const showWarning = (message, options = {}) => {
    console.log('📢 Showing warning notification:', message);
    return addNotification('warning', message, options);
  };
  const showInfo = (message, options = {}) => {
    console.log('📢 Showing info notification:', message);
    return addNotification('info', message, options);
  };

  const fetchShipments = async (isBackgroundSync = false) => {
    try {
      if (!isBackgroundSync) {
        console.log('App: Fetching shipments from API...');
        setLoading(true);
      }
      const response = await fetch('/api/shipments');
      console.log('App: Fetch response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch shipments');
      const data = await response.json();
      console.log('App: Received shipments data:', data.length, 'items');

      // Normalize numbers after GET (defensive)
      const normalized = (data || []).map(s => ({
        ...s,
        quantity: Number(s.quantity) || 0,
        cbm: Number(s.cbm) || 0,
        weekNumber: Number(s.weekNumber) || 0,
      }));

      console.table(normalized.slice(0, 5).map(x => ({
        prod: x.productName, cbm: x.cbm, type: typeof x.cbm
      })));

      // Only update state if data has actually changed (reduce flickering)
      setShipments(prevShipments => {
        if (JSON.stringify(prevShipments) === JSON.stringify(normalized)) {
          return prevShipments; // No change, return same reference
        }
        return normalized;
      });
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('App: Error fetching shipments:', err);
      if (!isBackgroundSync) {
        showError(`Failed to load shipments: ${err.message}`);
      }
    } finally {
      if (!isBackgroundSync) {
        setLoading(false);
      }
    }
  };

  const fetchSuppliers = async (isBackgroundSync = false) => {
    try {
      if (!isBackgroundSync) {
        setLoading(true);
      }
      const response = await fetch('/api/suppliers');
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      const data = await response.json();
      const normalized = data.map(s => Object.assign(new Supplier({}), s));

      // Only update state if data has actually changed (reduce flickering)
      setSuppliers(prevSuppliers => {
        if (JSON.stringify(prevSuppliers) === JSON.stringify(normalized)) {
          return prevSuppliers; // No change, return same reference
        }
        return normalized;
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      if (!isBackgroundSync) {
        showError(err.message);
      }
    } finally {
      if (!isBackgroundSync) {
        setLoading(false);
      }
    }
  };

  const handleAddSupplier = async (supplier) => {
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
      });
      
      if (!response.ok) throw new Error('Failed to add supplier');
      
      await fetchSuppliers();
      showSuccess('Supplier added successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleUpdateSupplier = async (id, updates) => {
    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Failed to update supplier');
      
      await fetchSuppliers();
      showSuccess('Supplier updated successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    
    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete supplier');
      
      await fetchSuppliers();
      showSuccess('Supplier deleted successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleImportSchedule = async (supplierId, scheduleData, documents = []) => {
    try {
      setLoading(true);
      
      // Send the schedule data to the supplier import endpoint
      const response = await fetch(`/api/suppliers/${supplierId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData, documents })
      });
      
      if (!response.ok) throw new Error('Failed to import schedule');
      
      const result = await response.json();
      
      // Add the processed schedule data to shipments
      if (result.scheduleData && result.scheduleData.length > 0) {
        const shipmentsResponse = await fetch('/api/shipments/bulk-import', {
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
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
  try {
    console.log('App: Starting file upload:', file.name);
    setLoading(true);

    console.log('App: Calling ExcelProcessor.parseExcelFile');
    const processedShipments = await ExcelProcessor.parseExcelFile(file);
    console.log('App: Received processed shipments:', processedShipments.length);

    if (processedShipments.length === 0) {
      throw new Error('No data found in Excel file');
    }

    // ✅ Convert class instances -> plain JSON & coerce numbers
    const toPlain = (s) => ({
      id: s.id,
      supplier: s.supplier,
      orderRef: s.orderRef,
      finalPod: s.finalPod,
      latestStatus: s.latestStatus,
      weekNumber: Number(s.weekNumber) || 0,
      productName: s.productName,
      quantity: Number(s.quantity) || 0,
      cbm: Number(s.cbm) || 0,                 // <-- keep CBM!
      receivingWarehouse: s.receivingWarehouse,
      notes: s.notes ?? '',
    });

    const payload = processedShipments.map(toPlain);

    // Debug: verify we're sending CBM
    console.table(payload.slice(0, 5).map(x => ({
      prod: x.productName, qty: x.quantity, cbm: x.cbm, type: typeof x.cbm
    })));

    console.log('App: Using bulk import for', payload.length, 'shipments');
    const response = await fetch('/api/shipments/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),           // <-- send plain array with cbm
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('App: Failed bulk import:', response.status, errorText);
      throw new Error(`Failed bulk import: ${response.status}`);
    }

    const result = await response.json();
    console.log('App: Bulk import result:', result);

    showSuccess(`Successfully imported ${payload.length} shipments`);
    console.log('App: Refreshing shipments list');
    await fetchShipments();

    // 🩹 If server still drops CBM, patch UI from what we just imported (join on ORDER/REF)
    const cbmByOrderRef = new Map(payload.map(s => [s.orderRef, s.cbm]));
    setShipments(prev =>
      prev.map(s => ({
        ...s,
        cbm: cbmByOrderRef.get(s.orderRef) ?? s.cbm, // only fill when missing
      }))
    );

  } catch (err) {
    console.error('App: File upload error:', err);
    showError(`Failed to process file: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  const handleUpdateShipment = async (id, updates) => {
    try {
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Failed to update shipment');
      
      await fetchShipments();
      showSuccess('Shipment updated successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleDeleteShipment = async (id) => {
    try {
      const response = await fetch(`/api/shipments/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete shipment');

      await fetchShipments();
      showSuccess('Shipment deleted successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleArchiveShipment = async (id) => {
    try {
      const response = await fetch('/api/shipments/manual-archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipmentIds: [id] })
      });

      if (!response.ok) throw new Error('Failed to archive shipment');

      await fetchShipments();
      showSuccess('Shipment archived successfully');
    } catch (err) {
      showError(err.message);
    }
  };

  const handleCreateShipment = async (shipmentData) => {
    try {
      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentData)
      });
      
      if (!response.ok) throw new Error('Failed to create shipment');
      
      await fetchShipments();
      showSuccess('Shipment added successfully');
    } catch (err) {
      showError(err.message);
      throw err; // Re-throw so the dialog can handle it
    }
  };

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

  const renderMainContent = () => {
    switch (activeView) {
      case 'shipping':
        // Filter out arrived and stored shipments from shipping schedule
        let shippingShipments = shipments.filter(s =>
          s.latestStatus !== 'arrived_pta' &&
          s.latestStatus !== 'arrived_klm' &&
          s.latestStatus !== 'stored' &&
          s.latestStatus !== 'received' &&
          !s.isInPostArrivalWorkflow?.()
        );

        // Apply status filter if one is selected
        if (statusFilter) {
          shippingShipments = shippingShipments.filter(s => s.latestStatus === statusFilter);
        }
        console.log('📦 Shipping Schedule - Total shipments:', shipments.length);
        console.log('📦 Shipping Schedule - Filtered shipments:', shippingShipments.length);

        // Calculate stats for individual status cards
        const getShippingStats = () => {
          const stats = {
            total: shippingShipments.length,
            planned_airfreight: 0,
            planned_seafreight: 0,
            in_transit_airfreight: 0,
            in_transit_roadway: 0,
            in_transit_seaway: 0,
            moored: 0,
            berth_working: 0,
            berth_complete: 0,
            arrived_pta: 0,
            arrived_klm: 0,
            unloading: 0,
            inspection_pending: 0,
            inspecting: 0,
            inspection_failed: 0,
            inspection_passed: 0,
            receiving: 0,
            received: 0,
            stored: 0,
            delayed: 0,
            cancelled: 0
          };

          shippingShipments.forEach(shipment => {
            if (stats.hasOwnProperty(shipment.latestStatus)) {
              stats[shipment.latestStatus]++;
            }
          });

          return stats;
        };

        const shippingStats = getShippingStats();

        // Handler for status card clicks
        const handleStatusCardClick = (status) => {
          if (statusFilter === status) {
            setStatusFilter(null); // Clear filter if same card is clicked
          } else {
            setStatusFilter(status); // Set new filter
          }
        };

        return (
          <div className="window-content">
            <div className="stats-grid">
              <div
                className={`stat-card total ${statusFilter === null ? 'active' : ''}`}
                onClick={() => setStatusFilter(null)}
                style={{ cursor: 'pointer' }}
              >
                <h3>{shippingStats.total}</h3>
                <p>Total Shipments</p>
              </div>

              {/* Planning Phase */}
              {shippingStats.planned_airfreight > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.planned_airfreight}</h3>
                  <p>Planned Airfreight</p>
                </div>
              )}
              {shippingStats.planned_seafreight > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.planned_seafreight}</h3>
                  <p>Planned Seafreight</p>
                </div>
              )}

              {/* In Transit Phase */}
              {shippingStats.in_transit_airfreight > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.in_transit_airfreight}</h3>
                  <p>In Transit Air</p>
                </div>
              )}
              {shippingStats.in_transit_roadway > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.in_transit_roadway}</h3>
                  <p>In Transit Road</p>
                </div>
              )}
              {shippingStats.in_transit_seaway > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.in_transit_seaway}</h3>
                  <p>In Transit Sea</p>
                </div>
              )}
              {shippingStats.moored > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.moored}</h3>
                  <p>Moored</p>
                </div>
              )}
              {shippingStats.berth_working > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.berth_working}</h3>
                  <p>Berth Working</p>
                </div>
              )}
              {shippingStats.berth_complete > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.berth_complete}</h3>
                  <p>Berth Complete</p>
                </div>
              )}

              {/* Arrival Phase */}
              {shippingStats.arrived_pta > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.arrived_pta}</h3>
                  <p>Arrived PTA</p>
                </div>
              )}
              {shippingStats.arrived_klm > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.arrived_klm}</h3>
                  <p>Arrived KLM</p>
                </div>
              )}

              {/* Processing Phase */}
              {shippingStats.unloading > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.unloading}</h3>
                  <p>Unloading</p>
                </div>
              )}
              {shippingStats.inspection_pending > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.inspection_pending}</h3>
                  <p>Inspection Pending</p>
                </div>
              )}
              {shippingStats.inspecting > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.inspecting}</h3>
                  <p>Inspecting</p>
                </div>
              )}
              {shippingStats.inspection_failed > 0 && (
                <div className="stat-card alert">
                  <h3>{shippingStats.inspection_failed}</h3>
                  <p>Inspection Failed</p>
                </div>
              )}
              {shippingStats.inspection_passed > 0 && (
                <div className="stat-card success">
                  <h3>{shippingStats.inspection_passed}</h3>
                  <p>Inspection Passed</p>
                </div>
              )}
              {shippingStats.receiving > 0 && (
                <div className="stat-card">
                  <h3>{shippingStats.receiving}</h3>
                  <p>Receiving</p>
                </div>
              )}

              {/* Completion Phase */}
              {shippingStats.received > 0 && (
                <div className="stat-card success">
                  <h3>{shippingStats.received}</h3>
                  <p>Received</p>
                </div>
              )}
              {shippingStats.stored > 0 && (
                <div className="stat-card success">
                  <h3>{shippingStats.stored}</h3>
                  <p>Stored</p>
                </div>
              )}

              {/* Issue Statuses */}
              {shippingStats.delayed > 0 && (
                <div className="stat-card alert">
                  <h3>{shippingStats.delayed}</h3>
                  <p>Delayed</p>
                </div>
              )}
              {shippingStats.cancelled > 0 && (
                <div className="stat-card cancelled">
                  <h3>{shippingStats.cancelled}</h3>
                  <p>Cancelled</p>
                </div>
              )}
            </div>

            <FileUpload
              onFileUpload={handleFileUpload}
              loading={loading}
            />

            <ShipmentTable
              shipments={shippingShipments}
              onUpdateShipment={handleUpdateShipment}
              onDeleteShipment={handleDeleteShipment}
              onCreateShipment={handleCreateShipment}
              loading={loading}
            />
          </div>
        );
      case 'products':
        return (
          <ProductView 
            shipments={shipments}
            onUpdateShipment={handleUpdateShipment}
            loading={loading}
          />
        );
      case 'archives':
        return <ArchiveView />;
      case 'reports':
        return (
          <ReportsView 
            shipments={shipments}
          />
        );
      case 'capacity':
        return (
          <WarehouseCapacity 
            shipments={shipments}
          />
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
        return (
          <RatesQuotes
            showSuccess={showSuccess}
            showError={showError}
            loading={loading}
          />
        );
      case 'workflow':
        return <PostArrivalWorkflow />;
      case 'stored':
        const storedShipments = shipments.filter(s => s.latestStatus === 'stored');
        console.log('🏪 Warehouse Stored - Total shipments:', shipments.length);
        console.log('🏪 Warehouse Stored - Filtered stored shipments:', storedShipments.length);
        console.log('🏪 Warehouse Stored - Stored shipments data:', storedShipments);
        return (
          <WarehouseStored
            shipments={storedShipments}
            onUpdateShipment={handleUpdateShipment}
            onDeleteShipment={handleDeleteShipment}
            onArchiveShipment={handleArchiveShipment}
            loading={loading}
          />
        );
      default:
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
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
          <li>
            <button 
              className={activeView === 'suppliers' ? 'active' : ''}
              onClick={() => setActiveView('suppliers')}
            >
              🏢 Suppliers
            </button>
          </li>
          <li>
            <button 
              className={activeView === 'capacity' ? 'active' : ''}
              onClick={() => setActiveView('capacity')}
            >
              🏭 Warehouse Capacity
            </button>
          </li>
          <li>
            <button 
              className={activeView === 'products' ? 'active' : ''}
              onClick={() => setActiveView('products')}
            >
              📋 Product & Warehouse
            </button>
          </li>
          <li>
            <button
              className={activeView === 'shipping' ? 'active' : ''}
              onClick={() => setActiveView('shipping')}
            >
              📦 Shipping Schedule
            </button>
          </li>
          <li>
            <button
              className={activeView === 'workflow' ? 'active' : ''}
              onClick={() => setActiveView('workflow')}
            >
              📋 Post-Arrival Workflow
            </button>
          </li>
          <li>
            <button
              className={activeView === 'reports' ? 'active' : ''}
              onClick={() => setActiveView('reports')}
            >
              📊 Reports
            </button>
          </li>
          <li>
            <button 
              className={activeView === 'archives' ? 'active' : ''}
              onClick={() => setActiveView('archives')}
            >
              📦 Shipment Archives
            </button>
          </li>
          <li>
            <button
              className={activeView === 'rates' ? 'active' : ''}
              onClick={() => setActiveView('rates')}
            >
              💰 Rates & Quotes
            </button>
          </li>
          <li>
            <button
              className={activeView === 'stored' ? 'active' : ''}
              onClick={() => setActiveView('stored')}
            >
              🏪 Warehouse Stored
            </button>
          </li>
        </ul>

        {/* External Links */}
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
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#0052a3';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#0066cc';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Open Transnet website in new tab"
          >
            🚢 Transnet Portal
          </button>
          
          <button
            onClick={() => window.open('https://www.marinetraffic.com/en/ais/home/shipid:157944/zoom:10', '_blank')}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#1e7e8c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#165f6a';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1e7e8c';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Open MarineTraffic ship tracking in new tab"
          >
            🌊 Marine Traffic
          </button>
          
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid rgba(255,255,255,0.1)' 
          }}>
            <h5 style={{ marginBottom: '0.75rem', fontSize: '0.85rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Freight Forwarding
            </h5>
            
            <button
              onClick={() => window.open('https://keycloak.mydhli.com/auth/realms/DCI/protocol/openid-connect/auth?redirect_uri=https%3A%2F%2Fapp.mydhli.com%2Flogin&scope=openid+web-origins&response_type=code&client_id=myDHLi&ui_locales=en', '_blank')}
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: '#d40511',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                marginBottom: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#b50410';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#d40511';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Access MyDHLi platform"
            >
              📦 MyDHLi Portal
            </button>
            
            <button
              onClick={() => window.open('https://mydsv.com/new/frontpage/', '_blank')}
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: '#003d6b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                marginBottom: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#002d4f';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#003d6b';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Get DSV freight forwarding quotes"
            >
              🚛 DSV Solutions
            </button>
            
            <button
              onClick={() => window.open('https://www.afrigistics.com/contact/', '_blank')}
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: '#1a5f2f',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#134521';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1a5f2f';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Contact Afrigistics for freight forwarding quotes"
            >
              🌍 Afrigistics
            </button>
          </div>
          {/* External buttons with correct URLs */}
        </div>

        {/* Current View Indicator */}
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
             '❓ Select View'}
          </p>
        </div>

        {/* Sidebar Stats */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Quick Stats</h4>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Items:</span> 
              <strong>{shipments.length}</strong>
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

      <div className="main-content">
        {renderMainContent()}
      </div>

      <NotificationContainer 
        notifications={notifications} 
        onRemoveNotification={removeNotification} 
      />
    </div>
  );
}

export default App;