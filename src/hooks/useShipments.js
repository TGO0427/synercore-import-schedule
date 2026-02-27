// src/hooks/useShipments.js
import { useState, useRef, useCallback } from 'react';
import { authFetch } from '../utils/authFetch';
import { ExcelProcessor } from '../utils/excelProcessor';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';
import { useNotification } from '../contexts/NotificationContext';

// Timeout helper for fetch (fetch doesn't honor a "timeout" option)
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

export function useShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const loadingCountRef = useRef(0);
  const lastFetchRef = useRef(0);
  const { showSuccess, showError } = useNotification();

  const FETCH_COOLDOWN = 5000;

  const startLoading = useCallback(() => {
    loadingCountRef.current += 1;
    setLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
    if (loadingCountRef.current === 0) setLoading(false);
  }, []);

  const fetchShipments = useCallback(async (isBackgroundSync = false) => {
    try {
      const now = Date.now();
      if (isBackgroundSync && (now - lastFetchRef.current) < FETCH_COOLDOWN) {
        return;
      }
      lastFetchRef.current = now;

      if (!isBackgroundSync) startLoading();

      let response;
      let lastError;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Server-side pagination limit
          response = await fetchWithTimeout(getApiUrl('/api/shipments?limit=5000'), {
            headers: {
              ...(isBackgroundSync ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {}),
              ...authUtils.getAuthHeader()
            }
          }, 10000); // 10s fetch timeout per attempt

          if (response.ok) break;

          if (response.status === 503 || response.status >= 500) {
            const body = await response.text().catch(() => '');
            throw new Error(`Server error ${response.status}: ${body}`);
          } else {
            const body = await response.text().catch(() => '');
            throw new Error(`Failed to fetch shipments: ${response.status} ${body}`);
          }
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300 * attempt)); // Linear backoff: 300ms, 600ms
        }
      }

      if (!response || !response.ok) throw lastError || new Error('Failed to fetch shipments after retries');

      const data = await response.json();

      // Warn if response may be truncated at the pagination limit
      if ((data.data || []).length >= 5000) {
        console.warn('Shipment data may be truncated: response count reached the 5000 limit');
      }

      const normalized = (data.data || []).map(s => ({
        id: s.id,
        orderRef: s.order_ref || s.orderRef,
        supplier: s.supplier,
        productName: s.product_name || s.productName,
        quantity: Number(s.quantity) || 0,
        palletQty: Number(s.pallet_qty || s.palletQty) || 0,
        cbm: Number(s.cbm) || 0,
        latestStatus: s.latest_status || s.latestStatus,
        weekNumber: Number(s.week_number || s.weekNumber) || 0,
        weekDate: s.week_date || s.weekDate,
        selectedWeekDate: s.selected_week_date || s.selectedWeekDate,
        finalPod: s.final_pod || s.finalPod,
        receivingWarehouse: s.receiving_warehouse || s.receivingWarehouse,
        forwardingAgent: s.forwarding_agent || s.forwardingAgent,
        vesselName: s.vessel_name || s.vesselName,
        incoterm: s.incoterm,
        notes: s.notes,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt,
        receivedQuantity: s.received_quantity || s.receivedQuantity ? Number(s.received_quantity || s.receivedQuantity) : null,
        unloadingStartDate: s.unloading_start_date || s.unloadingStartDate,
        unloadingCompletedDate: s.unloading_completed_date || s.unloadingCompletedDate,
        inspectionDate: s.inspection_date || s.inspectionDate,
        inspectionStatus: s.inspection_status || s.inspectionStatus,
        inspectionNotes: s.inspection_notes || s.inspectionNotes,
        inspectedBy: s.inspected_by || s.inspectedBy,
        receivingDate: s.receiving_date || s.receivingDate,
        receivingStatus: s.receiving_status || s.receivingStatus,
        receivingNotes: s.receiving_notes || s.receivingNotes,
        receivedBy: s.received_by || s.receivedBy,
        discrepancies: s.discrepancies,
        rejectionDate: s.rejection_date || s.rejectionDate,
        rejectionReason: s.rejection_reason || s.rejectionReason,
        rejectedBy: s.rejected_by || s.rejectedBy
      }));

      setShipments(normalized);
      setLastSyncTime(new Date());
    } catch (err) {
      if (isBackgroundSync) {
        console.warn('Background sync failed:', err.message);
      } else {
        console.error('useShipments: Error fetching shipments:', err);
        showError(`Failed to load shipments: ${err.message}`);
      }
    } finally {
      if (!isBackgroundSync) stopLoading();
    }
  }, [startLoading, stopLoading, showError]);

  const handleCreateShipment = useCallback(async (shipmentData) => {
    try {
      const response = await authFetch(getApiUrl('/api/shipments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (Array.isArray(errorData?.details) ? errorData.details.map((d) => d.msg).join(', ') : null) ||
                            errorData?.error ||
                            'Failed to create shipment';
        throw new Error(errorMessage);
      }
      await fetchShipments();
      showSuccess('Shipment added successfully');
    } catch (err) {
      console.error('Shipment creation error:', err);
      showError(err.message);
      throw err;
    }
  }, [fetchShipments, showSuccess, showError]);

  const handleUpdateShipment = useCallback(async (id, updates) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update shipment');
      await fetchShipments();
      showSuccess('Shipment updated successfully');
    } catch (err) { showError(err.message); }
  }, [fetchShipments, showSuccess, showError]);

  const handleDeleteShipment = useCallback(async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete shipment');
      await fetchShipments();
      showSuccess('Shipment deleted successfully');
    } catch (err) { showError(err.message); }
  }, [fetchShipments, showSuccess, showError]);

  const handleArchiveShipment = useCallback(async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/shipments/${id}/archive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to archive shipment');
      await fetchShipments();
      showSuccess('Shipment archived successfully');
    } catch (err) { showError(err.message); }
  }, [fetchShipments, showSuccess, showError]);

  const handleFileUpload = useCallback(async (file, handleAddSupplier) => {
    try {
      startLoading();

      const processedShipments = await ExcelProcessor.parseExcelFile(file);
      if (processedShipments.length === 0) throw new Error('No data found in Excel file');

      const toPlain = (s) => ({
        id: s.id,
        supplier: s.supplier,
        orderRef: s.orderRef,
        finalPod: s.finalPod,
        latestStatus: s.latestStatus,
        weekNumber: Number(s.weekNumber) || 0,
        productName: s.productName,
        quantity: Number(s.quantity) || 0,
        palletQty: Number(s.palletQty) || 0,
        receivingWarehouse: s.receivingWarehouse,
        forwardingAgent: s.forwardingAgent ?? '',
        vesselName: s.vesselName ?? '',
        incoterm: s.incoterm ?? '',
        notes: s.notes ?? '',
      });

      const payload = processedShipments.map(toPlain);

      const response = await authFetch(getApiUrl('/api/shipments/bulk-import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('useShipments: Failed bulk import:', response.status, errorText);
        throw new Error(`Failed bulk import: ${response.status}`);
      }

      await response.json();

      // Auto-create suppliers from imported shipments
      const uniqueSuppliers = [...new Set(processedShipments.map(s => s.supplier).filter(Boolean))];
      for (const supplierName of uniqueSuppliers) {
        try {
          await handleAddSupplier({ name: supplierName });
        } catch (err) {
          showError('Failed to create supplier: ' + err.message);
        }
      }

      showSuccess(`Successfully imported ${payload.length} shipments and ${uniqueSuppliers.length} suppliers`);
      await fetchShipments();

      // Ensure palletQty is preserved in UI after import (match by orderRef)
      const palletQtyByOrderRef = new Map(payload.map(s => [s.orderRef, s.palletQty]));
      setShipments(prev => prev.map(s => ({ ...s, palletQty: palletQtyByOrderRef.get(s.orderRef) ?? s.palletQty })));
    } catch (err) {
      console.error('useShipments: File upload error:', err);
      showError(`Failed to process file: ${err.message}`);
    } finally { stopLoading(); }
  }, [fetchShipments, startLoading, stopLoading, showSuccess, showError]);

  return {
    shipments,
    setShipments,
    loading,
    lastSyncTime,
    fetchShipments,
    handleCreateShipment,
    handleUpdateShipment,
    handleDeleteShipment,
    handleArchiveShipment,
    handleFileUpload,
    startLoading,
    stopLoading,
  };
}

export default useShipments;
