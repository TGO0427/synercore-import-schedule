import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { storage } from '@/utils/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
console.log('🔗 Auth Service initialized with API_URL:', API_URL);
console.log('📝 EXPO_PUBLIC_API_URL env var:', process.env.EXPO_PUBLIC_API_URL);
const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'user' | 'admin' | 'supplier';
  avatar?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  expiresIn?: number;
  refreshToken?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

class AuthService {
  private api: AxiosInstance;
  private token: string | null = null;
  private user: User | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;

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
    // Request interceptor - add auth header
    this.api.interceptors.request.use(
      async (config: any) => {
        const token = this.token || (await this.getToken());
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor - handle 401 and token refresh
    this.api.interceptors.response.use(
      (response: any) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Token expired - try to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed - logout
            await this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      const token = await this.getToken();
      const user = await this.getUser();

      if (token && user) {
        this.token = token;
        this.user = user;
        this.scheduleTokenRefresh();
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('🔐 Login attempt:', { username: email, API_URL });
      // Backend expects 'username' field, so we use email as username
      const response = await this.api.post<any>('/auth/login', {
        username: email,
        password,
      });
      console.log('✅ Login successful:', response.data.user.username);

      const { accessToken } = response.data;
      // Map backend user response to User interface
      const user: User = {
        id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.fullName || response.data.user.username,
        role: response.data.user.role,
      };

      this.token = accessToken;
      this.user = user;

      // Store securely
      await this.storeToken(accessToken);
      await this.storeUser(user);

      // Schedule token refresh
      this.scheduleTokenRefresh(response.data.expiresIn);

      return {
        accessToken,
        user,
        expiresIn: response.data.expiresIn,
      };
    } catch (error) {
      console.error('❌ Login error:', error);
      if (axios.isAxiosError(error)) {
        console.error('📡 Response status:', error.response?.status);
        console.error('📡 Response data:', error.response?.data);
        console.error('📡 Request URL:', error.config?.url);
        console.error('📡 Request baseURL:', error.config?.baseURL);
      }
      throw this.handleError(error);
    }
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      // Backend register endpoint expects username, not email as identifier
      const username = email.split('@')[0]; // Use part before @ as username
      const response = await this.api.post<any>('/auth/register', {
        username,
        email,
        password,
        fullName: name,
      });

      const { accessToken } = response.data;
      // Map backend user response to User interface
      const user: User = {
        id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.fullName || response.data.user.username,
        role: response.data.user.role,
      };

      this.token = accessToken;
      this.user = user;

      // Store securely
      await this.storeToken(accessToken);
      await this.storeUser(user);

      // Schedule token refresh
      this.scheduleTokenRefresh(response.data.expiresIn);

      return {
        accessToken,
        user,
        expiresIn: response.data.expiresIn,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint
      await this.api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout endpoint failed:', error);
    } finally {
      // Clear local state regardless of API call result
      this.token = null;
      this.user = null;

      // Clear storage
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      } catch (error) {
        console.warn('Failed to clear secure storage:', error);
      }

      // Also clear regular storage as fallback
      await storage.removeItem('authToken');
      await storage.removeItem('user');

      // Cancel token refresh
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
      }
    }
  }

  async refreshToken(): Promise<string> {
    try {
      const response = await this.api.post<{ token: string }>('/auth/refresh');
      const { token } = response.data;

      this.token = token;

      // Store token securely
      await this.storeToken(token);

      // Reschedule refresh
      this.scheduleTokenRefresh();

      return token;
    } catch (error) {
      // Refresh failed - logout
      await this.logout();
      throw this.handleError(error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.token) return this.token;

      // Try SecureStore first
      let token: string | null = null;

      try {
        token = await SecureStore.getItemAsync(TOKEN_KEY);
      } catch (error) {
        console.warn('Failed to get token from SecureStore:', error);
        // Fallback to regular storage
        token = await storage.getItem('authToken');
      }

      if (token) {
        this.token = token;
      }

      return token || null;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  async getUser(): Promise<User | null> {
    try {
      if (this.user) return this.user;

      // Try SecureStore first
      let userJson: string | null = null;

      try {
        userJson = await SecureStore.getItemAsync(USER_KEY);
      } catch (error) {
        console.warn('Failed to get user from SecureStore:', error);
        // Fallback to regular storage
        userJson = await storage.getItem('user');
      }

      if (userJson) {
        this.user = JSON.parse(userJson);
        return this.user;
      }

      return null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  getAuthHeader(): { Authorization?: string } {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` };
    }
    return {};
  }

  private async storeToken(token: string): Promise<void> {
    try {
      // Try SecureStore first
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } catch (error) {
        console.warn('Failed to store token in SecureStore:', error);
        // Fallback to regular storage
        await storage.setItem('authToken', token);
      }
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  private async storeUser(user: User): Promise<void> {
    try {
      // Try SecureStore first
      try {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      } catch (error) {
        console.warn('Failed to store user in SecureStore:', error);
        // Fallback to regular storage
        await storage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Failed to store user:', error);
    }
  }

  private scheduleTokenRefresh(expiresIn?: number): void {
    // Cancel existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Default to 14 minutes (15 minute token expiry - 1 minute buffer)
    const refreshIn = ((expiresIn || 900) * 1000) - 60000;

    this.refreshTimeout = setTimeout(() => {
      this.refreshToken().catch((error) => {
        console.error('Automatic token refresh failed:', error);
      });
    }, Math.max(refreshIn, 1000)) as unknown as NodeJS.Timeout;
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.message) {
        return new Error(error.response.data.message);
      }

      if (error.response?.status === 401) {
        return new Error('Invalid email or password');
      }

      if (error.response?.status === 400) {
        return new Error('Please check your input and try again');
      }

      if (error.message === 'Network Error') {
        return new Error('Network error. Please check your connection');
      }
    }

    return new Error(error?.message || 'Authentication failed');
  }
}

export const authService = new AuthService();
