/**
 * Zustand store for authentication state
 * Centralizes all auth-related state and actions
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getApiUrl } from '../config/api';
import { authUtils } from '../utils/auth';

/**
 * Helper function for API calls
 */
const apiCall = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Zustand store for auth state
 */
export const useAuthStore = create(
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
        login: async (username, password) => {
          set({ loading: true, error: null });
          try {
            const data = await apiCall(`${getApiUrl()}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
            });

            // Store tokens using auth utility
            authUtils.setTokens(data.accessToken, data.refreshToken);

            set({
              isAuthenticated: true,
              username: data.user?.username || username,
              userId: data.user?.id || '',
              userRole: data.user?.role || 'user',
              loading: false,
            });

            return data;
          } catch (error) {
            set({
              error: error.message,
              loading: false,
              isAuthenticated: false,
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
            error: null,
          });
        },

        register: async (username, email, password, fullName) => {
          set({ loading: true, error: null });
          try {
            const data = await apiCall(`${getApiUrl()}/api/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username,
                email,
                password,
                fullName,
              }),
            });

            // Automatically log in after registration
            authUtils.setTokens(data.accessToken, data.refreshToken);

            set({
              isAuthenticated: true,
              username: data.user?.username || username,
              userId: data.user?.id || '',
              userRole: data.user?.role || 'user',
              loading: false,
            });

            return data;
          } catch (error) {
            set({
              error: error.message,
              loading: false,
            });
            throw error;
          }
        },

        // Actions - Password Management
        changePassword: async (currentPassword, newPassword) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/change-password`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...authUtils.getAuthHeader(),
              },
              body: JSON.stringify({
                currentPassword,
                newPassword,
              }),
            });
          } catch (error) {
            set({ error: error.message });
            throw error;
          }
        },

        forgotPassword: async (email) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/forgot-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
          } catch (error) {
            set({ error: error.message });
            throw error;
          }
        },

        resetPassword: async (email, token, newPassword) => {
          set({ error: null });
          try {
            await apiCall(`${getApiUrl()}/api/auth/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                token,
                newPassword,
              }),
            });
          } catch (error) {
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
              body: JSON.stringify({ refreshToken }),
            });

            authUtils.setTokens(data.accessToken, data.refreshToken);
            return data.accessToken;
          } catch (error) {
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
        clearError: () => set({ error: null }),
      }),
      {
        name: 'AuthStore',
      }
    ),
    {
      name: 'AuthStore',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        username: state.username,
        userId: state.userId,
        userRole: state.userRole,
      }),
    }
  )
);

export default useAuthStore;
