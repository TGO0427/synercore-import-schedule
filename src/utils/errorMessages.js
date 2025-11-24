/**
 * Frontend error messages - user-friendly error handling
 */

export const frontendErrors = {
  // API errors
  API_ERROR: 'Failed to connect to the server. Please check your internet connection.',
  API_TIMEOUT: 'The request took too long. Please try again.',
  API_NOT_FOUND: 'The requested resource could not be found.',
  API_UNAUTHORIZED: 'Your session has expired. Please log in again.',
  API_FORBIDDEN: 'You do not have permission to access this resource.',
  API_VALIDATION_ERROR: 'Please check your input and try again.',
  API_CONFLICT: 'This record already exists. Please use a different value.',
  API_RATE_LIMITED: 'You are making requests too quickly. Please wait a moment.',
  API_SERVER_ERROR: 'A server error occurred. Please try again later.',

  // Shipment errors
  SHIPMENT_LOAD_ERROR: 'Failed to load shipments. Please refresh the page.',
  SHIPMENT_CREATE_ERROR: 'Failed to create shipment. Please try again.',
  SHIPMENT_UPDATE_ERROR: 'Failed to update shipment. Please try again.',
  SHIPMENT_DELETE_ERROR: 'Failed to delete shipment. Please try again.',
  SHIPMENT_ARCHIVE_ERROR: 'Failed to archive shipment. Please try again.',

  // Supplier errors
  SUPPLIER_LOAD_ERROR: 'Failed to load suppliers. Please refresh the page.',

  // Form errors
  FORM_VALIDATION_ERROR: 'Please check your input and try again.',
  FORM_SUBMIT_ERROR: 'Failed to submit form. Please try again.',

  // File upload errors
  FILE_UPLOAD_ERROR: 'Failed to upload file. Please try again.',
  FILE_SIZE_ERROR: 'File is too large. Maximum size is 10MB.',
  FILE_TYPE_ERROR: 'File type is not supported. Please upload a valid file.',

  // Auth errors
  LOGIN_ERROR: 'Invalid username or password.',
  LOGOUT_ERROR: 'Failed to log out. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',

  // Generic errors
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  RETRY_MESSAGE: 'Please try again or contact support if the problem persists.',
};

/**
 * Map API error response to user-friendly message
 * @param {object} error - Axios error object
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
  if (!error) return frontendErrors.UNEXPECTED_ERROR;

  // Network error (no response)
  if (!error.response) {
    return frontendErrors.NETWORK_ERROR;
  }

  const status = error.response.status;
  const data = error.response.data;

  // Custom error message from backend
  if (data?.userMessage) {
    return data.userMessage;
  }

  // Custom error message from backend
  if (data?.message) {
    return data.message;
  }

  // HTTP status codes
  switch (status) {
    case 400:
      return frontendErrors.API_VALIDATION_ERROR;
    case 401:
      return frontendErrors.API_UNAUTHORIZED;
    case 403:
      return frontendErrors.API_FORBIDDEN;
    case 404:
      return frontendErrors.API_NOT_FOUND;
    case 409:
      return frontendErrors.API_CONFLICT;
    case 422:
      return frontendErrors.FORM_VALIDATION_ERROR;
    case 429:
      return frontendErrors.API_RATE_LIMITED;
    case 500:
      return frontendErrors.API_SERVER_ERROR;
    case 502:
    case 503:
      return 'The service is temporarily unavailable. Please try again later.';
    case 504:
      return frontendErrors.API_TIMEOUT;
    default:
      return frontendErrors.UNEXPECTED_ERROR;
  }
}

/**
 * Extract field errors from validation response
 * @param {object} error - Axios error object
 * @returns {object} Field errors keyed by field name
 */
export function getFieldErrors(error) {
  if (!error?.response?.data?.details) {
    return {};
  }

  const details = error.response.data.details;

  if (Array.isArray(details.fields)) {
    // Convert array of field errors to object
    return details.fields.reduce((acc, field) => {
      acc[field.field] = field.message;
      return acc;
    }, {});
  }

  return details.fields || {};
}

/**
 * Show toast notification for error
 * @param {object} error - Error object
 * @param {function} toastFn - Toast function (e.g., from react-toastify)
 */
export function showErrorToast(error, toastFn) {
  if (!toastFn) return;

  const message = getErrorMessage(error);
  toastFn(message, { type: 'error' });
}

/**
 * Log error with context
 * @param {string} context - Where error occurred
 * @param {object} error - Error object
 */
export function logErrorWithContext(context, error) {
  console.error(`[${context}]`, {
    message: error?.message,
    status: error?.response?.status,
    data: error?.response?.data,
    stack: error?.stack,
  });
}

/**
 * Check if error is due to authentication
 * @param {object} error - Axios error object
 * @returns {boolean} True if auth error
 */
export function isAuthError(error) {
  return error?.response?.status === 401 || error?.response?.status === 403;
}

/**
 * Check if error is due to validation
 * @param {object} error - Axios error object
 * @returns {boolean} True if validation error
 */
export function isValidationError(error) {
  return error?.response?.status === 422 || error?.response?.status === 400;
}

/**
 * Check if error is due to network
 * @param {object} error - Error object
 * @returns {boolean} True if network error
 */
export function isNetworkError(error) {
  return !error?.response || error?.message === 'Network Error';
}

export default frontendErrors;
