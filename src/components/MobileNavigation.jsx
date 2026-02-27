import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VIEW_ROUTES } from '../routes';
import { useNotification } from '../contexts/NotificationContext';
import './MobileNavigation.css';

/**
 * Mobile Navigation Component
 *
 * Features:
 * - Hamburger menu for mobile (< 768px)
 * - Bottom tab navigation for quick access
 * - Responsive and touch-friendly
 * - Active state tracking via URL
 * - Sidebar menu for full navigation
 */

export function MobileNavigation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isNavigationBlocked, confirm } = useNotification();

  const navItems = [
    { id: 'shipping', label: 'Shipments', icon: '\u{1F4E6}' },
    { id: 'reports', label: 'Reports', icon: '\u{1F4C8}' },
    { id: 'stored', label: 'Warehouse', icon: '\u{1F3EA}' },
    { id: 'suppliers', label: 'Suppliers', icon: '\u{1F3E2}' },
    { id: 'dashboard', label: 'Dashboard', icon: '\u{1F4CA}' }
  ];

  const activeView = Object.entries(VIEW_ROUTES).find(
    ([, path]) => location.pathname === path
  )?.[0] || 'shipping';

  const handleNavigation = (viewId) => {
    const route = VIEW_ROUTES[viewId] || '/shipping';
    if (isNavigationBlocked()) {
      confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes that will be lost. Are you sure you want to leave this page?',
        confirmText: 'Leave',
        cancelText: 'Stay',
        type: 'warning',
      }).then((confirmed) => {
        if (confirmed) {
          navigate(route);
          setSidebarOpen(false);
        }
      });
    } else {
      navigate(route);
      setSidebarOpen(false);
    }
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
          <button className="header-icon-btn" aria-label="Notifications">
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
          <button className="nav-link logout-btn">
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
}

/**
 * Mobile Header Component
 * Standalone header that can be used in different contexts
 */
export function MobileHeader({ title, onMenuClick, actions }) {
  return (
    <header className="mobile-header">
      <button
        className="menu-btn"
        onClick={onMenuClick}
        aria-label="Toggle navigation menu"
      >
        {'\u2630'}
      </button>
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        {actions?.map((action, idx) => (
          <button
            key={idx}
            className="header-icon-btn"
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </header>
  );
}

/**
 * Bottom Tab Navigation Component
 * Standalone for flexible usage
 */
export function BottomTabNavigation({ items, activeItem, onItemClick }) {
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`bottom-nav-item ${activeItem === item.id ? 'active' : ''}`}
          onClick={() => onItemClick(item.id)}
          aria-label={item.label}
          aria-current={activeItem === item.id ? 'page' : undefined}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * Sidebar Navigation Component
 * Standalone for flexible usage
 */
export function SidebarNavigation({ items, activeItem, onItemClick, isOpen, onClose }) {
  return (
    <>
      <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            {'\u2715'}
          </button>
        </div>

        <div className="nav-items">
          {items.map(item => (
            <button
              key={item.id}
              className={`nav-link ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => {
                onItemClick(item.id);
                onClose();
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {items.logoutBtn && (
          <div className="sidebar-footer">
            <button className="nav-link logout-btn" onClick={items.logoutBtn.onClick}>
              <span className="nav-icon">{items.logoutBtn.icon}</span>
              <span className="nav-label">{items.logoutBtn.label}</span>
            </button>
          </div>
        )}
      </nav>

      {isOpen && (
        <div
          className="sidebar-overlay open"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}

export default MobileNavigation;
