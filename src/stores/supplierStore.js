/**
 * Zustand store for supplier management
 * Centralizes all supplier-related state and actions
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
 * Zustand store for supplier state and actions
 */
export const useSupplierStore = create(
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
            suppliers: data,
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
      createSupplier: async (supplierData) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/suppliers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supplierData),
          });
          set((state) => ({
            suppliers: [...state.suppliers, data],
          }));
          return data;
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      updateSupplier: async (id, updates) => {
        set({ error: null });
        try {
          const data = await apiCall(`${getApiUrl()}/api/suppliers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          set((state) => ({
            suppliers: state.suppliers.map((s) => (s.id === id ? data : s)),
          }));
          return data;
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      deleteSupplier: async (id) => {
        set({ error: null });
        try {
          await apiCall(`${getApiUrl()}/api/suppliers/${id}`, {
            method: 'DELETE',
          });
          set((state) => ({
            suppliers: state.suppliers.filter((s) => s.id !== id),
          }));
        } catch (error) {
          set({ error: error.message });
          throw error;
        }
      },

      // Actions - UI State
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'SupplierStore',
    }
  )
);

export default useSupplierStore;
