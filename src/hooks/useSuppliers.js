// src/hooks/useSuppliers.js
import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { Supplier } from '../types/supplier';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';
import { useNotification } from '../contexts/NotificationContext';

// Timeout helper for fetch
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      credentials: 'include'
    });
  } finally {
    clearTimeout(id);
  }
}

export function useSuppliers(fetchShipments) {
  const [suppliers, setSuppliers] = useState([]);
  const lastFetchRef = useRef(0);
  const { showSuccess, showError, confirm: confirmAction } = useNotification();

  const FETCH_COOLDOWN = 5000;

  const fetchSuppliers = useCallback(async (isBackgroundSync = false) => {
    try {
      const now = Date.now();
      if (isBackgroundSync && (now - lastFetchRef.current) < FETCH_COOLDOWN) {
        return;
      }
      lastFetchRef.current = now;

      const res = await fetchWithTimeout(getApiUrl('/api/suppliers'), {
        headers: authUtils.getAuthHeader()
      }, 10000);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();

      const normalized = (data.data || data || []).map(s => Object.assign(new Supplier({}), s));
      setSuppliers(prev => {
        if (prev.length === normalized.length && prev.length > 0) {
          if (prev[0]?.id === normalized[0]?.id) return prev;
        }
        return normalized;
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      if (!isBackgroundSync) showError(err.message);
    }
  }, [showError]);

  const handleAddSupplier = useCallback(async (supplier) => {
    try {
      const response = await authFetch(getApiUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
      });
      if (!response.ok) throw new Error('Failed to add supplier');
      await fetchSuppliers();
      showSuccess('Supplier added successfully');
    } catch (err) { showError(err.message); }
  }, [fetchSuppliers, showSuccess, showError]);

  const handleUpdateSupplier = useCallback(async (id, updates) => {
    try {
      const response = await authFetch(getApiUrl(`/api/suppliers/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update supplier');
      await fetchSuppliers();
      showSuccess('Supplier updated successfully');
    } catch (err) { showError(err.message); }
  }, [fetchSuppliers, showSuccess, showError]);

  const handleDeleteSupplier = useCallback(async (id) => {
    if (!(await confirmAction({ title: 'Delete Supplier', message: 'Are you sure you want to delete this supplier?', type: 'danger', confirmText: 'Delete' }))) return;
    try {
      const response = await authFetch(getApiUrl(`/api/suppliers/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete supplier');
      await fetchSuppliers();
      showSuccess('Supplier deleted successfully');
    } catch (err) { showError(err.message); }
  }, [fetchSuppliers, showSuccess, showError, confirmAction]);

  const handleImportSchedule = useCallback(async (supplierId, scheduleData, documents = []) => {
    try {
      const response = await authFetch(getApiUrl(`/api/suppliers/${supplierId}/import`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleData, documents })
      });
      if (!response.ok) throw new Error('Failed to import schedule');

      const result = await response.json();
      if (result.scheduleData && result.scheduleData.length > 0) {
        const shipmentsResponse = await authFetch(getApiUrl('/api/shipments/bulk-import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.scheduleData)
        });
        if (!shipmentsResponse.ok) throw new Error('Failed to save imported schedule');

        await fetchShipments();
        showSuccess(`Successfully imported ${result.scheduleData.length} items from ${result.supplier.name}`);
      }
    } catch (err) {
      console.error('Error importing schedule:', err);
      showError(err.message);
    }
  }, [fetchShipments, showSuccess, showError]);

  return {
    suppliers,
    fetchSuppliers,
    handleAddSupplier,
    handleUpdateSupplier,
    handleDeleteSupplier,
    handleImportSchedule,
  };
}

export default useSuppliers;
