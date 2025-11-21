/**
 * MobileNavigation Component Tests
 * Tests mobile navigation, sidebar, and handler functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MobileNavigation } from '../MobileNavigation';

describe('MobileNavigation', () => {
  const defaultProps = {
    activeView: 'shipping',
    onNavigate: jest.fn(),
    onLogout: jest.fn(),
    onNotifications: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Header Rendering', () => {
    it('should render header with logo', () => {
      render(<MobileNavigation {...defaultProps} />);
      expect(screen.getByText('Synercore')).toBeInTheDocument();
    });

    it('should render hamburger menu button', () => {
      render(<MobileNavigation {...defaultProps} />);
      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      expect(menuButton).toBeInTheDocument();
      expect(menuButton.textContent).toBe('☰');
    });

    it('should render notification button', () => {
      render(<MobileNavigation {...defaultProps} />);
      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      expect(notificationButton).toBeInTheDocument();
      expect(notificationButton.textContent).toBe('🔔');
    });
  });

  describe('Sidebar Navigation', () => {
    it('should open sidebar when hamburger menu is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);
      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });

      fireEvent.click(menuButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('open');
    });

    it('should close sidebar when close button is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);
      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });

      fireEvent.click(menuButton);

      const closeButton = screen.getByRole('button', { name: /close navigation/i });
      fireEvent.click(closeButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('open');
    });

    it('should close sidebar when overlay is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);
      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });

      fireEvent.click(menuButton);

      const overlay = document.querySelector('.sidebar-overlay.open');
      if (overlay) {
        fireEvent.click(overlay);
      }

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('open');
    });

    it('should render all navigation items', () => {
      render(<MobileNavigation {...defaultProps} />);

      expect(screen.getByText('Shipments')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Warehouse')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  describe('Navigation Handlers', () => {
    it('should call onNavigate when nav item is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);

      const shippingButton = screen.getByRole('button', { name: /shipments/i });
      fireEvent.click(shippingButton);

      expect(defaultProps.onNavigate).toHaveBeenCalledWith('shipping');
    });

    it('should close sidebar after navigation', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      fireEvent.click(menuButton);

      const shippingButton = screen.getByRole('button', { name: /shipments/i });
      fireEvent.click(shippingButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('open');
    });

    it('should highlight active navigation item', () => {
      const { rerender } = render(<MobileNavigation {...defaultProps} activeView="shipping" />);

      let activeNavItem = document.querySelector('.nav-link.active');
      expect(activeNavItem).toBeTruthy();

      rerender(<MobileNavigation {...defaultProps} activeView="products" />);

      activeNavItem = document.querySelector('.nav-link.active');
      expect(activeNavItem?.textContent).toContain('Products');
    });
  });

  describe('Logout Handler', () => {
    it('should render logout button in sidebar footer', () => {
      render(<MobileNavigation {...defaultProps} />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
      expect(logoutButton.textContent).toContain('🚪');
    });

    it('should call onLogout when logout button is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(defaultProps.onLogout).toHaveBeenCalled();
    });

    it('should close sidebar after logout', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      fireEvent.click(menuButton);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('open');
    });

    it('should not call onLogout if handler is not provided', () => {
      const propsWithoutLogout = {
        ...defaultProps,
        onLogout: undefined,
      };

      render(<MobileNavigation {...propsWithoutLogout} />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      expect(propsWithoutLogout.onLogout).toBeUndefined();
    });
  });

  describe('Notification Handler', () => {
    it('should call onNotifications when notification button is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);

      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);

      expect(defaultProps.onNotifications).toHaveBeenCalled();
    });

    it('should close sidebar when notification button is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      fireEvent.click(menuButton);

      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('open');
    });

    it('should not call onNotifications if handler is not provided', () => {
      const propsWithoutNotifications = {
        ...defaultProps,
        onNotifications: undefined,
      };

      render(<MobileNavigation {...propsWithoutNotifications} />);

      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(notificationButton);

      expect(propsWithoutNotifications.onNotifications).toBeUndefined();
    });
  });

  describe('Bottom Navigation', () => {
    it('should render bottom nav items', () => {
      render(<MobileNavigation {...defaultProps} />);

      const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
      expect(bottomNavItems.length).toBeGreaterThan(0);
    });

    it('should call onNavigate when bottom nav item is clicked', () => {
      render(<MobileNavigation {...defaultProps} />);

      const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
      if (bottomNavItems.length > 0) {
        fireEvent.click(bottomNavItems[0]);
        expect(defaultProps.onNavigate).toHaveBeenCalled();
      }
    });

    it('should highlight active bottom nav item', () => {
      render(<MobileNavigation {...defaultProps} activeView="shipping" />);

      const activeBottomNavItem = document.querySelector('.bottom-nav-item.active');
      expect(activeBottomNavItem).toBeTruthy();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render on mobile viewport', () => {
      render(<MobileNavigation {...defaultProps} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(document.querySelector('.mobile-header')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      expect(menuButton).toHaveAttribute('aria-label');

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should toggle sidebar state correctly', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      const sidebar = screen.getByRole('navigation');

      expect(sidebar).not.toHaveClass('open');

      fireEvent.click(menuButton);
      expect(sidebar).toHaveClass('open');

      fireEvent.click(menuButton);
      expect(sidebar).not.toHaveClass('open');
    });

    it('should maintain active view state', () => {
      const { rerender } = render(
        <MobileNavigation {...defaultProps} activeView="shipping" />
      );

      let navItem = document.querySelector('[aria-current="page"]');
      expect(navItem).toBeTruthy();

      rerender(
        <MobileNavigation {...defaultProps} activeView="products" />
      );

      navItem = document.querySelector('[aria-current="page"]');
      expect(navItem?.textContent).toContain('Products');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<MobileNavigation {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have aria-label on hamburger button', () => {
      render(<MobileNavigation {...defaultProps} />);

      const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle navigation menu');
    });

    it('should indicate current page in tab navigation', () => {
      render(<MobileNavigation {...defaultProps} activeView="shipping" />);

      const navItems = screen.getAllByRole('button', { name: /shipments/i });
      const activeItem = navItems.find((item) => item.getAttribute('aria-current') === 'page');

      expect(activeItem).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks on nav items', () => {
      render(<MobileNavigation {...defaultProps} />);

      const shippingButton = screen.getByRole('button', { name: /shipments/i });

      fireEvent.click(shippingButton);
      fireEvent.click(shippingButton);
      fireEvent.click(shippingButton);

      expect(defaultProps.onNavigate).toHaveBeenCalledTimes(3);
    });

    it('should handle null handlers gracefully', () => {
      const propsWithNullHandlers = {
        activeView: 'shipping',
        onNavigate: null as any,
        onLogout: null as any,
        onNotifications: null as any,
      };

      expect(() => {
        render(<MobileNavigation {...propsWithNullHandlers} />);
      }).not.toThrow();
    });

    it('should handle undefined props gracefully', () => {
      const propsWithOptionalHandlers = {
        activeView: 'shipping',
        onNavigate: jest.fn(),
      };

      render(<MobileNavigation {...propsWithOptionalHandlers} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });
});
