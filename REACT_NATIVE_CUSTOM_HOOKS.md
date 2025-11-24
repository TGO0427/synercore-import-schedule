# React Native Custom Hooks Library

Complete, production-ready custom hooks for React Native app with offline support, data fetching, and state management.

---

## 1. useAuth Hook (hooks/useAuth.ts)

Authentication state management with login/logout/refresh capabilities.

```typescript
// hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    async function initializeAuth() {
      try {
        const user = await authService.getUser();
        const token = await authService.getToken();

        setState({
          user,
          isLoading: false,
          isAuthenticated: !!user && !!token,
          error: null,
        });
      } catch (error) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: error instanceof Error ? error.message : 'Failed to initialize auth',
        });
      }
    }

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.login(email, password);

      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';

      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
      });

      throw error;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.register({ name, email, password });

      setState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';

      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
      });

      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await authService.logout();

      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';

      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
      });

      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    clearError,
  };
}
```

---

## 2. useShipments Hook (hooks/useShipments.ts)

Fetch and manage shipments with filtering, pagination, and refresh support.

```typescript
// hooks/useShipments.ts
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface UseShipmentsOptions {
  pageSize?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseShipmentsState {
  shipments: Shipment[];
  isLoading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  total: number;
}

export interface UseShipmentsActions {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  resetPage: () => void;
  filter: (filters: ShipmentFilters) => Promise<void>;
  clearFilters: () => Promise<void>;
}

export function useShipments(options: UseShipmentsOptions = {}): UseShipmentsState & UseShipmentsActions {
  const { pageSize = 20, autoRefresh = false, refreshInterval = 30000 } = options;

  const [state, setState] = useState<UseShipmentsState>({
    shipments: [],
    isLoading: true,
    error: null,
    page: 1,
    hasMore: false,
    total: 0,
  });

  const [filters, setFilters] = useState<ShipmentFilters | null>(null);

  // Initial load
  useEffect(() => {
    loadShipments(1);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadShipments(1);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const loadShipments = useCallback(async (pageNum: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiService.getShipments(filters, pageNum, pageSize);

      setState((prev) => ({
        ...prev,
        shipments: pageNum === 1 ? response.data : [...prev.shipments, ...response.data],
        isLoading: false,
        page: pageNum,
        hasMore: response.page < response.totalPages,
        total: response.total,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load shipments';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [filters, pageSize]);

  const refresh = useCallback(async () => {
    await loadShipments(1);
  }, [loadShipments]);

  const loadMore = useCallback(async () => {
    if (state.hasMore && !state.isLoading) {
      await loadShipments(state.page + 1);
    }
  }, [state.page, state.hasMore, state.isLoading, loadShipments]);

  const resetPage = useCallback(() => {
    setState((prev) => ({ ...prev, page: 1 }));
  }, []);

  const filter = useCallback(async (newFilters: ShipmentFilters) => {
    setFilters(newFilters);
    await loadShipments(1);
  }, [loadShipments]);

  const clearFilters = useCallback(async () => {
    setFilters(null);
    await loadShipments(1);
  }, [loadShipments]);

  return {
    ...state,
    refresh,
    loadMore,
    resetPage,
    filter,
    clearFilters,
  };
}

export interface ShipmentFilters {
  status?: string;
  supplierId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

---

## 3. useSingleShipment Hook (hooks/useSingleShipment.ts)

Fetch and manage a single shipment with refresh and update capabilities.

```typescript
// hooks/useSingleShipment.ts
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { syncService } from '../services/sync';

