// Authenticated fetch utility with automatic token refresh
import { authUtils } from './auth';

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
 * Wrapper around fetch that automatically adds authentication headers
 * and handles token refresh on 401 responses
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authUtils.getAuthHeader()
    }
  });

  // Handle 401 Unauthorized or 403 Forbidden (expired access token)
  if ((response.status === 401 || response.status === 403) && authUtils.getRefreshToken()) {
    console.log(`[authFetch] Got ${response.status}, attempting token refresh...`);

    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const newToken = await authUtils.refreshToken();
        isRefreshing = false;

        if (newToken) {
          console.log('[authFetch] Token refreshed successfully, retrying request...');
          onTokenRefreshed(newToken);

          // Retry the original request with new token
          response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              ...authUtils.getAuthHeader()
            }
          });
        } else {
          // Refresh token failed, user needs to login again
          console.warn('[authFetch] Token refresh returned null, redirecting to login');
          window.location.href = '/login';
        }
      } catch (error) {
        isRefreshing = false;
        console.error('[authFetch] Token refresh error:', error);
        window.location.href = '/login';
      }
    } else {
      console.log('[authFetch] Already refreshing, waiting for token...');
      // Wait for token refresh to complete
      await new Promise(resolve => {
        subscribeTokenRefresh(() => {
          resolve();
        });
      });

      // Retry with refreshed token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...authUtils.getAuthHeader()
        }
      });
    }
  }

  return response;
}
