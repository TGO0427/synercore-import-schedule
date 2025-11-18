import { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services';

export interface Shipment {
  id: string;
  trackingNumber: string;
  status: string;
  origin: string;
  destination: string;
  weight: number;
  estimatedDelivery: string;
  currentLocation?: string;
  lastUpdate?: string;
}

export interface UseShipmentsState {
  shipments: Shipment[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
}

export interface UseShipmentsActions {
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  setFilter: (filter: string) => void;
}

/**
 * useShipments Hook
 * Manage shipments list with pagination and filtering
 *
 * @param pageSize - Number of items per page (default: 10)
 * @returns {UseShipmentsState & UseShipmentsActions} State and actions
 *
 * @example
 * const { shipments, isLoading, error, refresh, loadMore } = useShipments();
 *
 * useFocusRefresh(() => {
 *   refresh();
 * });
 */
export function useShipments(pageSize: number = 10): UseShipmentsState & UseShipmentsActions {
  const [state, setState] = useState<UseShipmentsState>({
    shipments: [],
    isLoading: false,
    error: null,
    hasMore: true,
    page: 1,
  });

  const [filter, setFilter] = useState<string>('');

  const loadShipments = useCallback(
    async (pageNum: number, isRefresh: boolean = false) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        // Call API with pagination
        const response = await apiService.getShipments({
          page: pageNum,
          limit: pageSize,
          status: filter || undefined,
        });

        const newShipments = response.data || [];
        const hasMore = (response.pagination?.hasMore) ?? newShipments.length === pageSize;

        setState((prev) => ({
          ...prev,
          shipments: isRefresh ? newShipments : [...prev.shipments, ...newShipments],
          isLoading: false,
          hasMore,
          page: pageNum,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to load shipments'),
        }));
      }
    },
    [pageSize, filter]
  );

  const loadMore = useCallback(async () => {
    setState((prev) => {
      if (!prev.hasMore || prev.isLoading) {
        return prev;
      }
      // Trigger loading of next page asynchronously
      loadShipments(prev.page + 1, false);
      return prev;
    });
  }, [loadShipments]);

  const refresh = useCallback(async () => {
    await loadShipments(1, true);
  }, [loadShipments]);

  const reset = useCallback(() => {
    setState({
      shipments: [],
      isLoading: false,
      error: null,
      hasMore: true,
      page: 1,
    });
    setFilter('');
  }, []);

  const handleSetFilter = useCallback(
    (newFilter: string) => {
      setFilter(newFilter);
      loadShipments(1, true);
    },
    [loadShipments]
  );

  // Load initial data
  useEffect(() => {
    loadShipments(1, true);
  }, []);

  return {
    ...state,
    loadMore,
    refresh,
    reset,
    setFilter: handleSetFilter,
  };
}
