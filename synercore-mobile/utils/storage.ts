import { Platform } from 'react-native';

/**
 * Cross-platform storage abstraction
 * Uses AsyncStorage on mobile, localStorage on web
 */

let AsyncStorageModule: any = null;

// Lazy load AsyncStorage only on mobile
if (Platform.OS !== 'web') {
  try {
    AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('AsyncStorage not available');
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else if (AsyncStorageModule) {
        return await AsyncStorageModule.getItem(key);
      }
      return null;
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else if (AsyncStorageModule) {
        await AsyncStorageModule.setItem(key, value);
      }
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else if (AsyncStorageModule) {
        await AsyncStorageModule.removeItem(key);
      }
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
    }
  },

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.clear();
      } else if (AsyncStorageModule) {
        await AsyncStorageModule.clear();
      }
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },
};
