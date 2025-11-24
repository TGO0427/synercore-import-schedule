/**
 * Zustand store for UI state management
 * Centralizes all UI-related state (modals, alerts, panels, etc.)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Alert object interface
 */
export interface Alert {
  id?: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
}

/**
 * Notification interface
 */
export interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
}

/**
 * UI store state interface
 */
export interface UIState {
  // View Management
  activeView: string;
  setActiveView: (view: string) => void;

  // Alert Hub
  alertHubOpen: boolean;
  alerts: Alert[];
  toggleAlertHub: () => void;
  openAlertHub: () => void;
  closeAlertHub: () => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (id: number) => void;
  clearAlerts: () => void;

  // User Settings
  settingsOpen: boolean;
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;

  // Help Guide
  helpOpen: boolean;
  toggleHelp: () => void;
  openHelp: () => void;
  closeHelp: () => void;

  // Notification Preferences
  notificationPrefsOpen: boolean;
  toggleNotificationPrefs: () => void;
  openNotificationPrefs: () => void;
  closeNotificationPrefs: () => void;

  // Supplier Portal
  showSupplierPortal: boolean;
  setShowSupplierPortal: (show: boolean) => void;

  // WebSocket Connection Status
  wsConnected: boolean;
  setWSConnected: (connected: boolean) => void;

  // Loading State
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Offline Indicator
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Generic Notification Toast
  notification: Notification | null;
  showNotification: (notification: Notification) => void;
  clearNotification: () => void;

  // Reset all UI state
  reset: () => void;
}

/**
 * Zustand store for UI state
 */
export const useUIStore = create<UIState>(
  devtools(
    (set) => ({
      // View Management
      activeView: 'shipping',
      setActiveView: (view: string) => set({ activeView: view }),

      // Alert Hub
      alertHubOpen: false,
      alerts: [],
      toggleAlertHub: () => set((state) => ({ alertHubOpen: !state.alertHubOpen })),
      openAlertHub: () => set({ alertHubOpen: true }),
      closeAlertHub: () => set({ alertHubOpen: false }),
      addAlert: (alert: Alert) =>
        set((state) => ({
          alerts: [...state.alerts, { ...alert, id: Date.now() }]
        })),
      removeAlert: (id: number) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id)
        })),
      clearAlerts: () => set({ alerts: [] }),

      // User Settings
      settingsOpen: false,
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),

      // Help Guide
      helpOpen: false,
      toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),
      openHelp: () => set({ helpOpen: true }),
      closeHelp: () => set({ helpOpen: false }),

      // Notification Preferences
      notificationPrefsOpen: false,
      toggleNotificationPrefs: () =>
        set((state) => ({
          notificationPrefsOpen: !state.notificationPrefsOpen
        })),
      openNotificationPrefs: () => set({ notificationPrefsOpen: true }),
      closeNotificationPrefs: () => set({ notificationPrefsOpen: false }),

      // Supplier Portal
      showSupplierPortal: false,
      setShowSupplierPortal: (show: boolean) => set({ showSupplierPortal: show }),

      // WebSocket Connection Status
      wsConnected: false,
      setWSConnected: (connected: boolean) => set({ wsConnected: connected }),

      // Loading State
      isLoading: false,
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      // Offline Indicator
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setOnline: (online: boolean) => set({ isOnline: online }),

      // Generic Notification Toast
      notification: null,
      showNotification: (notification: Notification) => set({ notification }),
      clearNotification: () => set({ notification: null }),

      // Reset all UI state
      reset: () =>
        set({
          activeView: 'shipping',
          alertHubOpen: false,
          alerts: [],
          settingsOpen: false,
          helpOpen: false,
          notificationPrefsOpen: false,
          showSupplierPortal: false,
          isLoading: false,
          notification: null
        })
    }),
    {
      name: 'UIStore'
    }
  )
);

export default useUIStore;
