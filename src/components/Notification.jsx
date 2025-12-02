import React, { useEffect, useState } from 'react';
import { notificationSounds } from '../utils/notificationSounds';

const Notification = ({ type, message, onClose, autoClose = true, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Play sound when notification appears
    const playNotificationSound = async () => {
      switch (type) {
        case 'success':
          await notificationSounds.playSuccess();
          break;
        case 'error':
          await notificationSounds.playError();
          break;
        case 'warning':
          await notificationSounds.playWarning();
          break;
        case 'info':
        default:
          await notificationSounds.playInfo();
          break;
      }
    };

    playNotificationSound();

    if (autoClose) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / duration) * 50;
          return Math.max(0, newProgress);
        });
      }, 50);

      const timeout = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [type, autoClose, duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Wait for animation
  };

  const getNotificationStyles = () => {
    const baseStyles = {
      position: 'relative',
      padding: '16px 20px 16px 60px',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
      backdropFilter: 'blur(10px)',
      border: '2px solid',
      marginBottom: '12px',
      minHeight: '64px',
      display: 'flex',
      alignItems: 'center',
      transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(400px) scale(0.95)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      overflow: 'hidden',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontWeight: '600',
      fontSize: '15px',
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          backgroundColor: '#f0fdf4',
          borderColor: '#10b981',
          color: '#065f46',
        };
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: '#fef2f2',
          borderColor: '#ef4444',
          color: '#7f1d1d',
        };
      case 'warning':
        return {
          ...baseStyles,
          backgroundColor: '#fffbeb',
          borderColor: '#f59e0b',
          color: '#78350f',
        };
      case 'info':
      default:
        return {
          ...baseStyles,
          backgroundColor: '#eff6ff',
          borderColor: '#3b82f6',
          color: '#1e3a8a',
        };
    }
  };

  const getIconStyles = () => ({
    position: 'absolute',
    left: '18px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    flexShrink: 0,
  });

  const getIcon = () => {
    const iconStyle = getIconStyles();
    
    switch (type) {
      case 'success':
        return (
          <div style={{ 
            ...iconStyle, 
            backgroundColor: '#10b981', 
            color: 'white' 
          }}>
            ✓
          </div>
        );
      case 'error':
        return (
          <div style={{ 
            ...iconStyle, 
            backgroundColor: '#ef4444', 
            color: 'white' 
          }}>
            ✕
          </div>
        );
      case 'warning':
        return (
          <div style={{ 
            ...iconStyle, 
            backgroundColor: '#f59e0b', 
            color: 'white' 
          }}>
            !
          </div>
        );
      case 'info':
      default:
        return (
          <div style={{ 
            ...iconStyle, 
            backgroundColor: '#3b82f6', 
            color: 'white' 
          }}>
            i
          </div>
        );
    }
  };

  const getProgressBarColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info':
      default: return '#3b82f6';
    }
  };

  return (
    <div style={getNotificationStyles()}>
      {getIcon()}

      <div style={{
        flex: 1,
        fontSize: '15px',
        lineHeight: '1.4',
        fontWeight: '600',
        marginLeft: '4px'
      }}>
        {message}
      </div>
      
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.7,
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.target.style.opacity = '1';
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.opacity = '0.7';
          e.target.style.backgroundColor = 'transparent';
        }}
        title="Close notification"
      >
        ×
      </button>

      {autoClose && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '4px',
            backgroundColor: getProgressBarColor(),
            width: `${progress}%`,
            transition: 'width 0.05s linear',
            borderRadius: '0 0 10px 0',
            boxShadow: `0 -2px 8px rgba(0, 0, 0, 0.1)`,
          }}
        />
      )}
    </div>
  );
};

export default Notification;