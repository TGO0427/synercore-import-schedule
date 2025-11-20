/**
 * Zustand store for authentication state
 * Centralizes all auth-related state and actions
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';

/**
 * Auth store state interface
 */
export interface AuthState {
  // State
  isAuthenticated: boolean;
  username: string;
  userId: string;
  userRole: string;
  error: string | null;
  loading: boolean;

  // Actions - Login/Logout
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  register: (username: string, email: string, password: string, fullName: string) => Promise<any>;

  // Actions - Password Management
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<void>;

  // Actions - Token Refresh
  refreshToken: () => Promise<string>;

  // Actions - Initialize
  initialize: () => void;

  // Actions - UI
  clearError: () => void;
}

/**
 * Helper function for API calls
 */
const apiCall = async (url: string, options: RequestInit = {}): Promise<any> => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Zustand store for auth state
 */
export const useAuthStore = create<AuthState>(
  persist(
    devtools(
      (set) => ({
        // State
        isAuthenticated: false,
        username: '',
        userId: '',
        userRole: 'user',
        error: null,
        loading: false,

        // Actions - Login/Logout
        login: async (username: string, password: string) => {
          set({ loading: true, error: null });
          try {
            const data = await apiCall(`${getApiUrl()}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });

            // Store tokens using auth utility
            authUtils.setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken);

            set({
              isAuthenticated: true,
              username: data.data.user?.username || username,
              userId: data.data.user?.id || '',
              userRole: data.data.user?.role || 'user',
              loading: false
            });

            return data;
          } catch (error: any) {
            set({
              error: error.message,
              loading: false,
              isAuthenticated: false
            });
            throw error;
          }
        },

        logout: () => {
          authUtils.clearTokens();
          set({
            isAuthenticated: false,
            username: '',
            userId: '',
            userRole: 'user',
            error: null
          });
        },

        register: async (username: string, email: string, password: string, fullName: string) => {
          set({ loading: true, error: null });
          try {
            const data = await apiCall(`${getApiUrl()}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                email,
                password,
                fullName
              })
            });

            // Automatically log in after registration
            authUtils.setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken);

            set({
              isAuthenticated: true,
              username: data.data.user?.username || username,
              userId: data.data.user?.id || '',
              userRole: data.data.user?.role || 'user',
              loading: false
            });

            return data;
          } catch (error: any) {
            set({
              error: error.message,
              loading: false
            });
            throw error;
          }
        },

        // Actions - Password Management
        changePassword: async (currentPassword: string, newPassword: string) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/change-password`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...authUtils.getAuthHeader()
              },
              body: JSON.stringify({
                currentPassword,
                newPassword
              })
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        forgotPassword: async (email: string) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/forgot-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        resetPassword: async (email: string, token: string, newPassword: string) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                token,
                newPassword
              })
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        // Actions - Token Refresh
        refreshToken: async () => {
          try {
            const refreshToken = authUtils.getRefreshToken();
            if (!refreshToken) throw new Error('No refresh token');

            const data = await apiCall(`${getApiUrl()}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            });

            authUtils.setTokens(data.data.tokens.accessToken, data.data.tokens.refreshToken);
            return data.data.tokens.accessToken;
          } catch (error: any) {
            // If refresh fails, logout
            set({ isAuthenticated: false });
            throw error;
          }
        },

        // Actions - Initialize (check if already logged in)
        initialize: () => {
          const token = authUtils.getAccessToken();
          if (token) {
            set({ isAuthenticated: true });
          }
        },

        // Actions - UI
        clearError: () => set({ error: null })
      }),
      {
        name: 'AuthStore'
      }
    ),
    {
      name: 'AuthStore',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        username: state.username,
        userId: state.userId,
        userRole: state.userRole
      })
    }
  )
);

export default useAuthStore;
