import { authService } from './auth';
import { notificationService } from './notifications';
import { syncService } from './sync';

/**
 * Initialize the app - set up all services and load persisted data
 */
export async function initializeApp(): Promise<void> {
  try {
    console.log('🚀 Initializing app...');

    // 1. Initialize authentication
    console.log('📌 Initializing auth service...');
    await authService.initialize();
    console.log('✅ Auth initialized');

    // 2. Setup notifications
    console.log('📌 Setting up notifications...');
    notificationService.setupNotificationListeners();

    const permissionGranted = await notificationService.requestPermissions();

    if (permissionGranted) {
      const token = await notificationService.registerDeviceToken();
      if (token) {
        console.log('✅ Device token registered');
      }
    } else {
      console.warn('⚠️ Notification permissions not granted');
    }

    // 3. Initialize sync service
    console.log('📌 Initializing sync service...');
    await syncService.initialize();
    console.log('✅ Sync service initialized');

    // 4. Sync pending actions
    console.log('📌 Syncing pending actions...');
    await syncService.syncPendingActions();
    console.log('✅ Pending actions synced');

    console.log('✨ App initialization complete!');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    // Don't throw - allow app to start even if initialization fails
  }
}

/**
 * Clean up services on app shutdown
 */
export function cleanupApp(): void {
  try {
    console.log('🛑 Cleaning up services...');
    syncService.destroy();
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

/**
 * Export all services for convenience
 */
export { authService, notificationService, syncService };
