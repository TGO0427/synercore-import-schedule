// Authenticated fetch utility
import { authUtils } from './auth';

/**
 * Wrapper around fetch that automatically adds authentication headers
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>}
 */
export function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authUtils.getAuthHeader()
    }
  });
}
