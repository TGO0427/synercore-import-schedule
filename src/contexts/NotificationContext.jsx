import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import NotificationContainer from '../components/NotificationContainer';
import ConfirmationModal from '../components/ConfirmationModal';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const confirmResolveRef = useRef(null);

  const addNotification = useCallback((type, message, options = {}) => {
    setNotifications(prev => [
      ...prev,
      { id: Date.now() + Math.random(), type, message, ...options }
    ]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showSuccess = useCallback((m, o = {}) => addNotification('success', m, o), [addNotification]);
  const showError   = useCallback((m, o = {}) => addNotification('error', m, o), [addNotification]);
  const showWarning = useCallback((m, o = {}) => addNotification('warning', m, o), [addNotification]);
  const showInfo    = useCallback((m, o = {}) => addNotification('info', m, o), [addNotification]);

  const confirm = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'default',
  } = {}) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmation({ title, message, confirmText, cancelText, type });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmResolveRef.current?.(true);
    confirmResolveRef.current = null;
    setConfirmation(null);
  }, []);

  const handleCancel = useCallback(() => {
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
    setConfirmation(null);
  }, []);

  const value = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    confirm,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemoveNotification={removeNotification}
      />
      {confirmation && (
        <ConfirmationModal
          title={confirmation.title}
          message={confirmation.message}
          confirmText={confirmation.confirmText}
          cancelText={confirmation.cancelText}
          type={confirmation.type}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
