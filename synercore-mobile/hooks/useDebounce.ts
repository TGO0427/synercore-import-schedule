import { useState, useEffect } from 'react';

/**
 * useDebounce Hook
 * Debounces a value with a delay
 *
 * @param value - The value to debounce
 * @param delayMs - Debounce delay in milliseconds (default: 500)
 * @returns {T} The debounced value
 *
 * @example
 * const searchTerm = useDebounce(userInput, 300);
 * useEffect(() => {
 *   if (searchTerm) {
 *     searchAPI(searchTerm);
 *   }
 * }, [searchTerm]);
 */
export function useDebounce<T>(value: T, delayMs: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * useDebouncedCallback Hook
 * Debounces a callback function
 *
 * @param callback - The callback function to debounce
 * @param delayMs - Debounce delay in milliseconds (default: 500)
 * @returns {Function} The debounced callback
 *
 * @example
 * const handleSearch = useDebouncedCallback((query) => {
 *   api.search(query);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = 500
): T {
  const [timeout, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = ((...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    const newTimeout = setTimeout(() => {
      callback(...args);
    }, delayMs);

    setTimeoutId(newTimeout);
  }) as T;

  return debouncedCallback;
}
