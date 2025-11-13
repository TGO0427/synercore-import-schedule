// Authentication utilities with token refresh support

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
const USER_KEY = 'auth_user';

// For backwards compatibility
const LEGACY_TOKEN_KEY = 'auth_token';

let tokenRefreshTimeout = null;

export const authUtils = {
  // Store tokens and user in localStorage
  setAuth(accessToken, refreshToken, user, expiresIn = 900) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Calculate expiry time (add slight buffer to refresh before actual expiry)
    const expiryTime = Date.now() + (expiresIn - 60) * 1000; // Refresh 60 seconds before expiry
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime);

    // Schedule automatic token refresh
    this.scheduleTokenRefresh(expiresIn);
  },

  // Get stored access token
  getToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  },

  // Get stored refresh token
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // Get stored user
  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  },

  // Check if access token is expired
  isTokenExpired() {
    const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryTime) return true;
    return Date.now() >= parseInt(expiryTime);
  },

  // Refresh access token using refresh token
  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuth();
      return null;
    }

    try {
      const response = await fetch(import.meta.env.VITE_API_BASE_URL + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        // Refresh token invalid or expired
        this.clearAuth();
        return null;
      }

      const data = await response.json();
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);

      // Schedule next refresh
      const expiryTime = Date.now() + (data.expiresIn - 60) * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime);
      this.scheduleTokenRefresh(data.expiresIn);

      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth();
      return null;
    }
  },

  // Schedule automatic token refresh
  scheduleTokenRefresh(expiresIn) {
    // Clear previous timeout
    if (tokenRefreshTimeout) {
      clearTimeout(tokenRefreshTimeout);
    }

    // Schedule refresh 60 seconds before expiry
    const refreshTime = (expiresIn - 60) * 1000;
    tokenRefreshTimeout = setTimeout(() => {
      if (this.isAuthenticated()) {
        this.refreshToken();
      }
    }, refreshTime);
  },

  // Clear auth data (logout)
  async clearAuth() {
    const refreshToken = this.getRefreshToken();

    // Revoke refresh token on server
    if (refreshToken && this.getToken()) {
      try {
        await fetch(import.meta.env.VITE_API_BASE_URL + '/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`
          },
          body: JSON.stringify({ refreshToken })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Clear tokens and user data
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);

    // Clear legacy keys for backwards compatibility
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');

    // Clear any pending token refresh
    if (tokenRefreshTimeout) {
      clearTimeout(tokenRefreshTimeout);
    }
  },

  // Get authorization header
  getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
};
