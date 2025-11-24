import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isOnline: boolean;
  type: string;
}

/**
 * useNetworkStatus Hook
 * Monitor network connectivity status
 *
 * @returns {NetworkStatus} Current network status
 *
 * @example
 * const { isOnline, type } = useNetworkStatus();
 *
 * useEffect(() => {
 *   if (!isOnline) {
 *     showOfflineBanner();
 *   }
 * }, [isOnline]);
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true,
    type: 'unknown',
  });

  useEffect(() => {
    // For web platform
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setNetworkStatus({ isOnline: true, type: 'online' });
      };

      const handleOffline = () => {
        setNetworkStatus({ isOnline: false, type: 'offline' });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Set initial status
      setNetworkStatus({
        isOnline: navigator.onLine,
        type: navigator.onLine ? 'online' : 'offline',
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // For native platforms, we would use @react-native-community/netinfo
    // For now, assume always online
    setNetworkStatus({ isOnline: true, type: 'wifi' });

    return () => {};
  }, []);

  return networkStatus;
}
