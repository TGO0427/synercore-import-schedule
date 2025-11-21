import axios, { AxiosInstance, AxiosError } from 'axios';
import { authService } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
console.log('🔗 API Service initialized with API_URL:', API_URL);
console.log('📝 EXPO_PUBLIC_API_URL env:', process.env.EXPO_PUBLIC_API_URL);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  origin: string;
  destination: string;
  weight: number;
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
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface ShipmentFilters {
  status?: string;
  origin?: string;
  destination?: string;
  searchTerm?: string;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      async (config: any) => {
        const token = await authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response: any) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired - let auth service handle it
          await authService.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== SHIPMENTS ====================

  async getShipments(
    filters?: ShipmentFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<Shipment>> {
    try {
      const response = await this.api.get<ApiResponse<PaginatedResponse<Shipment>>>(
        '/shipments',
        {
          params: {
            ...filters,
            page,
            pageSize,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getShipmentDetail(id: string): Promise<Shipment> {
    try {
      const response = await this.api.get<ApiResponse<Shipment>>(`/shipments/${id}`);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateShipmentStatus(
    id: string,
    data: { status: string; notes?: string }
  ): Promise<Shipment> {
    try {
      const response = await this.api.put<ApiResponse<Shipment>>(`/shipments/${id}/status`, data);
      return response.data.data;
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
        type: file.type,
      } as any);

      const response = await this.api.post<
        ApiResponse<{ success: boolean; documentId: string }>
      >(`/shipments/${shipmentId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getShipmentDocuments(
    shipmentId: string
  ): Promise<Array<{ id: string; name: string; size: number; type: string }>> {
    try {
      const response = await this.api.get<
        ApiResponse<Array<{ id: string; name: string; size: number; type: string }>>
      >(`/shipments/${shipmentId}/documents`);

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== PRODUCTS ====================

  async getProducts(
    filters?: any,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<any>> {
    try {
      const response = await this.api.get<ApiResponse<PaginatedResponse<any>>>(
        '/products',
        {
          params: {
            ...filters,
            page,
            pageSize,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProductDetail(id: string): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>(`/products/${id}`);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== WAREHOUSE ====================

  async getWarehouseStatus(): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/warehouse/status');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWarehouseCapacity(): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/warehouse/capacity');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== REPORTS ====================

  async getReports(type: string, filters?: any): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>(`/reports/${type}`, {
        params: filters,
      });

      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateReport(type: string, filters?: any): Promise<any> {
    try {
      const response = await this.api.post<ApiResponse<any>>(
        `/reports/${type}/generate`,
        filters
      );
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== ADMIN ====================

  async getAdminDashboard(): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/admin/dashboard');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUsers(filters?: any, page: number = 1, pageSize: number = 20): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/admin/users', {
        params: { ...filters, page, pageSize },
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== USER PROFILE ====================

  async getProfile(): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/auth/profile');
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(data: any): Promise<any> {
    try {
      const response = await this.api.put<ApiResponse<any>>('/auth/profile', data);
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== NOTIFICATIONS ====================

  async registerDeviceToken(token: string): Promise<void> {
    try {
      await this.api.post('/notifications/device-token', {
        token,
        platform: 'expo',
      });
    } catch (error) {
      console.warn('Failed to register device token:', error);
    }
  }

  async getNotifications(page: number = 1, pageSize: number = 50): Promise<any> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/notifications', {
        params: { page, pageSize },
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await this.api.put(`/notifications/${id}/read`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async dismissNotification(id: string): Promise<void> {
    try {
      await this.api.delete(`/notifications/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== PASSWORD RESET ====================

  async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post<ApiResponse<{ success: boolean; message: string }>>('/auth/forgot-password', { email });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(token: string, email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post<ApiResponse<{ success: boolean; message: string }>>('/auth/reset-password', {
        token,
        email,
        password: newPassword,
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post<ApiResponse<{ success: boolean; message: string }>>('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return response.data.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ==================== ERROR HANDLING ====================

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      // Network error
      if (!error.response) {
        return new Error('Network error. Please check your connection.');
      }

      // Server error with message
      if (error.response?.data?.message) {
        return new Error(error.response.data.message);
      }

      // HTTP status errors
      switch (error.response?.status) {
        case 400:
          return new Error('Invalid request. Please check your input.');
        case 401:
          return new Error('Unauthorized. Please login again.');
        case 403:
          return new Error('You do not have permission to perform this action.');
        case 404:
          return new Error('Resource not found.');
        case 500:
          return new Error('Server error. Please try again later.');
        default:
          return new Error(`Error: ${error.response?.status}`);
      }
    }

    return new Error(error?.message || 'An unexpected error occurred');
  }
}

export const apiService = new ApiService();
