/**
 * Centralized API client for all backend endpoints
 * Handles authentication, error handling, and request/response interceptors
 */

import { authUtils } from '../utils/auth';
import { getApiUrl } from '../config/api';

const API_BASE = getApiUrl();

// Token refresh state management
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

/**
 * Wrapper around fetch with authentication and error handling
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function request(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...authUtils.getAuthHeader()
    },
    credentials: 'include'
  });

  // Handle 401/403 (expired access token)
  if ((response.status === 401 || response.status === 403) && authUtils.getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const newToken = await authUtils.refreshToken();
        isRefreshing = false;

        if (newToken) {
          onTokenRefreshed(newToken);

          // Retry with new token
          response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...options.headers,
              ...authUtils.getAuthHeader()
            },
            credentials: 'include'
          });
        } else {
          window.location.href = '/login';
        }
      } catch (error) {
        isRefreshing = false;
        console.error('Token refresh error:', error);
        window.location.href = '/login';
      }
    } else {
      // Wait for refresh to complete
      await new Promise(resolve => {
        subscribeTokenRefresh(() => {
          resolve();
        });
      });

      // Retry with new token
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          ...authUtils.getAuthHeader()
        },
        credentials: 'include'
      });
    }
  }

  return response;
}

/**
 * Helper to parse JSON response and handle errors
 */
async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ============ AUTHENTICATION ENDPOINTS ============
export const authAPI = {
  setup: (data) => request(`${API_BASE}/api/auth/setup`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  register: (data) => request(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  login: (username, password) => request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }).then(handleResponse),

  logout: () => request(`${API_BASE}/api/auth/logout`, {
    method: 'POST'
  }).then(handleResponse),

  getCurrentUser: () => request(`${API_BASE}/api/auth/me`, {
    method: 'GET'
  }).then(handleResponse),

  refreshToken: () => request(`${API_BASE}/api/auth/refresh`, {
    method: 'POST'
  }).then(handleResponse),

  changePassword: (currentPassword, newPassword) => request(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  }).then(handleResponse),

  forgotPassword: (email) => request(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email })
  }).then(handleResponse),

  resetPassword: (email, token, password) => request(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ email, token, password })
  }).then(handleResponse),

  // Admin endpoints
  createUser: (data) => request(`${API_BASE}/api/auth/admin/create-user`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  listUsers: () => request(`${API_BASE}/api/auth/admin/users`, {
    method: 'GET'
  }).then(handleResponse),

  updateUser: (userId, data) => request(`${API_BASE}/api/auth/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }).then(handleResponse),

  deleteUser: (userId) => request(`${API_BASE}/api/auth/admin/users/${userId}`, {
    method: 'DELETE'
  }).then(handleResponse),

  adminResetPassword: (userId, newPassword) => request(`${API_BASE}/api/auth/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password: newPassword })
  }).then(handleResponse)
};

