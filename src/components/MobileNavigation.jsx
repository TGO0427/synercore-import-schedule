import React, { useState } from 'react';
import './MobileNavigation.css';

/**
 * Mobile Navigation Component
 *
 * Features:
 * - Hamburger menu for mobile (< 768px)
 * - Bottom tab navigation for quick access
 * - Responsive and touch-friendly
 * - Active state tracking
 * - Sidebar menu for full navigation
 */

export function MobileNavigation({ activeView, onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'shipping', label: 'Shipments', icon: '📦' },
    { id: 'products', label: 'Products', icon: '📊' },
    { id: 'warehouse', label: 'Warehouse', icon: '🏪' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'admin', label: 'Admin', icon: '⚙️' }
  ];

  const handleNavigation = (viewId) => {
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
          <button className="header-icon-btn" aria-label="Notifications">
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
          <button className="nav-link logout-btn">
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
        ☰
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
            ✕
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
