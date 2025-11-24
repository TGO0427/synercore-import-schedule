/**
 * Zustand store for shipment management
 * Centralizes all shipment-related state and actions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';

/**
 * Helper function for authenticated API calls
 */
const apiCall = async (url, options = {}) => {
  const headers = {
    ...options.headers,
    ...authUtils.getAuthHeader(),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Zustand store for shipment state and actions
 */
export const useShipmentStore = create(
  devtools(
    (set, get) => ({
      // State
      shipments: [],
      loading: false,
      error: null,
      statusFilter: null,
      lastSyncTime: null,

      // Actions - Fetch
      fetchShipments: async () => {
        set({ loading: true, error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/shipments`);
          set({
            shipments: data,
            loading: false,
            lastSyncTime: new Date(),
          });
        } catch (error) {
          set({
            error: error.message,
            loading: false,
          });
        }
      },

      fetchShipmentsByStatus: async (status) => {
        set({ loading: true, error: null, statusFilter: status });
        try {
          const url = status
            ? `${getApiUrl()}/api/shipments/status/${status}`
            : `${getApiUrl()}/api/shipments`;
          const data = await apiCall(url);
          set({
            shipments: data,
            loading: false,
          });
        } catch (error) {
          set({
            error: error.message,
            loading: false,
          });
        }
      },

      // Actions - CRUD
      createShipment: async (shipmentData) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/shipments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shipmentData),
          });
          set((state) => ({
            shipments: [...state.shipments, data],
          }));
          return data;
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      updateShipment: async (id, updates) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/shipments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          set((state) => ({
            shipments: state.shipments.map((s) => (s.id === id ? data : s)),
          }));
          return data;
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteShipment: async (id) => {
        set({ error: null });
        try {
          await apiCall(`${getApiUrl()}/api/shipments/${id}`, {
            method: 'DELETE',
          });
          set((state) => ({
            shipments: state.shipments.filter((s) => s.id !== id),
          }));
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      // Actions - Workflow
      startUnloading: async (id) => {
        return get().updateShipment(id, { latestStatus: 'unloading' });
      },

      startInspection: async (id) => {
        return get().updateShipment(id, { latestStatus: 'inspecting' });
      },

      completeInspection: async (id, passed) => {
        const status = passed ? 'inspection_passed' : 'inspection_failed';
        return get().updateShipment(id, { latestStatus: status });
      },

      startReceiving: async (id) => {
        return get().updateShipment(id, { latestStatus: 'receiving' });
      },

      markAsStored: async (id) => {
        return get().updateShipment(id, { latestStatus: 'stored' });
      },

      // Actions - UI State
      setStatusFilter: (status) => {
        set({ statusFilter: status });
      },

      clearError: () => {
        set({ error: null });
      },

      // Actions - Real-time updates
      updateShipmentFromWebSocket: (id, updates) => {
        set((state) => ({
          shipments: state.shipments.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },
    }),
    {
      name: 'ShipmentStore',
    }
  )
);

export default useShipmentStore;
