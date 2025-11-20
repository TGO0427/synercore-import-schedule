/**
 * Zustand store for shipment management
 * Centralizes all shipment-related state and actions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';

/**
 * Shipment interface
 */
export interface Shipment {
  id: string;
  orderRef: string;
  supplier: string;
  quantity: number;
  latestStatus: string;
  weekNumber?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shipment store state interface
 */
export interface ShipmentState {
  // State
  shipments: Shipment[];
  loading: boolean;
  error: string | null;
  statusFilter: string | null;
  lastSyncTime: Date | null;

  // Actions - Fetch
  fetchShipments: () => Promise<void>;
  fetchShipmentsByStatus: (status: string | null) => Promise<void>;

  // Actions - CRUD
  createShipment: (shipmentData: Partial<Shipment>) => Promise<Shipment>;
  updateShipment: (id: string, updates: Partial<Shipment>) => Promise<Shipment>;
  deleteShipment: (id: string) => Promise<void>;

  // Actions - Workflow
  startUnloading: (id: string) => Promise<Shipment>;
  startInspection: (id: string) => Promise<Shipment>;
  completeInspection: (id: string, passed: boolean) => Promise<Shipment>;
  startReceiving: (id: string) => Promise<Shipment>;
  markAsStored: (id: string) => Promise<Shipment>;

  // Actions - UI State
  setStatusFilter: (status: string | null) => void;
  clearError: () => void;

  // Actions - Real-time updates
  updateShipmentFromWebSocket: (id: string, updates: Partial<Shipment>) => void;
}

/**
 * Helper function for authenticated API calls
 */
const apiCall = async (url: string, options: RequestInit = {}): Promise<any> => {
  const headers = {
    ...((options.headers as Record<string, string>) || {}),
    ...authUtils.getAuthHeader()
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Zustand store for shipment state and actions
 */
export const useShipmentStore = create<ShipmentState>(
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
            shipments: data.data || [],
            loading: false,
            lastSyncTime: new Date()
          });
        } catch (error: any) {
          set({
            error: error.message,
            loading: false
          });
        }
      },

      fetchShipmentsByStatus: async (status: string | null) => {
        set({ loading: true, error: null, statusFilter: status });
        try {
          const url = status
            ? `${getApiUrl()}/api/shipments?status=${status}`
            : `${getApiUrl()}/api/shipments`;
          const data = await apiCall(url);
          set({
            shipments: data.data || [],
            loading: false
          });
        } catch (error: any) {
          set({
            error: error.message,
            loading: false
          });
        }
      },

      // Actions - CRUD
      createShipment: async (shipmentData: Partial<Shipment>) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/shipments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shipmentData)
          });
          set((state) => ({
            shipments: [...state.shipments, data.data]
          }));
          return data.data;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateShipment: async (id: string, updates: Partial<Shipment>) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/shipments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          set((state) => ({
            shipments: state.shipments.map((s) => (s.id === id ? data.data : s))
          }));
          return data.data;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteShipment: async (id: string) => {
        set({ error: null });
        try {
          await apiCall(`${getApiUrl()}/api/shipments/${id}`, {
            method: 'DELETE'
          });
          set((state) => ({
            shipments: state.shipments.filter((s) => s.id !== id)
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // Actions - Workflow
      startUnloading: async (id: string) => {
        return get().updateShipment(id, { latestStatus: 'unloading' });
      },

      startInspection: async (id: string) => {
        return get().updateShipment(id, { latestStatus: 'inspection_in_progress' });
      },

      completeInspection: async (id: string, passed: boolean) => {
        const status = passed ? 'inspection_passed' : 'inspection_failed';
        return get().updateShipment(id, { latestStatus: status });
      },

      startReceiving: async (id: string) => {
        return get().updateShipment(id, { latestStatus: 'receiving_goods' });
      },

      markAsStored: async (id: string) => {
        return get().updateShipment(id, { latestStatus: 'stored' });
      },

      // Actions - UI State
      setStatusFilter: (status: string | null) => {
        set({ statusFilter: status });
      },

      clearError: () => {
        set({ error: null });
      },

      // Actions - Real-time updates
      updateShipmentFromWebSocket: (id: string, updates: Partial<Shipment>) => {
        set((state) => ({
          shipments: state.shipments.map((s) => (s.id === id ? { ...s, ...updates } : s))
        }));
      }
    }),
    {
      name: 'ShipmentStore'
    }
  )
);

export default useShipmentStore;
