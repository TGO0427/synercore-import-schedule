/**
 * NotificationContainer Component Tests
 * Tests notification display and removal functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationContainer from '../NotificationContainer';

// Mock the Notification component to avoid complexity in testing
jest.mock('../Notification', () => {
  return function MockNotification({ message, type, onClose, autoClose, duration }: any) {
    return (
      <div
        data-testid={`notification-${type}`}
        style={{ pointerEvents: 'auto' }}
        data-autoclose={autoClose}
        data-duration={duration}
      >
        <span>{message}</span>
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

describe('NotificationContainer', () => {
  const mockOnRemoveNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when notifications is null', () => {
      const { container } = render(
        <NotificationContainer
          notifications={null}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when notifications array is empty', () => {
      const { container } = render(
        <NotificationContainer
          notifications={[]}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render container with correct positioning styles', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      const { container } = render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '10000',
      });
    });

    it('should render all notifications', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success message',
        },
        {
          id: 2,
          type: 'error' as const,
          message: 'Error message',
        },
        {
          id: 3,
          type: 'warning' as const,
          message: 'Warning message',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });
  });

  describe('Notification Types', () => {
    it('should render success notification', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Operation successful',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByTestId('notification-success')).toBeInTheDocument();
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
    });

    it('should render error notification', () => {
      const notifications = [
        {
          id: 1,
          type: 'error' as const,
          message: 'Operation failed',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByTestId('notification-error')).toBeInTheDocument();
      expect(screen.getByText('Operation failed')).toBeInTheDocument();
    });

    it('should render warning notification', () => {
      const notifications = [
        {
          id: 1,
          type: 'warning' as const,
          message: 'Please be careful',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByTestId('notification-warning')).toBeInTheDocument();
      expect(screen.getByText('Please be careful')).toBeInTheDocument();
    });

    it('should render info notification', () => {
      const notifications = [
        {
          id: 1,
          type: 'info' as const,
          message: 'Information message',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByTestId('notification-info')).toBeInTheDocument();
      expect(screen.getByText('Information message')).toBeInTheDocument();
    });
  });

  describe('Notification Removal', () => {
    it('should call onRemoveNotification when close button is clicked', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnRemoveNotification).toHaveBeenCalledWith(1);
    });

    it('should pass correct ID to onRemoveNotification', () => {
      const notifications = [
        {
          id: 'unique-id-1',
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(mockOnRemoveNotification).toHaveBeenCalledWith('unique-id-1');
    });

    it('should handle multiple notification removals', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success 1',
        },
        {
          id: 2,
          type: 'error' as const,
          message: 'Error 1',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[0]);
      fireEvent.click(closeButtons[1]);

      expect(mockOnRemoveNotification).toHaveBeenCalledTimes(2);
      expect(mockOnRemoveNotification).toHaveBeenCalledWith(1);
      expect(mockOnRemoveNotification).toHaveBeenCalledWith(2);
    });
  });

  describe('Auto-close Functionality', () => {
    it('should pass autoClose prop as true by default', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const notification = screen.getByTestId('notification-success');
      expect(notification).toHaveAttribute('data-autoclose', 'true');
    });

    it('should respect explicit autoClose prop', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
          autoClose: false,
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const notification = screen.getByTestId('notification-success');
      expect(notification).toHaveAttribute('data-autoclose', 'false');
    });

    it('should use custom duration when provided', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
          duration: 10000,
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const notification = screen.getByTestId('notification-success');
      expect(notification).toHaveAttribute('data-duration', '10000');
    });

    it('should use default duration when not provided', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const notification = screen.getByTestId('notification-success');
      expect(notification).toHaveAttribute('data-duration', '5000');
    });
  });

  describe('Styling and Layout', () => {
    it('should have correct z-index for stacking', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      const { container } = render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle('zIndex: 10000');
    });

    it('should set max-width for responsive design', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      const { container } = render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle('maxWidth: 400px');
    });

    it('should disable pointer events on container', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      const { container } = render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle('pointerEvents: none');
    });

    it('should enable pointer events on individual notifications', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: 'Success!',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      const notification = screen.getByTestId('notification-success');
      expect(notification).toHaveStyle('pointerEvents: auto');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large number of notifications', () => {
      const notifications = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'info' as const,
        message: `Notification ${i}`,
      }));

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByText('Notification 0')).toBeInTheDocument();
      expect(screen.getByText('Notification 49')).toBeInTheDocument();
    });

    it('should handle notifications with special characters', () => {
      const notifications = [
        {
          id: 1,
          type: 'success' as const,
          message: '✅ Success! <script>alert("XSS")</script>',
        },
      ];

      render(
        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByText('✅ Success! <script>alert("XSS")</script>')).toBeInTheDocument();
    });

    it('should handle rapid addition and removal of notifications', () => {
      const { rerender } = render(
        <NotificationContainer
          notifications={[
            {
              id: 1,
              type: 'success' as const,
              message: 'Message 1',
            },
          ]}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      rerender(
        <NotificationContainer
          notifications={[
            {
              id: 2,
              type: 'error' as const,
              message: 'Message 2',
            },
          ]}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByText('Message 2')).toBeInTheDocument();
    });
  });

  describe('Prop Changes', () => {
    it('should update when notifications prop changes', () => {
      const { rerender } = render(
        <NotificationContainer
          notifications={[
            {
              id: 1,
              type: 'success' as const,
              message: 'First',
            },
          ]}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.getByText('First')).toBeInTheDocument();

      rerender(
        <NotificationContainer
          notifications={[
            {
              id: 2,
              type: 'error' as const,
              message: 'Second',
            },
          ]}
          onRemoveNotification={mockOnRemoveNotification}
        />
      );

      expect(screen.queryByText('First')).not.toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });

    it('should call new onRemoveNotification handler after prop change', () => {
      const firstHandler = jest.fn();
      const secondHandler = jest.fn();

      const { rerender } = render(
        <NotificationContainer
          notifications={[
            {
              id: 1,
              type: 'success' as const,
              message: 'Test',
            },
          ]}
          onRemoveNotification={firstHandler}
        />
      );

      rerender(
        <NotificationContainer
          notifications={[
            {
              id: 1,
              type: 'success' as const,
              message: 'Test',
            },
          ]}
          onRemoveNotification={secondHandler}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(secondHandler).toHaveBeenCalledWith(1);
      expect(firstHandler).not.toHaveBeenCalled();
    });
  });
});
