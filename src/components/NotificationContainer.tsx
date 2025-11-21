import React from 'react';
import Notification from './Notification';

interface NotificationItem {
  id: string | number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationContainerProps {
  notifications: NotificationItem[] | null;
  onRemoveNotification: (id: string | number) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onRemoveNotification }) => {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        maxWidth: '400px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          style={{ pointerEvents: 'auto' }}
        >
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => onRemoveNotification(notification.id)}
            autoClose={notification.autoClose !== false}
            duration={notification.duration || 5000}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
