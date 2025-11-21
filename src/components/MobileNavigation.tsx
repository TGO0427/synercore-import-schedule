import React, { useState } from 'react';
import './MobileNavigation.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface MobileNavigationProps {
  activeView: string;
  onNavigate: (viewId: string) => void;
  onLogout?: () => void;
  onNotifications?: () => void;
}

/**
 * Mobile Navigation Component
 *
 * Features:
 * - Hamburger menu for mobile (< 768px)
 * - Bottom tab navigation for quick access
 * - Responsive and touch-friendly
 * - Active state tracking
 * - Sidebar menu for full navigation
 * - Logout and notification handlers
 */

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeView,
  onNavigate,
  onLogout,
  onNotifications
}) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const navItems: NavItem[] = [
    { id: 'shipping', label: 'Shipments', icon: '📦' },
    { id: 'products', label: 'Products', icon: '📊' },
    { id: 'warehouse', label: 'Warehouse', icon: '🏪' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'admin', label: 'Admin', icon: '⚙️' }
  ];

  const handleNavigation = (viewId: string): void => {
    onNavigate(viewId);
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="mobile-header">
        <button
          className="menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <h1 className="header-title">Synercore</h1>
        <div className="header-actions">
          <button
            className="header-icon-btn"
            aria-label="Notifications"
            onClick={() => {
              onNotifications?.();
              setSidebarOpen(false);
            }}
            title="View notifications"
          >
            🔔
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        <div className="nav-items">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${activeView === item.id ? 'active' : ''}`}
              onClick={() => handleNavigation(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className="nav-link logout-btn"
            onClick={() => {
              onLogout?.();
              setSidebarOpen(false);
            }}
            title="Logout from your account"
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay open"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Tab Navigation (Mobile Only) */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => handleNavigation(item.id)}
            aria-label={item.label}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default MobileNavigation;
