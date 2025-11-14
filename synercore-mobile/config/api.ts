/**
 * API Configuration
 * Update the BASE_URL to point to your backend server
 */

// Change this to your actual backend URL
export const BASE_URL = 'https://api.synercore.example.com';

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${BASE_URL}/api/auth/login`,
    REGISTER: `${BASE_URL}/api/auth/register`,
    LOGOUT: `${BASE_URL}/api/auth/logout`,
    REFRESH_TOKEN: `${BASE_URL}/api/auth/refresh`,
  },
  SHIPMENTS: {
    LIST: `${BASE_URL}/api/shipments`,
    DETAIL: (id: string) => `${BASE_URL}/api/shipments/${id}`,
    UPDATE: (id: string) => `${BASE_URL}/api/shipments/${id}`,
    CREATE: `${BASE_URL}/api/shipments`,
  },
  PRODUCTS: {
    LIST: `${BASE_URL}/api/products`,
    DETAIL: (id: string) => `${BASE_URL}/api/products/${id}`,
  },
  WAREHOUSE: {
    STATS: `${BASE_URL}/api/warehouse/stats`,
    ZONES: `${BASE_URL}/api/warehouse/zones`,
  },
  USER: {
    PROFILE: `${BASE_URL}/api/user/profile`,
    UPDATE: `${BASE_URL}/api/user/profile`,
  },
};

// API request timeout in milliseconds
export const API_TIMEOUT = 30000;

// Retry configuration
export const API_RETRY = {
  MAX_ATTEMPTS: 3,
  DELAY_MS: 1000,
};
