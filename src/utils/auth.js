// Authentication utilities

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authUtils = {
  // Store token and user in localStorage
  setAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  // Get stored token
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
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

  // Clear auth data (logout)
  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Keep legacy keys for backwards compatibility
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
  },

  // Get authorization header
  getAuthHeader() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
};
