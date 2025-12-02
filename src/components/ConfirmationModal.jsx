import React, { useState, useEffect } from 'react';
import { notificationSounds } from '../utils/notificationSounds';

const ConfirmationModal = ({
  title = 'Confirm Action',
  message = 'Are you sure?',
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default', // 'default', 'warning', 'danger', 'success'
  autoClose = false,
  duration = 30000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Play confirmation sound on mount
    const playSound = async () => {
      try {
        // Use warning sound for confirmation dialogs
        await notificationSounds.playWarning();
      } catch (error) {
        console.warn('Could not play confirmation sound:', error);
      }
    };

    playSound();

    if (autoClose) {
      const timer = setTimeout(() => {
        handleCancel();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration]);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(() => {
      onConfirm?.();
    }, 300);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => {
      onCancel?.();
    }, 300);
  };

  const getModalStyles = () => {
    const baseStyles = {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50000,
      backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
      backdropFilter: isVisible ? 'blur(2px)' : 'blur(0px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    return baseStyles;
  };

  const getContentStyles = () => {
    const baseStyles = {
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      padding: '2rem',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'auto',
      transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      border: '2px solid',
    };

    switch (type) {
      case 'danger':
        return {
          ...baseStyles,
          borderColor: '#ef4444',
          backgroundColor: '#fef2f2',
        };
      case 'warning':
        return {
          ...baseStyles,
          borderColor: '#f59e0b',
          backgroundColor: '#fffbeb',
        };
      case 'success':
        return {
          ...baseStyles,
          borderColor: '#10b981',
          backgroundColor: '#f0fdf4',
        };
      default:
        return {
          ...baseStyles,
          borderColor: '#e5e7eb',
        };
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case 'danger': return '#7f1d1d';
      case 'warning': return '#78350f';
      case 'success': return '#065f46';
      default: return '#1f2937';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      default: return '#3b82f6';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger': return '⚠️';
      case 'warning': return '❗';
      case 'success': return '✓';
      default: return 'ℹ️';
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      default: return '#3b82f6';
    }
  };

  return (
    <div style={getModalStyles()}>
      <div style={getContentStyles()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: `${getIconColor()}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            {getIcon()}
          </div>

          <div style={{ flex: 1 }}>
            <h2
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '20px',
                fontWeight: '700',
                color: getTitleColor(),
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                lineHeight: '1.6',
                color: '#666',
                whiteSpace: 'pre-wrap',
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            marginTop: '2rem',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={handleConfirm}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: getConfirmButtonColor(),
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = '0.9';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '1';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
