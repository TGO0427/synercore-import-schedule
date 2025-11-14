import { storage } from '@/utils/storage';
import { apiService } from './api-service';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  private user: User | null = null;
  private token: string | null = null;

  /**
   * Initialize auth service by loading stored user and token
   */
  async initialize(): Promise<void> {
    try {
      const [storedToken, storedUserJson] = await Promise.all([
        storage.getItem('authToken'),
        storage.getItem('user'),
      ]);

      this.token = storedToken;
      if (storedUserJson) {
        this.user = JSON.parse(storedUserJson);
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.user = null;
      this.token = null;
    }
  }

  /**
   * Get current user
   */
  async getUser(): Promise<User | null> {
    if (!this.user && this.token) {
      // Try to restore from storage
      try {
        const userJson = await storage.getItem('user');
        if (userJson) {
          this.user = JSON.parse(userJson);
        }
      } catch (error) {
        console.error('Failed to get user:', error);
      }
    }
    return this.user;
  }

  /**
   * Get current token
   */
  async getToken(): Promise<string | null> {
    if (!this.token) {
      try {
        this.token = await storage.getItem('authToken');
      } catch (error) {
        console.error('Failed to get token:', error);
      }
    }
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await apiService.login(email, password);

    if (response.success && response.data) {
      this.token = response.data.token;
      this.user = response.data.user;

      // Store in local storage
      await Promise.all([
        storage.setItem('authToken', response.data.token),
        storage.setItem('user', JSON.stringify(response.data.user)),
      ]);

      return response.data;
    }

    throw new Error(response.error || 'Login failed');
  }

  /**
   * Register new account
   */
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await apiService.register(name, email, password);

    if (response.success && response.data) {
      this.token = response.data.token;
      this.user = response.data.user;

      // Store in local storage
      await Promise.all([
        storage.setItem('authToken', response.data.token),
        storage.setItem('user', JSON.stringify(response.data.user)),
      ]);

      return response.data;
    }

    throw new Error(response.error || 'Registration failed');
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if backend requires it
      // await apiService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear local state
      this.user = null;
      this.token = null;

      // Clear storage
      await Promise.all([
        storage.removeItem('authToken'),
        storage.removeItem('user'),
      ]);
    }
  }

  /**
   * Refresh auth token (if backend supports it)
   */
  async refreshToken(): Promise<string | null> {
    try {
      // This would call your refresh endpoint
      // For now, just return current token
      return this.token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await this.logout();
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    if (!this.user) {
      throw new Error('User not authenticated');
    }

    this.user = { ...this.user, ...updates };

    await storage.setItem('user', JSON.stringify(this.user));

    return this.user;
  }
}

// Export singleton instance
export const authService = new AuthService();
