// src/App.jsx
import React, { useState, useEffect, useRef, Suspense, lazy, startTransition } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SynercoreLogo from './components/SynercoreLogo';
import { useNotification } from './contexts/NotificationContext';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionOverlay from './components/ConnectionOverlay';
import { VIEW_ROUTES } from './routes';

// Lazy-loaded pages (code-split for faster initial load)
const Dashboard = lazy(() => import('./components/Dashboard'));
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
const AuditLog = lazy(() => import('./components/AuditLog'));
import SupplierLogin from './pages/SupplierLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import useWebSocket from './hooks/useWebSocket';
import useShipments from './hooks/useShipments';
import useSuppliers from './hooks/useSuppliers';
import useAlerts from './hooks/useAlerts';
import { authFetch } from './utils/authFetch';
import { getApiUrl } from './config/api';
import { authUtils } from './utils/auth';
import { POST_ARRIVAL_STATUSES } from './types/shipment';
import { initWebVitals, logWebVitalsToConsole } from './utils/webVitals';
import { initializeAnalytics } from './config/analytics';
import './theme.css';

// Initialize monitoring
initWebVitals();
logWebVitalsToConsole();
initializeAnalytics();

// Per-route loading fallback
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
    Loading...
  </div>
);

function App() {
  // ---------- custom hooks ----------
  const {
    shipments, setShipments, loading, lastSyncTime,
    fetchShipments, handleCreateShipment, handleUpdateShipment,
    handleDeleteShipment, handleArchiveShipment, handleFileUpload,
  } = useShipments();

  const {
    suppliers, fetchSuppliers,
    handleAddSupplier, handleUpdateSupplier, handleDeleteSupplier, handleImportSchedule,
  } = useSuppliers(fetchShipments);

  const { alerts, handleAlertDismiss, handleAlertMarkRead, pushAlert } = useAlerts(shipments);

  const { showInfo, isNavigationBlocked, confirm } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const user = authUtils.getUser();
    return !!(user && authUtils.isAuthenticated() && !authUtils.isTokenExpired());
  });
  const [username, setUsername] = useState(() => {
    const user = authUtils.getUser();
    return user?.username || '';
  });
  const [showSupplierPortal, setShowSupplierPortal] = useState(false);

  // UI panel state
  const [alertHubOpen, setAlertHubOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationPrefsOpen, setNotificationPrefsOpen] = useState(false);
  const [liveBoardOpen, setLiveBoardOpen] = useState(false);

  // Costing Requests badge count (admin only)
  const [costingRequestCount, setCostingRequestCount] = useState(0);

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

  // Theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('synercore_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('synercore_theme', theme);
  }, [theme]);

  // WebSocket integration
  const { isConnected: wsConnected, onShipmentUpdate, onDocumentUpload } = useWebSocket();

  const initializedRef = useRef(false);

  // ---------- WebSocket real-time updates ----------
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
    });
    return unsubscribe;
  }, [onShipmentUpdate, setShipments]);

  useEffect(() => {
    const unsubscribe = onDocumentUpload((data) => {
      showInfo(`📄 Document uploaded: ${data.document.fileName} for shipment ${data.shipmentId}`);
    });
    return unsubscribe;
  }, [onDocumentUpload, showInfo]);

  // ---------- boot ----------
  useEffect(() => {
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
      if (authUtils.isAuthenticated() || authUtils.getUser()) {
        authUtils.clearAuth();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- polling fallback ----------
  useEffect(() => {
    const poll = setInterval(() => {
      if (authUtils.isAuthenticated() && !wsConnected) {
        fetchShipments(true);
        fetchSuppliers(true);
      }
    }, 30000);
    return () => clearInterval(poll);
  }, [wsConnected, fetchShipments, fetchSuppliers]);

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

  // ---------- auth ----------
  const handleLogin = (loginUsername) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', loginUsername);
    setIsAuthenticated(true);
    setUsername(loginUsername);
    initializedRef.current = true;
    fetchShipments();
    fetchSuppliers();
  };

  const handleLogout = () => {
    authUtils.clearAuth();
    setIsAuthenticated(false);
    setUsername('');
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
    if (path === '/audit') return 'audit';
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
            {sidebarCollapsed ? '\u00BB' : '\u00AB'}
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

          const delayedCount = shipments.filter(s => s.latestStatus && s.latestStatus.startsWith('delayed_')).length;
          const workflowCount = shipments.filter(s => POST_ARRIVAL_STATUSES.includes(s.latestStatus)).length;

          const navItems = {
            dashboard: { label: 'Dashboard', icon: '\u{1F4CA}', view: 'dashboard' },
            suppliers: { label: 'Suppliers', icon: '\u{1F3E2}', view: 'suppliers' },
            shipping: { label: 'Shipping Schedule', icon: '\u{1F4E6}', view: 'shipping', badge: delayedCount, badgeType: 'danger' },
            workflow: { label: 'Post-Arrival Workflow', icon: '\u{1F4CB}', view: 'workflow', badge: workflowCount, badgeType: 'info' },
            capacity: { label: 'Warehouse Capacity', icon: '\u{1F3ED}', view: 'capacity' },
            stored: { label: 'Stored Stock', icon: '\u{1F3EA}', view: 'stored' },
            archives: { label: 'Shipment Archives', icon: '\u{1F4E6}', view: 'archives' },
            rates: { label: 'Rates & Quotes', icon: '\u{1F4B0}', view: 'rates' },
            costing: { label: 'Import Costing', icon: '\u{1F4CA}', view: 'costing' },
            costingRequests: { label: 'Cost Requests', icon: '\u{1F4CB}', view: 'costing-requests', adminOnly: true, badge: costingRequestCount },
            reports: { label: 'Reports', icon: '\u{1F4CA}', view: 'reports' },
            advancedReports: { label: 'Advanced Reports', icon: '\u{1F4C8}', view: 'advanced-reports' },
            audit: { label: 'Activity Log', icon: '\u{1F4DD}', view: 'audit', adminOnly: true },
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
                onClick={() => {
                  const route = VIEW_ROUTES[item.view] || '/shipping';
                  if (isNavigationBlocked()) {
                    confirm({
                      title: 'Unsaved Changes',
                      message: 'You have unsaved changes that will be lost. Are you sure you want to leave this page?',
                      confirmText: 'Leave',
                      cancelText: 'Stay',
                      type: 'warning',
                    }).then((confirmed) => {
                      if (confirmed) startTransition(() => navigate(route));
                    });
                  } else {
                    startTransition(() => navigate(route));
                  }
                }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge > 0 && (
                  <span className={`nav-badge ${item.badgeType === 'danger' ? 'nav-badge-danger' : item.badgeType === 'info' ? 'nav-badge-info' : ''}`}>
                    {item.badge}
                  </span>
                )}
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
            if (q && visibleItems.length === 0) return null;
            const isOpen = q ? true : sidebarSections[sectionKey];

            return (
              <div className="nav-section" key={sectionKey}>
                <div className="nav-section-header" onClick={() => !q && toggleSection(sectionKey)}>
                  {title}
                  <span className={`chevron ${isOpen ? 'open' : ''}`}>{'\u25B8'}</span>
                </div>
                <div className={`nav-section-items ${isOpen ? 'expanded' : 'collapsed'}`}>
                  {visibleItems.map(k => renderItem(k))}
                </div>
              </div>
            );
          };

          const externalLinks = [
            { label: 'Transnet Portal', url: 'https://www.transnet.net/SubsiteRender.aspx?id=8137383', icon: '\u{1F6A2}' },
            { label: 'Marine Traffic', url: 'https://www.marinetraffic.com/en/ais/home/shipid:157944/zoom:10', icon: '\u{1F30A}' },
            { label: 'FreightNews', url: 'https://www.freightnews.co.za/customs/3610/3823-19', icon: '\u{1F4F0}' },
            { label: 'Track-Trace', url: 'https://www.track-trace.com/', icon: '\u{1F4CD}' },
            { label: 'MyDHLi Portal', url: 'https://keycloak.mydhli.com/auth/realms/DCI/protocol/openid-connect/auth?redirect_uri=https%3A%2F%2Fapp.mydhli.com%2Flogin&scope=openid+web-origins&response_type=code&client_id=myDHLi&ui_locales=en', icon: '\u{1F4E6}' },
            { label: 'DSV Solutions', url: 'https://mydsv.com/new/frontpage/', icon: '\u{1F69B}' },
            { label: 'Afrigistics', url: 'https://www.afrigistics.com/contact/', icon: '\u{1F30D}' },
          ];
          const resourcesVisible = !q ? externalLinks : externalLinks.filter(l => l.label.toLowerCase().includes(q));
          const resourcesOpen = q ? resourcesVisible.length > 0 : sidebarSections.resources;

          return (
            <nav className="sidebar-nav">
              {match('Dashboard') && renderItem('dashboard')}
              {renderSection('Master Data', 'masterData', ['suppliers'])}
              {renderSection('Operations', 'operations', ['shipping', 'workflow', 'capacity', 'stored', 'archives'])}
              {renderSection('Finance', 'finance', ['rates', 'costing', 'costingRequests'])}
              {renderSection('Reports', 'reports', ['reports', 'advancedReports', 'audit'])}

              {!sidebarCollapsed && (!q || resourcesVisible.length > 0) && (
                <div className="sidebar-resources">
                  <div className="nav-section-header" onClick={() => !q && toggleSection('resources')}>
                    Resources
                    <span className={`chevron ${resourcesOpen ? 'open' : ''}`}>{'\u25B8'}</span>
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
                        <span className="nav-external">{'\u2197'}</span>
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
            <span>Delayed</span><strong style={{ color: '#fbbf24' }}>{shipments.filter(s => s.latestStatus && s.latestStatus.startsWith('delayed_')).length}</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title={sidebarCollapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}>
            <span className="nav-icon">{theme === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}</span> <span className="nav-label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button className="nav-item" onClick={() => setHelpOpen(true)} title={sidebarCollapsed ? 'Help & Guide' : undefined}>
            <span className="nav-icon">{'\u{1F4DA}'}</span> <span className="nav-label">Help & Guide</span>
          </button>
          <button className="nav-item" onClick={() => setSettingsOpen(true)} title={sidebarCollapsed ? 'Settings' : undefined}>
            <span className="nav-icon">{'\u2699\uFE0F'}</span> <span className="nav-label">Settings</span>
          </button>
          <button className="nav-item" onClick={() => setNotificationPrefsOpen(true)} title={sidebarCollapsed ? 'Notifications' : undefined}>
            <span className="nav-icon">{'\u{1F514}'}</span> <span className="nav-label">Notifications</span>
          </button>
          <button className="nav-item" onClick={() => setShowSupplierPortal(true)} title={sidebarCollapsed ? 'Supplier Portal' : undefined}>
            <span className="nav-icon">{'\u{1F3E2}'}</span> <span className="nav-label">Supplier Portal</span>
          </button>
          {isAdmin && (
            <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => startTransition(() => navigate('/users'))} title={sidebarCollapsed ? 'User Management' : undefined}>
              <span className="nav-icon">{'\u{1F465}'}</span> <span className="nav-label">User Management</span>
            </button>
          )}
          <button className="nav-item logout" onClick={handleLogout} title={sidebarCollapsed ? 'Logout' : undefined}>
            <span className="nav-icon">{'\u{1F6AA}'}</span> <span className="nav-label">Logout</span>
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
              style={{ position: 'relative', fontSize: '0.9rem' }}
              title="Open Alert Hub"
            >
              {'\u26A0\uFE0F'} Alerts
              {alerts.filter(a => !a.read).length > 0 && (
                <span style={{
                  position: 'absolute', top: '-8px', right: '-8px',
                  backgroundColor: 'var(--danger)', color: 'white',
                  borderRadius: '50%', minWidth: '20px', height: '20px',
                  fontSize: '0.7rem', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 'bold'
                }}>
                  {alerts.filter(a => !a.read).length}
                </span>
              )}
            </button>
            {isAdmin && costingRequestCount > 0 && (
              <button
                onClick={() => startTransition(() => navigate('/costing-requests'))}
                className="btn"
                style={{
                  position: 'relative', fontSize: '0.9rem',
                  backgroundColor: 'var(--warning)', color: 'white',
                  border: 'none', borderRadius: '6px',
                  padding: '0.5rem 1rem', cursor: 'pointer'
                }}
                title="View costing requests"
              >
                Costing Requests
                <span style={{
                  position: 'absolute', top: '-8px', right: '-8px',
                  backgroundColor: 'var(--danger)', color: 'white',
                  borderRadius: '50%', minWidth: '20px', height: '20px',
                  fontSize: '0.7rem', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 'bold'
                }}>
                  {costingRequestCount}
                </span>
              </button>
            )}
          </div>
        </div>

        <ErrorBoundary>
          <Routes>
            <Route path="/shipping" element={
              <Suspense fallback={<PageLoader />}>
                <ShippingView
                  shipments={shipments}
                  onFileUpload={async (file) => {
                    await handleFileUpload(file, handleAddSupplier);
                    await fetchSuppliers();
                  }}
                  onUpdateShipment={handleUpdateShipment}
                  onDeleteShipment={handleDeleteShipment}
                  onCreateShipment={handleCreateShipment}
                  loading={loading}
                />
              </Suspense>
            } />
            <Route path="/dashboard" element={
              <Suspense fallback={<PageLoader />}>
                <Dashboard shipments={shipments} onOpenLiveBoard={() => setLiveBoardOpen(true)} />
              </Suspense>
            } />
            <Route path="/suppliers" element={
              <Suspense fallback={<PageLoader />}>
                <SupplierManagement
                  suppliers={suppliers}
                  shipments={shipments}
                  onAddSupplier={handleAddSupplier}
                  onUpdateSupplier={handleUpdateSupplier}
                  onDeleteSupplier={handleDeleteSupplier}
                  onImportSchedule={handleImportSchedule}
                  loading={loading}
                />
              </Suspense>
            } />
            <Route path="/workflow" element={
              <Suspense fallback={<PageLoader />}><PostArrivalWorkflow /></Suspense>
            } />
            <Route path="/capacity" element={
              <Suspense fallback={<PageLoader />}><WarehouseCapacity shipments={shipments} /></Suspense>
            } />
            <Route path="/stored" element={
              <Suspense fallback={<PageLoader />}><StoredWrapper /></Suspense>
            } />
            <Route path="/archives" element={
              <Suspense fallback={<PageLoader />}><ArchiveView /></Suspense>
            } />
            <Route path="/rates" element={
              <Suspense fallback={<PageLoader />}><RatesQuotes loading={loading} /></Suspense>
            } />
            <Route path="/costing" element={
              <Suspense fallback={<PageLoader />}><ImportCosting /></Suspense>
            } />
            <Route path="/costing-requests" element={
              <Suspense fallback={<PageLoader />}>{isAdmin ? <CostingRequests /> : <AccessDenied />}</Suspense>
            } />
            <Route path="/reports" element={
              <Suspense fallback={<PageLoader />}><ReportsView shipments={shipments} /></Suspense>
            } />
            <Route path="/advanced-reports" element={
              <Suspense fallback={<PageLoader />}><AdvancedReports /></Suspense>
            } />
            <Route path="/users" element={
              <Suspense fallback={<PageLoader />}>{isAdmin ? <UserManagement /> : <AccessDenied />}</Suspense>
            } />
            <Route path="/audit" element={
              <Suspense fallback={<PageLoader />}>{isAdmin ? <AuditLog /> : <AccessDenied />}</Suspense>
            } />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>

      {!liveBoardOpen && (
        <button
          onClick={() => setLiveBoardOpen(true)}
          title="Open Live Board"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 900,
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '2px solid rgba(5,150,105,0.5)',
            color: '#10b981', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(5,150,105,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
        >
          📡
        </button>
      )}
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
        shipments={shipments}
      />
      {settingsOpen && (
        <UserSettings
          username={username}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {notificationPrefsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'white', borderRadius: '8px' }}>
            <NotificationPreferences onClose={() => setNotificationPrefsOpen(false)} />
          </div>
        </div>
      )}
      {helpOpen && (
        <HelpGuide onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}

export default App;
