/**
 * Zustand store for UI state management
 * Centralizes all UI-related state (modals, alerts, panels, etc.)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Zustand store for UI state
 */
export const useUIStore = create(
  devtools(
    (set) => ({
      // View Management
      activeView: 'shipping', // 'shipping', 'products', 'archive', 'reports', 'warehouse', 'suppliers', etc.
      setActiveView: (view) => set({ activeView: view }),

      // Alert Hub
      alertHubOpen: false,
      alerts: [],
      toggleAlertHub: () => set((state) => ({ alertHubOpen: !state.alertHubOpen })),
      openAlertHub: () => set({ alertHubOpen: true }),
      closeAlertHub: () => set({ alertHubOpen: false }),
      addAlert: (alert) =>
        set((state) => ({
          alerts: [...state.alerts, { ...alert, id: Date.now() }],
        })),
      removeAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
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
          notificationPrefsOpen: !state.notificationPrefsOpen,
        })),
      openNotificationPrefs: () => set({ notificationPrefsOpen: true }),
      closeNotificationPrefs: () => set({ notificationPrefsOpen: false }),

      // Supplier Portal
      showSupplierPortal: false,
      setShowSupplierPortal: (show) => set({ showSupplierPortal: show }),

      // WebSocket Connection Status
      wsConnected: false,
      setWSConnected: (connected) => set({ wsConnected: connected }),

      // Loading State
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),

      // Offline Indicator
      isOnline: navigator.onLine,
      setOnline: (online) => set({ isOnline: online }),

      // Generic Notification Toast
      notification: null,
      showNotification: (notification) => set({ notification }),
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
          notification: null,
        }),
    }),
    {
      name: 'UIStore',
    }
  )
);

export default useUIStore;
