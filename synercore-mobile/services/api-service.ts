import { storage } from '@/utils/storage';
import { API_ENDPOINTS, API_TIMEOUT } from '@/config/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

class ApiService {
  private getAuthHeader = async (): Promise<{
    Authorization: string;
  } | null> => {
    try {
      const token = await storage.getItem('authToken');
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  };

  /**
   * Generic fetch method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: Record<string, any>;
      requiresAuth?: boolean;
      timeout?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      requiresAuth = false,
      timeout = API_TIMEOUT,
    } = options;

    try {
      // Build request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth header if required
      if (requiresAuth) {
        const authHeader = await this.getAuthHeader();
        if (authHeader) {
          Object.assign(headers, authHeader);
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Make request
      const response = await fetch(endpoint, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const responseData = await response.json();

      // Handle errors
      if (!response.ok) {
        console.error(`API Error [${response.status}]:`, responseData);
        return {
          success: false,
          error: responseData.message || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: responseData,
        statusCode: response.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('API Request Error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Authentication: Login
   */
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: { email, password },
    });

    // Store token if login successful
    if (response.success && response.data) {
      try {
        await storage.setItem('authToken', response.data.token);
        await storage.setItem(
          'user',
          JSON.stringify({
            id: response.data.user.id,
            name: response.data.user.name,
            email: response.data.user.email,
          })
        );
      } catch (error) {
        console.error('Failed to store auth data:', error);
      }
    }

    return response;
  }

  /**
   * Authentication: Register
   */
  async register(
    name: string,
    email: string,
    password: string
  ): Promise<ApiResponse<RegisterResponse>> {
    const response = await this.request<RegisterResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      {
        method: 'POST',
        body: { name, email, password },
      }
    );

    // Store token if registration successful
    if (response.success && response.data) {
      try {
        await storage.setItem('authToken', response.data.token);
        await storage.setItem(
          'user',
          JSON.stringify({
            id: response.data.user.id,
            name: response.data.user.name,
            email: response.data.user.email,
          })
        );
      } catch (error) {
        console.error('Failed to store auth data:', error);
      }
    }

    return response;
  }

  /**
   * Authentication: Logout
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
      requiresAuth: true,
    });

    // Clear stored auth data
    if (response.success) {
      try {
        await storage.removeItem('authToken');
        await storage.removeItem('user');
      } catch (error) {
        console.error('Failed to clear auth data:', error);
      }
    }

    return response;
  }

  /**
   * Get shipments list
   */
  async getShipments(
    params?: Record<string, string | number>
  ): Promise<ApiResponse<any[]>> {
    let url = API_ENDPOINTS.SHIPMENTS.LIST;
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      url = `${url}?${queryString}`;
    }

    return this.request<any[]>(url, {
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Get single shipment details
   */
  async getShipment(id: string): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.SHIPMENTS.DETAIL(id), {
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Update shipment
   */
  async updateShipment(id: string, data: Record<string, any>): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.SHIPMENTS.UPDATE(id), {
      method: 'PUT',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Get products list
   */
  async getProducts(params?: Record<string, string | number>): Promise<ApiResponse<any[]>> {
    let url = API_ENDPOINTS.PRODUCTS.LIST;
    if (params) {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      url = `${url}?${queryString}`;
    }

    return this.request<any[]>(url, {
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Get warehouse statistics
   */
  async getWarehouseStats(): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.WAREHOUSE.STATS, {
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.USER.PROFILE, {
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Update user profile
   */
  async updateUserProfile(data: Record<string, any>): Promise<ApiResponse<any>> {
    return this.request<any>(API_ENDPOINTS.USER.UPDATE, {
      method: 'PUT',
      body: data,
      requiresAuth: true,
    });
  }
}

// Export singleton instance
export const apiService = new ApiService();
