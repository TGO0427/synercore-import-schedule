/**
 * Zustand store for supplier management
 * Centralizes all supplier-related state and actions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';

/**
 * Supplier interface
 */
export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  contactPerson?: string;
  paymentTerms?: string;
  performanceRating?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier store state interface
 */
export interface SupplierState {
  // State
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;

  // Actions - Fetch
  fetchSuppliers: () => Promise<void>;

  // Actions - CRUD
  createSupplier: (supplierData: Partial<Supplier>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;

  // Actions - UI State
  clearError: () => void;
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
 * Zustand store for supplier state and actions
 */
export const useSupplierStore = create<SupplierState>(
  devtools(
    (set) => ({
      // State
      suppliers: [],
      loading: false,
      error: null,

      // Actions - Fetch
      fetchSuppliers: async () => {
        set({ loading: true, error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/suppliers`);
          set({
            suppliers: data.data || [],
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
      createSupplier: async (supplierData: Partial<Supplier>) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supplierData)
          });
          set((state) => ({
            suppliers: [...state.suppliers, data.data]
          }));
          return data.data;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      updateSupplier: async (id: string, updates: Partial<Supplier>) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/suppliers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          set((state) => ({
            suppliers: state.suppliers.map((s) => (s.id === id ? data.data : s))
          }));
          return data.data;
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteSupplier: async (id: string) => {
        set({ error: null });
        try {
          await apiCall(`${getApiUrl()}/api/suppliers/${id}`, {
            method: 'DELETE'
          });
          set((state) => ({
            suppliers: state.suppliers.filter((s) => s.id !== id)
          }));
        } catch (error: any) {
          set({ error: error.message });
          throw error;
        }
      },

      // Actions - UI State
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'SupplierStore'
    }
  )
);

export default useSupplierStore;
