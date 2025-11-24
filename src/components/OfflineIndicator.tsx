// src/components/OfflineIndicator.tsx
import React, { useState, useEffect } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const OfflineIndicator: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show when offline or disconnected
  if (isOnline && isConnected) {
    return null;
  }

  const isNetworkOffline = !isOnline;
  const isWebSocketOffline = isOnline && !isConnected;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: isNetworkOffline ? '#dc3545' : '#ff9800',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '4px',
      fontSize: '0.9rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
      <div>
        {isNetworkOffline ? (
          <div>
            <div style={{ fontWeight: 'bold' }}>You are offline</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Reconnecting...</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 'bold' }}>Real-time sync unavailable</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Using polling mode</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
