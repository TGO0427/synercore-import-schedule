import { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services';

export interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  status: string;
  origin: string;
  originAddress?: string;
  destination: string;
  destinationAddress?: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  estimatedDelivery: string;
  currentLocation?: string;
  lastUpdate?: string;
  timeline?: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
    location: string;
    description: string;
  }>;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
}

export interface UseSingleShipmentState {
  shipment: ShipmentDetail | null;
  isLoading: boolean;
  error: Error | null;
  isUpdating: boolean;
  updateError: Error | null;
}

export interface UseSingleShipmentActions {
  refresh: () => Promise<void>;
  updateStatus: (newStatus: string, notes?: string) => Promise<void>;
  reset: () => void;
}

/**
 * useSingleShipment Hook
 * Manage a single shipment's details with update capability
 *
 * @param shipmentId - The ID of the shipment to fetch
 * @returns {UseSingleShipmentState & UseSingleShipmentActions} State and actions
 *
 * @example
 * const { shipment, isLoading, refresh, updateStatus } = useSingleShipment(shipmentId);
 *
 * useFocusRefresh(() => {
 *   refresh();
 * });
 */
export function useSingleShipment(
  shipmentId: string
): UseSingleShipmentState & UseSingleShipmentActions {
  const [state, setState] = useState<UseSingleShipmentState>({
    shipment: null,
    isLoading: false,
    error: null,
    isUpdating: false,
    updateError: null,
  });

  const fetchShipment = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const shipment = await apiService.getShipmentDetail(shipmentId);

      setState((prev) => ({
        ...prev,
        shipment,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Failed to load shipment'),
      }));
    }
  }, [shipmentId]);

  const refresh = useCallback(async () => {
    await fetchShipment();
  }, [fetchShipment]);

  const updateStatus = useCallback(
    async (newStatus: string, notes?: string) => {
      setState((prev) => ({
        ...prev,
        isUpdating: true,
        updateError: null,
      }));

      try {
        const updated = await apiService.updateShipmentStatus(shipmentId, {
          status: newStatus,
          notes,
        });

        setState((prev) => ({
          ...prev,
          shipment: updated,
          isUpdating: false,
          updateError: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isUpdating: false,
          updateError: error instanceof Error ? error : new Error('Failed to update status'),
        }));

        throw error;
      }
    },
    [shipmentId]
  );

  const reset = useCallback(() => {
    setState({
      shipment: null,
      isLoading: false,
      error: null,
      isUpdating: false,
      updateError: null,
    });
  }, []);

  // Load shipment on mount
  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  return {
    ...state,
    refresh,
    updateStatus,
    reset,
  };
}