// ============ SHIPMENT ENDPOINTS ============
export const shipmentAPI = {
  getAll: (statusFilter = null) => {
    const url = statusFilter
      ? `${API_BASE}/api/shipments/status/${statusFilter}`
      : `${API_BASE}/api/shipments`;
    return request(url, { method: 'GET' }).then(handleResponse);
  },

  getById: (id) => request(`${API_BASE}/api/shipments/${id}`, {
    method: 'GET'
  }).then(handleResponse),

  create: (data) => request(`${API_BASE}/api/shipments`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  update: (id, data) => request(`${API_BASE}/api/shipments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }).then(handleResponse),

  delete: (id) => request(`${API_BASE}/api/shipments/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),

  bulkImport: (data) => request(`${API_BASE}/api/shipments/bulk-import`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  getArchived: () => request(`${API_BASE}/api/shipments/archives`, {
    method: 'GET'
  }).then(handleResponse),

  manualArchive: (id) => request(`${API_BASE}/api/shipments/manual-archive`, {
    method: 'POST',
    body: JSON.stringify({ shipmentId: id })
  }).then(handleResponse),

  getDelayed: () => request(`${API_BASE}/api/shipments/delayed/list`, {
    method: 'GET'
  }).then(handleResponse),

  // Workflow operations
  startUnloading: (id) => request(`${API_BASE}/api/shipments/${id}/start-unloading`, {
    method: 'POST'
  }).then(handleResponse),

  completeUnloading: (id, data) => request(`${API_BASE}/api/shipments/${id}/complete-unloading`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  startInspection: (id) => request(`${API_BASE}/api/shipments/${id}/start-inspection`, {
    method: 'POST'
  }).then(handleResponse),

  completeInspection: (id, data) => request(`${API_BASE}/api/shipments/${id}/complete-inspection`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  startReceiving: (id) => request(`${API_BASE}/api/shipments/${id}/start-receiving`, {
    method: 'POST'
  }).then(handleResponse),

  completeReceiving: (id, data) => request(`${API_BASE}/api/shipments/${id}/complete-receiving`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  markStored: (id, data) => request(`${API_BASE}/api/shipments/${id}/mark-stored`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  rejectShipment: (id, reason) => request(`${API_BASE}/api/shipments/${id}/reject-shipment`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }).then(handleResponse)
};

// ============ SUPPLIER ENDPOINTS ============
export const supplierAPI = {
  getAll: () => request(`${API_BASE}/api/suppliers`, {
    method: 'GET'
  }).then(handleResponse),

  getById: (id) => request(`${API_BASE}/api/suppliers/${id}`, {
    method: 'GET'
  }).then(handleResponse),

  create: (data) => request(`${API_BASE}/api/suppliers`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  update: (id, data) => request(`${API_BASE}/api/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }).then(handleResponse),

  delete: (id) => request(`${API_BASE}/api/suppliers/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),

  downloadDocument: (supplierId, fileName) => `${API_BASE}/api/suppliers/${supplierId}/documents/${fileName}`
};

// ============ DOCUMENT ENDPOINTS ============
export const documentAPI = {
  upload: (formData) => request(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData,
    headers: {} // Let browser set Content-Type for multipart/form-data
  }).then(handleResponse),

  uploadExcel: (formData) => request(`${API_BASE}/api/upload-excel`, {
    method: 'POST',
    body: formData,
    headers: {}
  }).then(handleResponse)
};

// ============ WAREHOUSE ENDPOINTS ============
export const warehouseAPI = {
  getCapacity: () => request(`${API_BASE}/api/warehouse-capacity`, {
    method: 'GET'
  }).then(handleResponse)
};

// ============ NOTIFICATION ENDPOINTS ============
export const notificationAPI = {
  getAll: () => request(`${API_BASE}/api/notifications`, {
    method: 'GET'
  }).then(handleResponse),

  markAsRead: (id) => request(`${API_BASE}/api/notifications/${id}/read`, {
    method: 'POST'
  }).then(handleResponse),

  markAllAsRead: () => request(`${API_BASE}/api/notifications/read-all`, {
    method: 'POST'
  }).then(handleResponse),

  getPreferences: () => request(`${API_BASE}/api/notifications/preferences`, {
    method: 'GET'
  }).then(handleResponse),

  updatePreferences: (data) => request(`${API_BASE}/api/notifications/preferences`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }).then(handleResponse)
};

// ============ REPORTS ENDPOINTS ============
export const reportAPI = {
  getShipmentMetrics: () => request(`${API_BASE}/api/reports/shipment-metrics`, {
    method: 'GET'
  }).then(handleResponse),

  getSupplierMetrics: () => request(`${API_BASE}/api/reports/supplier-metrics`, {
    method: 'GET'
  }).then(handleResponse),

  getWarehouseMetrics: () => request(`${API_BASE}/api/reports/warehouse-metrics`, {
    method: 'GET'
  }).then(handleResponse),

  getAdvancedReports: (data) => request(`${API_BASE}/api/reports/advanced`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse)
};

// ============ QUOTES ENDPOINTS ============
export const quoteAPI = {
  getAll: () => request(`${API_BASE}/api/quotes`, {
    method: 'GET'
  }).then(handleResponse),

  getById: (id) => request(`${API_BASE}/api/quotes/${id}`, {
    method: 'GET'
  }).then(handleResponse),

  create: (data) => request(`${API_BASE}/api/quotes`, {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(handleResponse),

  update: (id, data) => request(`${API_BASE}/api/quotes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }).then(handleResponse),

  delete: (id) => request(`${API_BASE}/api/quotes/${id}`, {
    method: 'DELETE'
  }).then(handleResponse)
};

export default {
  authAPI,
  shipmentAPI,
  supplierAPI,
  documentAPI,
  warehouseAPI,
  notificationAPI,
  reportAPI,
  quoteAPI
};
