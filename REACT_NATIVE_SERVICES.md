# React Native Services & Hooks Guide

Complete implementation guide for services and custom React hooks in the Synercore React Native app.

## Services Overview

Services are singleton classes that handle business logic, API communication, and data persistence.

### 1. Authentication Service

**File**: `services/auth.ts`

```typescript
// Complete implementation
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'supplier';
}

interface LoginResponse {
  token: string;
  user: User;
  expiresIn: number;
}

class AuthService {
  private api: AxiosInstance;
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
      timeout: 10000
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      const token = this.token || (await this.getToken());
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            await this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await this.api.post<LoginResponse>('/auth/login', {
        email,
        password
      });

      const { token, user } = response.data;
      this.token = token;
      this.user = user;

      await SecureStore.setItemAsync('authToken', token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<LoginResponse> {
    try {
      const response = await this.api.post<LoginResponse>('/auth/register', data);
      const { token, user } = response.data;

      this.token = token;
      this.user = user;

      await SecureStore.setItemAsync('authToken', token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.token = null;
      this.user = null;
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('user');
    }
  }

  async refreshToken(): Promise<string> {
    try {
      const response = await this.api.post<{ token: string }>('/auth/refresh');
      const { token } = response.data;

      this.token = token;
      await SecureStore.setItemAsync('authToken', token);

      return token;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.token) return this.token;
      this.token = await SecureStore.getItemAsync('authToken');
      return this.token;
    } catch (error) {
      return null;
    }
  }

  async getUser(): Promise<User | null> {
    try {
      if (this.user) return this.user;
      const userJson = await SecureStore.getItemAsync('user');
      if (userJson) {
        this.user = JSON.parse(userJson);
        return this.user;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private handleError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('Authentication failed');
  }
}

export const authService = new AuthService();
```

### 2. Shipment Service

```typescript
// services/shipment.ts
import axios, { AxiosInstance } from 'axios';
import { authService } from './auth';

interface Shipment {
  id: string;
  orderRef: string;
  productName: string;
  quantity: number;
  latestStatus: string;
  supplier: string;
  receivingWarehouse: string;
  updatedAt: string;
  createdAt: string;
}

interface ShipmentFilters {
  status?: string;
  supplier?: string;
  warehouse?: string;
  dateFrom?: string;
  dateTo?: string;
}

class ShipmentService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      const token = await authService.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async getShipments(filters?: ShipmentFilters): Promise<Shipment[]> {
    try {
      const response = await this.api.get<Shipment[]>('/shipments', {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getShipment(id: string): Promise<Shipment> {
    try {
      const response = await this.api.get<Shipment>(`/shipments/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateStatus(
    id: string,
    status: string,
    notes?: string
  ): Promise<Shipment> {
    try {
      const response = await this.api.put<Shipment>(`/shipments/${id}`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async uploadDocument(
    shipmentId: string,
    file: {
      uri: string;
      name: string;
      type: string;
    }
  ): Promise<{ success: boolean; documentId: string }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type
      } as any);

      const response = await this.api.post<{
        success: boolean;
        documentId: string;
      }>(`/shipments/${shipmentId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    return new Error('Failed to fetch shipments');
  }
}

export const shipmentService = new ShipmentService();
```

### 3. Offline Sync Service

```typescript
// services/sync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shipmentService } from './shipment';

interface PendingAction {
  id: string;
  type: 'update_status' | 'upload_document';
  shipmentId: string;
  data: any;
  timestamp: number;
  retries: number;
}

class SyncService {
  private pendingActionsKey = 'pending_actions';
  private syncInterval: NodeJS.Timer | null = null;
  private isSyncing = false;

  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retries'>) {
    try {
      const actions = await this.getPendingActions();
      const newAction: PendingAction = {
        ...action,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        retries: 0
      };

      actions.push(newAction);
      await AsyncStorage.setItem(
        this.pendingActionsKey,
        JSON.stringify(actions)
      );

      return newAction;
    } catch (error) {
      console.error('Failed to add pending action:', error);
      throw error;
    }
  }

  async getPendingActions(): Promise<PendingAction[]> {
    try {
      const data = await AsyncStorage.getItem(this.pendingActionsKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  async removePendingAction(id: string) {
    try {
      const actions = await this.getPendingActions();
      const filtered = actions.filter(a => a.id !== id);
      await AsyncStorage.setItem(
        this.pendingActionsKey,
        JSON.stringify(filtered)
      );
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }

  async syncPendingActions() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    try {
      const actions = await this.getPendingActions();

      for (const action of actions) {
        try {
          await this.executePendingAction(action);
          await this.removePendingAction(action.id);
        } catch (error) {
          // Increment retries and keep the action for later
          action.retries++;
          if (action.retries > 5) {
            // Remove after 5 failed attempts
            await this.removePendingAction(action.id);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async executePendingAction(action: PendingAction) {
    switch (action.type) {
      case 'update_status':
        await shipmentService.updateStatus(
          action.shipmentId,
          action.data.status,
          action.data.notes
        );
        break;

      case 'upload_document':
        await shipmentService.uploadDocument(action.shipmentId, action.data);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  startAutoSync(intervalMs = 30000) {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncPendingActions().catch(console.error);
    }, intervalMs);

    // Sync immediately on start
    this.syncPendingActions().catch(console.error);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async clearAllPending() {
    try {
      await AsyncStorage.removeItem(this.pendingActionsKey);
    } catch (error) {
      console.error('Failed to clear pending actions:', error);
    }
  }
}

export const syncService = new SyncService();
```

### 4. Notification Service

```typescript
// services/notifications.ts
import * as Notifications from 'expo-notifications';
import { authService } from './auth';

interface NotificationPermissions {
  granted: boolean;
  ios?: {
    alert: boolean;
    sound: boolean;
    badge: boolean;
  };
}

class NotificationService {
  async requestPermissions(): Promise<NotificationPermissions> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return {
      granted: finalStatus === 'granted'
    };
  }

  async registerDeviceToken(): Promise<string | null> {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;

      // Send token to backend
      const user = await authService.getUser();
      if (user && token) {
        // TODO: Call API to register device token
        console.log('Device token registered:', token);
      }

      return token;
    } catch (error) {
      console.error('Failed to register device token:', error);
      return null;
    }
  }

  setupNotificationListeners() {
    // Handle notifications when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log('Notification received:', notification);

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true
        };
      }
    });

    // Handle tapped notifications
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);

      // Navigate to relevant screen based on notification data
      // Example: if (data.type === 'shipment_update') navigate to shipment
    });
  }

  async sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1
      },
      trigger: null
    });
  }
}

export const notificationService = new NotificationService();
```

## Custom React Hooks

### 1. useShipments Hook

```typescript
// hooks/useShipments.ts
import { useState, useEffect } from 'react';
import { shipmentService } from '../services/shipment';

interface Shipment {
  id: string;
  orderRef: string;
  // ... other properties
}

export function useShipments(filters?: any) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await shipmentService.getShipments(filters);
      setShipments(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [filters]);

  const refetch = () => fetchShipments();

  return { shipments, loading, error, refetch };
}
```

### 2. useAuth Hook

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = await authService.getToken();
      if (token) {
        const user = await authService.getUser();
        setUser(user);
        setIsAuthenticated(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user, token } = await authService.login(email, password);
      setUser(user);
      setIsAuthenticated(true);
      return { user, token };
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      throw error;
    }
  };

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout
  };
}
```

### 3. useOfflineSync Hook

```typescript
// hooks/useOfflineSync.ts
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '../services/sync';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online ?? true);

      if (online) {
        // Sync pending actions when coming back online
        syncService.syncPendingActions().catch(console.error);
      }
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online ?? true);
    });

    // Start auto-sync on mount
    syncService.startAutoSync(30000);

    return () => {
      unsubscribe();
      syncService.stopAutoSync();
    };
  }, []);

  // Track pending actions count
  useEffect(() => {
    const updatePendingCount = async () => {
      const actions = await syncService.getPendingActions();
      setPendingCount(actions.length);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => clearInterval(interval);
  }, []);

  const syncNow = async () => {
    await syncService.syncPendingActions();
  };

  return {
    isOnline,
    pendingCount,
    syncNow
  };
}
```

### 4. usePushNotifications Hook

```typescript
// hooks/usePushNotifications.ts
import { useEffect } from 'react';
import { notificationService } from '../services/notifications';

