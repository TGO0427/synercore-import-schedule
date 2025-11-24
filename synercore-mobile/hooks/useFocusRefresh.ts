import { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * useFocusRefresh Hook
 * Execute a callback when the screen is focused
 *
 * @param callback - Function to execute when screen is focused
 *
 * @example
 * useFocusRefresh(() => {
 *   refetchData();
 * });
 */
export function useFocusRefresh(callback: () => void | Promise<void>): void {
  useFocusEffect(() => {
    callback();
  });
}

/**
 * useFocusRefreshInterval Hook
 * Execute a callback at regular intervals when the screen is focused
 *
 * @param callback - Function to execute at each interval
 * @param interval - Interval in milliseconds (default: 5000)
 *
 * @example
 * useFocusRefreshInterval(() => {
 *   refetchData();
 * }, 3000);
 */
export function useFocusRefreshInterval(
  callback: () => void | Promise<void>,
  interval: number = 5000
): void {
  useFocusEffect(() => {
    // Call immediately on focus
    callback();

    // Set up interval
    const timer = setInterval(() => {
      callback();
    }, interval);

    // Cleanup
    return () => {
      clearInterval(timer);
    };
  });
}
