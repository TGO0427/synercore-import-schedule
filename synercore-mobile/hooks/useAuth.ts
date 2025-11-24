import { useState, useEffect, useCallback } from 'react';
import { authService, User } from '@/services/auth';

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

/**
 * useAuth Hook
 * Manages authentication state and provides login/register/logout methods
 *
 * @returns {AuthState & AuthActions} Auth state and actions
 *
 * @example
 * const { isAuthenticated, user, login, logout, error } = useAuth();
 */
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
        await authService.initialize();
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
      const response = await authService.register(name, email, password);

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
