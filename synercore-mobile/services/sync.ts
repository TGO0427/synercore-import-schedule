import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

export interface PendingAction {
  id: string;
  type: 'update_status' | 'upload_document' | 'update_profile';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
  retries: number;
}

const PENDING_ACTIONS_KEY = '@synercore_pending_actions';
const MAX_RETRIES = 5;
const SYNC_INTERVAL = 30000; // 30 seconds

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private listeners: Array<(isSyncing: boolean) => void> = [];

  async initialize(): Promise<void> {
    // Start auto-sync
    this.startAutoSync();

    // Try to sync pending actions immediately
    await this.syncPendingActions().catch(console.error);
  }

  async addPendingAction(
    type: PendingAction['type'],
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE',
    data: any
  ): Promise<PendingAction> {
    try {
      const actions = await this.getPendingActions();

      const newAction: PendingAction = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        endpoint,
        method,
        data,
        timestamp: Date.now(),
        retries: 0,
      };

      actions.push(newAction);

      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions));

      console.log('Pending action added:', newAction.id);

      return newAction;
    } catch (error) {
      console.error('Failed to add pending action:', error);
      throw error;
    }
  }

  async getPendingActions(): Promise<PendingAction[]> {
    try {
      const data = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  async removePendingAction(id: string): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const filtered = actions.filter((a) => a.id !== id);

      await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(filtered));

      console.log('Pending action removed:', id);
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }

  async syncPendingActions(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.notifyListeners(true);

    try {
      const actions = await this.getPendingActions();

      console.log(`Syncing ${actions.length} pending actions...`);

      for (const action of actions) {
        try {
          await this.executeAction(action);
          await this.removePendingAction(action.id);
          console.log(`Successfully synced action: ${action.id}`);
        } catch (error) {
          // Increment retries
          action.retries++;

          if (action.retries >= MAX_RETRIES) {
            // Remove after max retries
            await this.removePendingAction(action.id);
            console.warn(
              `Removed action ${action.id} after ${MAX_RETRIES} retries`
            );
          } else {
            // Update action with new retry count
            const allActions = await this.getPendingActions();
            const index = allActions.findIndex((a) => a.id === action.id);
            if (index !== -1) {
              allActions[index] = action;
              await AsyncStorage.setItem(
                PENDING_ACTIONS_KEY,
                JSON.stringify(allActions)
              );
            }
          }

          console.error(`Failed to sync action ${action.id}:`, error);
        }
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners(false);
    }
  }

  private async executeAction(action: PendingAction): Promise<void> {
    switch (action.type) {
      case 'update_status':
        await apiService.updateShipmentStatus(
          action.data.shipmentId,
          action.data
        );
        break;

      case 'upload_document':
        await apiService.uploadDocument(
          action.data.shipmentId,
          action.data.file
        );
        break;

      case 'update_profile':
        await apiService.updateProfile(action.data);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  startAutoSync(interval: number = SYNC_INTERVAL): void {
    if (this.syncInterval) return;

    console.log('Starting auto-sync...');

    // Sync immediately
    this.syncPendingActions().catch(console.error);

    // Then sync periodically
    this.syncInterval = setInterval(() => {
      this.syncPendingActions().catch(console.error);
    }, interval) as unknown as NodeJS.Timeout;
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  async clearAllPending(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PENDING_ACTIONS_KEY);
      console.log('All pending actions cleared');
    } catch (error) {
      console.error('Failed to clear pending actions:', error);
    }
  }

  onSyncStatusChange(callback: (isSyncing: boolean) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(isSyncing: boolean): void {
    this.listeners.forEach((listener) => {
      try {
        listener(isSyncing);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  destroy(): void {
    this.stopAutoSync();
    this.listeners = [];
  }
}

export const syncService = new SyncService();
