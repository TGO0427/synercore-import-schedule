/**
 * AlertHub Component Tests
 * Tests alert management and filtering
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertHub from '../AlertHub';

const mockAlerts = [
  {
    id: '1',
    title: 'Critical Error',
    description: 'Database connection failed',
    severity: 'critical',
    ts: new Date('2024-01-15T10:00:00').toISOString(),
    read: false,
  },
  {
    id: '2',
    title: 'Warning: Low Storage',
    description: 'Storage capacity at 85%',
    severity: 'warning',
    ts: new Date('2024-01-15T11:00:00').toISOString(),
    read: true,
  },
  {
    id: '3',
    title: 'Info: Update Available',
    description: 'New version is available',
    severity: 'info',
    ts: new Date('2024-01-15T12:00:00').toISOString(),
    read: false,
  },
];

describe('AlertHub', () => {
  describe('Visibility', () => {
    it('should not render when open is false', () => {
      const { container } = render(
        <AlertHub open={false} alerts={mockAlerts} />
      );

      expect(container.querySelector('aside')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      const { container } = render(
        <AlertHub open={true} alerts={mockAlerts} />
      );

      expect(container.querySelector('aside')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should display "Alert Hub" title', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByText('Alert Hub')).toBeInTheDocument();
    });

    it('should show count of filtered alerts', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByText(/3 shown/)).toBeInTheDocument();
    });

    it('should have a Close button', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    it('should call onClose when Close button is clicked', () => {
      const onClose = jest.fn();
      render(<AlertHub open={true} alerts={mockAlerts} onClose={onClose} />);

      const closeBtn = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeBtn);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Search functionality', () => {
    it('should have a search input', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByPlaceholderText(/Search alerts/i)).toBeInTheDocument();
    });

    it('should filter alerts by search query', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText(/Search alerts/i);
      fireEvent.change(searchInput, { target: { value: 'Database' } });

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText(/Search alerts/i);
      fireEvent.change(searchInput, { target: { value: 'warning' } });

      expect(screen.getByText('Warning: Low Storage')).toBeInTheDocument();
    });

    it('should show "No alerts" message when search returns nothing', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const searchInput = screen.getByPlaceholderText(/Search alerts/i);
      fireEvent.change(searchInput, { target: { value: 'xyz123' } });

      expect(screen.getByText(/No alerts match your filters/i)).toBeInTheDocument();
    });
  });

  describe('Severity filtering', () => {
    it('should have severity selector', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const select = screen.getByDisplayValue('All severities');
      expect(select).toBeInTheDocument();
    });

    it('should filter by critical severity', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const select = screen.getByDisplayValue('All severities');
      fireEvent.change(select, { target: { value: 'critical' } });

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.queryByText('Warning: Low Storage')).not.toBeInTheDocument();
    });

    it('should filter by warning severity', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const select = screen.getByDisplayValue('All severities');
      fireEvent.change(select, { target: { value: 'warning' } });

      expect(screen.getByText('Warning: Low Storage')).toBeInTheDocument();
      expect(screen.queryByText('Critical Error')).not.toBeInTheDocument();
    });

    it('should filter by info severity', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const select = screen.getByDisplayValue('All severities');
      fireEvent.change(select, { target: { value: 'info' } });

      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.queryByText('Critical Error')).not.toBeInTheDocument();
    });
  });

  describe('Unread filter', () => {
    it('should have "Unread only" checkbox', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByLabelText(/Unread only/i)).toBeInTheDocument();
    });

    it('should filter to show only unread alerts', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const checkbox = screen.getByLabelText(/Unread only/i);
      fireEvent.click(checkbox);

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.queryByText('Warning: Low Storage')).not.toBeInTheDocument();
    });
  });

  describe('Alert display', () => {
    it('should display alert title', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('Warning: Low Storage')).toBeInTheDocument();
    });

    it('should display alert description', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      expect(screen.getByText('Storage capacity at 85%')).toBeInTheDocument();
    });

    it('should display alert timestamp', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const alerts = mockAlerts;
      const firstAlertTime = new Date(alerts[0].ts).toLocaleString();
      expect(screen.getByText(firstAlertTime)).toBeInTheDocument();
    });

    it('should show "Mark read" button for unread alerts', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const markReadButtons = screen.getAllByRole('button', { name: /Mark read/i });
      expect(markReadButtons.length).toBe(2); // 2 unread alerts
    });

    it('should not show "Mark read" button for read alerts', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      // The Warning alert (id: 2) is read, so it shouldn't have "Mark read"
      const articles = screen.getAllByRole('article');
      const warningArticle = articles.find(
        article => article.textContent.includes('Low Storage')
      );

      expect(warningArticle.querySelector('button[style*="0ea5e9"]')).not.toBeInTheDocument();
    });

    it('should have Dismiss button for all alerts', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
      expect(dismissButtons.length).toBe(3); // One for each alert
    });
  });

  describe('Alert actions', () => {
    it('should call onMarkRead when "Mark read" button is clicked', () => {
      const onMarkRead = jest.fn();
      render(
        <AlertHub open={true} alerts={mockAlerts} onMarkRead={onMarkRead} />
      );

      const markReadButtons = screen.getAllByRole('button', { name: /Mark read/i });
      fireEvent.click(markReadButtons[0]);

      expect(onMarkRead).toHaveBeenCalledWith('1');
    });

    it('should call onDismiss when "Dismiss" button is clicked', () => {
      const onDismiss = jest.fn();
      render(
        <AlertHub open={true} alerts={mockAlerts} onDismiss={onDismiss} />
      );

      const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
      fireEvent.click(dismissButtons[0]);

      expect(onDismiss).toHaveBeenCalledWith('1');
    });
  });

  describe('Empty state', () => {
    it('should show "No alerts" message when alerts array is empty', () => {
      render(<AlertHub open={true} alerts={[]} />);

      expect(screen.getByText(/No alerts match your filters/i)).toBeInTheDocument();
    });

    it('should show count as 0 when alerts array is empty', () => {
      render(<AlertHub open={true} alerts={[]} />);

      expect(screen.getByText(/0 shown/)).toBeInTheDocument();
    });
  });

  describe('Alert ordering', () => {
    it('should order alerts by severity (critical first)', () => {
      render(<AlertHub open={true} alerts={mockAlerts} />);

      const articles = screen.getAllByRole('article');
      const firstAlert = articles[0].textContent;
      const secondAlert = articles[1].textContent;

      expect(firstAlert).toContain('Critical Error');
      expect(secondAlert).toContain('Warning');
    });
  });
});