export function usePushNotifications() {
  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    // Request permissions
    const permissions = await notificationService.requestPermissions();
    if (!permissions.granted) {
      console.warn('Notification permissions not granted');
      return;
    }

    // Register device token
    await notificationService.registerDeviceToken();

    // Setup listeners
    notificationService.setupNotificationListeners();
  };

  const sendLocalNotification = async (title: string, body: string) => {
    await notificationService.sendLocalNotification(title, body);
  };

  return {
    sendLocalNotification
  };
}
```

## State Management with Zustand

```typescript
// stores/auth.ts
import { create } from 'zustand';
import { authService } from '../services/auth';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.login(email, password);
      set({ user, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ user: null, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setUser: (user) => set({ user }),
  setError: (error) => set({ error })
}));

// stores/shipments.ts
interface ShipmentsStore {
  shipments: Shipment[];
  isLoading: boolean;
  error: string | null;
  setShipments: (shipments: Shipment[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useShipmentsStore = create<ShipmentsStore>((set) => ({
  shipments: [],
  isLoading: false,
  error: null,
  setShipments: (shipments) => set({ shipments }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));
```

## Usage Examples

### In a Screen Component

```typescript
// app/(app)/shipments/index.tsx
import React, { useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { useShipments } from '../../../hooks/useShipments';
import { useOfflineSync } from '../../../hooks/useOfflineSync';
import { ShipmentCard } from '../../../components/ShipmentCard';
import { LoadingSpinner } from '../../../components/LoadingSpinner';

export default function ShipmentsScreen() {
  const { shipments, loading, error, refetch } = useShipments();
  const { isOnline, pendingCount } = useOfflineSync();

  useEffect(() => {
    refetch();
  }, [isOnline]);

  return (
    <View style={{ flex: 1 }}>
      {!isOnline && (
        <View style={{ padding: 12, backgroundColor: '#fff3cd' }}>
          <Text>Offline mode • {pendingCount} pending actions</Text>
        </View>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Text>Error: {error.message}</Text>
      ) : (
        <FlatList
          data={shipments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShipmentCard shipment={item} onPress={() => {}} />
          )}
          refreshing={loading}
          onRefresh={refetch}
        />
      )}
    </View>
  );
}
```

---

**Total Services**: 4+
**Total Hooks**: 4+
**Ready for Integration**: Yes
**Last Updated**: 2025-11-14