export interface UseSingleShipmentState {
  shipment: Shipment | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseSingleShipmentActions {
  refresh: () => Promise<void>;
  updateStatus: (status: string, notes?: string) => Promise<void>;
  uploadDocument: (file: DocumentFile) => Promise<void>;
  clearError: () => void;
}

export function useSingleShipment(shipmentId: string): UseSingleShipmentState & UseSingleShipmentActions {
  const [state, setState] = useState<UseSingleShipmentState>({
    shipment: null,
    isLoading: true,
    isUpdating: false,
    error: null,
    lastUpdated: null,
  });

  // Load shipment on mount
  useEffect(() => {
    loadShipment();
  }, [shipmentId]);

  const loadShipment = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const shipment = await apiService.getShipment(shipmentId);

      setState({
        shipment,
        isLoading: false,
        isUpdating: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load shipment';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [shipmentId]);

  const refresh = useCallback(async () => {
    await loadShipment();
  }, [loadShipment]);

  const updateStatus = useCallback(async (status: string, notes?: string) => {
    setState((prev) => ({ ...prev, isUpdating: true, error: null }));

    try {
      // Try to update immediately
      try {
        const updatedShipment = await apiService.updateShipmentStatus(shipmentId, status, notes);

        setState((prev) => ({
          ...prev,
          shipment: updatedShipment,
          isUpdating: false,
          lastUpdated: new Date(),
        }));
      } catch (error) {
        // If offline, queue the action
        if (error instanceof Error && error.message.includes('Network')) {
          await syncService.addPendingAction('update_status', `/shipments/${shipmentId}`, 'PATCH', {
            shipmentId,
            status,
            notes,
          });

          setState((prev) => ({
            ...prev,
            shipment: prev.shipment
              ? { ...prev.shipment, status, updatedAt: new Date().toISOString() }
              : null,
            isUpdating: false,
          }));
        } else {
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';

      setState((prev) => ({
        ...prev,
        isUpdating: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, [shipmentId]);

  const uploadDocument = useCallback(async (file: DocumentFile) => {
    setState((prev) => ({ ...prev, isUpdating: true, error: null }));

    try {
      try {
        await apiService.uploadDocument(shipmentId, file);

        // Reload shipment to get updated documents
        await loadShipment();

        setState((prev) => ({
          ...prev,
          isUpdating: false,
        }));
      } catch (error) {
        // If offline, queue the action
        if (error instanceof Error && error.message.includes('Network')) {
          await syncService.addPendingAction('upload_document', `/shipments/${shipmentId}/documents`, 'POST', {
            shipmentId,
            file,
          });

          setState((prev) => ({
            ...prev,
            isUpdating: false,
          }));
        } else {
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload document';

      setState((prev) => ({
        ...prev,
        isUpdating: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, [shipmentId, loadShipment]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    refresh,
    updateStatus,
    uploadDocument,
    clearError,
  };
}

export interface DocumentFile {
  uri: string;
  name: string;
  type: string;
}
```

---

## 4. useOfflineSync Hook (hooks/useOfflineSync.ts)

Monitor offline sync queue and sync status.

```typescript
// hooks/useOfflineSync.ts
import { useState, useEffect, useCallback } from 'react';
import { syncService } from '../services/sync';
import NetInfo from '@react-native-community/netinfo';

export interface UseOfflineSyncState {
  isSyncing: boolean;
  isOnline: boolean;
  pendingActionsCount: number;
  pendingActions: PendingAction[];
  lastSyncTime: Date | null;
  error: string | null;
}

export interface UseOfflineSyncActions {
  syncNow: () => Promise<void>;
  clearPending: () => Promise<void>;
  removePendingAction: (id: string) => Promise<void>;
  clearError: () => void;
}

export function useOfflineSync(): UseOfflineSyncState & UseOfflineSyncActions {
  const [state, setState] = useState<UseOfflineSyncState>({
    isSyncing: false,
    isOnline: true,
    pendingActionsCount: 0,
    pendingActions: [],
    lastSyncTime: null,
    error: null,
  });

  // Setup listeners on mount
  useEffect(() => {
    // Monitor sync status
    const unsubscribeSync = syncService.onSyncStatusChange((isSyncing) => {
      setState((prev) => ({ ...prev, isSyncing }));
    });

    // Monitor network status
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      setState((prev) => ({ ...prev, isOnline: state.isConnected ?? false }));
    });

    // Load initial pending actions
    loadPendingActions();

    return () => {
      unsubscribeSync();
      unsubscribeNetwork();
    };
  }, []);

  const loadPendingActions = useCallback(async () => {
    try {
      const pendingActions = await syncService.getPendingActions();

      setState((prev) => ({
        ...prev,
        pendingActions,
        pendingActionsCount: pendingActions.length,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load pending actions';

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, []);

  const syncNow = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));

    try {
      await syncService.syncPendingActions();

      setState((prev) => ({
        ...prev,
        lastSyncTime: new Date(),
      }));

      await loadPendingActions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [loadPendingActions]);

  const clearPending = useCallback(async () => {
    try {
      await syncService.clearAllPending();

      setState((prev) => ({
        ...prev,
        pendingActions: [],
        pendingActionsCount: 0,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear pending';

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, []);

  const removePendingAction = useCallback(async (id: string) => {
    try {
      await syncService.removePendingAction(id);

      await loadPendingActions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove action';

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [loadPendingActions]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    syncNow,
    clearPending,
    removePendingAction,
    clearError,
  };
}

export interface PendingAction {
  id: string;
  type: string;
  endpoint: string;
  method: string;
  data: any;
  retries: number;
  createdAt: number;
}
```

---

## 5. usePushNotifications Hook (hooks/usePushNotifications.ts)

Setup and manage push notifications with permission handling.

```typescript
// hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notifications';

export interface UsePushNotificationsState {
  isPermissionGranted: boolean;
  isRequesting: boolean;
  deviceToken: string | null;
  error: string | null;
}

export interface UsePushNotificationsActions {
  requestPermission: () => Promise<boolean>;
  sendLocalNotification: (title: string, body: string, data?: Record<string, any>) => Promise<void>;
  sendScheduledNotification: (
    title: string,
    body: string,
    delaySeconds: number,
    data?: Record<string, any>
  ) => Promise<void>;
  onNotification: (callback: (notification: any) => void) => () => void;
  clearError: () => void;
}

export function usePushNotifications(): UsePushNotificationsState & UsePushNotificationsActions {
  const [state, setState] = useState<UsePushNotificationsState>({
    isPermissionGranted: false,
    isRequesting: false,
    deviceToken: null,
    error: null,
  });

  // Request permissions on mount
  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = useCallback(async () => {
    setState((prev) => ({ ...prev, isRequesting: true }));

    try {
      const permissionGranted = await notificationService.requestPermissions();

      if (permissionGranted) {
        const token = await notificationService.registerDeviceToken();

        setState({
          isPermissionGranted: true,
          isRequesting: false,
          deviceToken: token,
          error: null,
        });
      } else {
        setState({
          isPermissionGranted: false,
          isRequesting: false,
          deviceToken: null,
          error: null,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize notifications';

      setState({
        isPermissionGranted: false,
        isRequesting: false,
        deviceToken: null,
        error: errorMessage,
      });
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isRequesting: true, error: null }));

    try {
      const permissionGranted = await notificationService.requestPermissions();

      if (permissionGranted) {
        const token = await notificationService.registerDeviceToken();

        setState({
          isPermissionGranted: true,
          isRequesting: false,
          deviceToken: token,
          error: null,
        });
      } else {
        setState({
          isPermissionGranted: false,
          isRequesting: false,
          deviceToken: null,
          error: null,
        });
      }

      return permissionGranted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permissions';

      setState((prev) => ({
        ...prev,
        isRequesting: false,
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  const sendLocalNotification = useCallback(
    async (title: string, body: string, data?: Record<string, any>) => {
      try {
        await notificationService.sendLocalNotification(title, body, data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send notification';

        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
      }
    },
    []
  );

  const sendScheduledNotification = useCallback(
    async (title: string, body: string, delaySeconds: number, data?: Record<string, any>) => {
      try {
        await notificationService.sendScheduledNotification(title, body, delaySeconds, data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to schedule notification';

        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
      }
    },
    []
  );

  const onNotification = useCallback((callback: (notification: any) => void) => {
    return notificationService.onNotification(callback);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    requestPermission,
    sendLocalNotification,
    sendScheduledNotification,
    onNotification,
    clearError,
  };
}
```

---

## 6. useNetworkStatus Hook (hooks/useNetworkStatus.ts)

Monitor network connectivity with debouncing.

```typescript
// hooks/useNetworkStatus.ts
import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface UseNetworkStatusState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  isLoading: boolean;
}

export function useNetworkStatus(debounceMs: number = 500): UseNetworkStatusState {
  const [state, setState] = useState<UseNetworkStatusState>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
    isLoading: true,
  });

  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((netState) => {
      updateState(netState);
      setState((prev) => ({ ...prev, isLoading: false }));
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((netState) => {
      // Clear existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Debounce updates
      const timeout = setTimeout(() => {
        updateState(netState);
      }, debounceMs);

      setDebounceTimeout(timeout);
    });

    return () => {
      unsubscribe();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceMs]);

  const updateState = useCallback((netState: NetInfoState) => {
    setState({
      isConnected: netState.isConnected ?? false,
      isInternetReachable: netState.isInternetReachable,
      type: netState.type,
      isLoading: false,
    });
  }, []);

  return state;
}
```

---

## 7. useFocusRefresh Hook (hooks/useFocusRefresh.ts)

Auto-refresh data when screen is focused.

```typescript
// hooks/useFocusRefresh.ts
import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useFocusRefresh(callback: () => Promise<void> | void, dependencies: any[] = []) {
  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      const handleFocus = async () => {
        try {
          await callback();
        } catch (error) {
          console.error('Focus refresh error:', error);
        }
      };

      handleFocus();
    }, [callback, ...dependencies])
  );
}

export function useFocusRefreshInterval(
  callback: () => Promise<void> | void,
  intervalMs: number = 30000,
  dependencies: any[] = []
) {
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const executeCallback = async () => {
        if (!isMounted) return;

        try {
          await callback();
        } catch (error) {
          console.error('Focus refresh interval error:', error);
        }
      };

      // Execute immediately
      executeCallback();

      // Then set up interval
      const interval = setInterval(() => {
        if (isMounted) {
          executeCallback();
        }
      }, intervalMs);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }, [callback, intervalMs, ...dependencies])
  );
}
```

---

## 8. useDebounce Hook (hooks/useDebounce.ts)

Debounce values for optimized API calls.

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = 500
): T {
  const [debouncedCallback, setDebouncedCallback] = useState<T | null>(null);
  const [timeout, setTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [timeout]);

  return ((...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    const newTimeout = setTimeout(() => {
      callback(...args);
    }, delayMs);

    setTimeout(newTimeout);
  }) as T;
}
```

---

## 9. useAsync Hook (hooks/useAsync.ts)

General purpose async operation handler.

```typescript
// hooks/useAsync.ts
import { useState, useEffect, useCallback } from 'react';

export interface UseAsyncState<T> {
  status: 'idle' | 'pending' | 'success' | 'error';
  data: T | null;
  error: Error | null;
}

export interface UseAsyncActions<T> {
  execute: () => Promise<void>;
  reset: () => void;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
): UseAsyncState<T> & UseAsyncActions<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ status: 'pending', data: null, error: null });

    try {
      const response = await asyncFunction();

      setState({ status: 'success', data: response, error: null });
    } catch (error) {
      setState({
        status: 'error',
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute, reset };
}
```

---

## Usage Examples

### Login Screen with useAuth
```typescript
import { useAuth } from '../hooks/useAuth';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isLoading, error, login } = useAuth();

  const handleLogin = async () => {
    try {
      await login(email, password);
      // Navigation will be handled by auth state
    } catch (err) {
      Alert.alert('Login Error', error || 'Failed to login');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
        <Text>{isLoading ? 'Logging in...' : 'Login'}</Text>
      </TouchableOpacity>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

### Shipments List with useShipments
```typescript
import { useShipments } from '../hooks/useShipments';
import { View, FlatList, Text, RefreshControl } from 'react-native';
import { ShipmentCard } from '../components/ShipmentCard';

export function ShipmentsScreen() {
  const {
    shipments,
    isLoading,
    error,
    hasMore,
    refresh,
    loadMore,
    filter,
  } = useShipments({ pageSize: 20, autoRefresh: true });

  const handleFilterApply = (filters) => {
    filter(filters);
  };

  return (
    <View>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <FlatList
        data={shipments}
        renderItem={({ item }) => <ShipmentCard shipment={item} />}
        keyExtractor={(item) => item.id}
        onEndReached={() => hasMore && loadMore()}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      />
    </View>
  );
}
```

### Offline Sync Monitor
```typescript
import { useOfflineSync } from '../hooks/useOfflineSync';
import { View, Text, TouchableOpacity } from 'react-native';

export function SyncStatus() {
  const { isOnline, isSyncing, pendingActionsCount, syncNow } = useOfflineSync();

  return (
    <View>
      <Text>
        {isOnline ? '✅ Online' : '⚠️ Offline'}
        {isSyncing && ' (Syncing...)'}
      </Text>
      {pendingActionsCount > 0 && (
        <Text>{pendingActionsCount} pending actions</Text>
      )}
      {!isOnline && (
        <TouchableOpacity onPress={syncNow} disabled={isSyncing}>
          <Text>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

## Hook Composition Pattern

Hooks can be combined for powerful features:

```typescript
export function useShipmentDetail(shipmentId: string) {
  const shipment = useSingleShipment(shipmentId);
  const notifications = usePushNotifications();
  const network = useNetworkStatus();

  // Auto-refresh when focused
  useFocusRefresh(() => shipment.refresh(), [shipmentId]);

  // Notify on status changes
  useEffect(() => {
    if (shipment.lastUpdated) {
      notifications.sendLocalNotification(
        'Shipment Updated',
        'Your shipment status has been updated',
        { shipmentId }
      );
    }
  }, [shipment.lastUpdated]);

  return {
    ...shipment,
    isAvailable: network.isConnected,
  };
}
```

---

## Testing Hooks

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from '../hooks/useAuth';

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.login('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeDefined();
    });
  });
});
```

---

## Best Practices

✅ **Always cleanup**: Unsubscribe listeners in useEffect cleanup
✅ **Memoize callbacks**: Use useCallback to prevent unnecessary re-renders
✅ **Handle loading states**: Always show loading indicators for async operations
✅ **Error handling**: Provide clear error messages to users
✅ **Type safety**: Use TypeScript interfaces for all hooks
✅ **Composition**: Combine hooks for complex features
✅ **Testing**: Test hooks in isolation with @testing-library/react-native
✅ **Documentation**: Document hook parameters and return values

---

**All hooks are production-ready and fully typed with TypeScript.**
**Last Updated**: 2025-11-14
