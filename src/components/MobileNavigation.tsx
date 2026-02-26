import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VIEW_ROUTES } from '../routes';
import './MobileNavigation.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface MobileNavigationProps {
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
 * - Active state tracking via URL
 * - Sidebar menu for full navigation
 * - Logout and notification handlers
 */

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onLogout,
  onNotifications
}) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { id: 'shipping', label: 'Shipments', icon: '\u{1F4E6}' },
    { id: 'reports', label: 'Reports', icon: '\u{1F4C8}' },
    { id: 'stored', label: 'Warehouse', icon: '\u{1F3EA}' },
    { id: 'suppliers', label: 'Suppliers', icon: '\u{1F3E2}' },
    { id: 'dashboard', label: 'Dashboard', icon: '\u{1F4CA}' }
  ];

  const activeView = Object.entries(VIEW_ROUTES).find(
    ([, path]) => location.pathname === path
  )?.[0] || 'shipping';

  const handleNavigation = (viewId: string): void => {
    navigate((VIEW_ROUTES as Record<string, string>)[viewId] || '/shipping');
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
          {'\u2630'}
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
            {'\u{1F514}'}
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
            {'\u2715'}
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
            <span className="nav-icon">{'\u{1F6AA}'}</span>
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
