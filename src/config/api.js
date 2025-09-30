// API configuration for development and production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const getApiUrl = (endpoint) => {
  // In production, use the full Railway URL
  if (API_BASE_URL) {
    return `${API_BASE_URL}${endpoint}`;
  }

  // In development, use relative paths (proxied by Vite)
  return endpoint;
};

export { API_BASE_URL };