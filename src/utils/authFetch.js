// Authenticated fetch utility with automatic token refresh and retry logic
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

// Connection state — components can listen to these events
let connectionLost = false;

function dispatchConnectionEvent(type) {
  if (type === 'lost' && !connectionLost) {
    connectionLost = true;
    window.dispatchEvent(new CustomEvent('connection-lost'));
  } else if (type === 'restored' && connectionLost) {
    connectionLost = false;
    window.dispatchEvent(new CustomEvent('connection-restored'));
  }
}

/** Returns true if the error/status is retryable (network failure or server error) */
function isRetryable(error, response) {
  if (error instanceof TypeError) return true; // Network error
  if (!response) return true;
  return response.status === 502 || response.status === 503 || response.status === 504;
}

/**
 * Wrapper around fetch that automatically adds authentication headers,
 * handles token refresh on 401 responses, and retries on network/server errors.
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;
  let lastError = null;
  let response = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...authUtils.getAuthHeader()
        }
      });

      // If response is OK or a client error (4xx), don't retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        dispatchConnectionEvent('restored');
        break;
      }

      // Server error — retryable
      if (isRetryable(null, response)) {
        lastError = new Error(`Server error ${response.status}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, attempt - 1)));
          continue;
        }
        dispatchConnectionEvent('lost');
      } else {
        break;
      }
    } catch (error) {
      lastError = error;
      if (isRetryable(error, null) && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, attempt - 1)));
        continue;
      }
      if (isRetryable(error, null)) {
        dispatchConnectionEvent('lost');
      }
      throw error;
    }
  }

  // Handle 401 Unauthorized or 403 Forbidden (expired access token)
  if (response && (response.status === 401 || response.status === 403) && authUtils.getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const newToken = await authUtils.refreshToken();
        isRefreshing = false;

        if (newToken) {
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
          window.location.href = '/login';
        }
      } catch (error) {
        isRefreshing = false;
        console.error('Token refresh error:', error);
        window.location.href = '/login';
      }
    } else {
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
