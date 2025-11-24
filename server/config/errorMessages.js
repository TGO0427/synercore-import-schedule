/**
 * Standardized error messages for better user experience
 * Maps error types to human-friendly messages
 */

export const errorMessages = {
  // Authentication errors
  MISSING_TOKEN: {
    message: 'Please log in to continue',
    userMessage: 'Your session has expired. Please log in again.',
    code: 'AUTH_REQUIRED',
  },
  INVALID_TOKEN: {
    message: 'Your session is invalid or has expired',
    userMessage: 'Please log in again to continue.',
    code: 'AUTH_INVALID',
  },
  INSUFFICIENT_PERMISSIONS: {
    message: 'You do not have permission to perform this action',
    userMessage: 'You do not have permission to access this resource. Contact an administrator if you believe this is incorrect.',
    code: 'PERMISSION_DENIED',
  },

  // Shipment errors
  SHIPMENT_NOT_FOUND: {
    message: 'Shipment not found',
    userMessage: 'The shipment you are looking for does not exist or has been deleted.',
    code: 'SHIPMENT_NOT_FOUND',
  },
  SHIPMENT_UPDATE_FAILED: {
    message: 'Failed to update shipment',
    userMessage: 'Could not save the changes to this shipment. Please try again or contact support if the problem persists.',
    code: 'SHIPMENT_UPDATE_ERROR',
  },
  INVALID_SHIPMENT_STATUS: {
    message: 'Invalid shipment status',
    userMessage: 'The status you selected is not valid. Please choose a valid status.',
    code: 'INVALID_STATUS',
  },
  DUPLICATE_SHIPMENT: {
    message: 'A shipment with this order reference already exists',
    userMessage: 'A shipment with this order reference already exists. Please use a different order reference or update the existing shipment.',
    code: 'DUPLICATE_SHIPMENT',
  },

  // Supplier errors
  SUPPLIER_NOT_FOUND: {
    message: 'Supplier not found',
    userMessage: 'The supplier you are looking for does not exist.',
    code: 'SUPPLIER_NOT_FOUND',
  },
  INVALID_SUPPLIER: {
    message: 'Invalid supplier data',
    userMessage: 'The supplier information is invalid. Please check your input and try again.',
    code: 'INVALID_SUPPLIER',
  },

  // Database errors
  DATABASE_ERROR: {
    message: 'Database error',
    userMessage: 'A database error occurred. Please try again later. If the problem persists, contact support.',
    code: 'DB_ERROR',
  },
  DATABASE_CONNECTION_ERROR: {
    message: 'Cannot connect to database',
    userMessage: 'The system is unable to connect to the database. Please try again in a few moments.',
    code: 'DB_CONNECTION_ERROR',
  },

  // Validation errors
  VALIDATION_ERROR: {
    message: 'Validation failed',
    userMessage: 'Please check your input and try again.',
    code: 'VALIDATION_ERROR',
  },
  MISSING_REQUIRED_FIELD: {
    message: 'Required field is missing',
    userMessage: 'Please fill in all required fields.',
    code: 'MISSING_FIELD',
  },
  INVALID_INPUT: {
    message: 'Invalid input',
    userMessage: 'The information you provided is invalid. Please check your input and try again.',
    code: 'INVALID_INPUT',
  },

  // File upload errors
  FILE_UPLOAD_ERROR: {
    message: 'File upload failed',
    userMessage: 'Could not upload the file. Please try again or contact support.',
    code: 'FILE_UPLOAD_ERROR',
  },
  FILE_TOO_LARGE: {
    message: 'File is too large',
    userMessage: 'The file you uploaded is too large. Maximum file size is 10MB.',
    code: 'FILE_SIZE_ERROR',
  },
  INVALID_FILE_TYPE: {
    message: 'Invalid file type',
    userMessage: 'The file type is not supported. Please upload a valid file.',
    code: 'FILE_TYPE_ERROR',
  },

  // Rate limiting errors
  RATE_LIMITED: {
    message: 'Too many requests',
    userMessage: 'You are making requests too quickly. Please wait a moment and try again.',
    code: 'RATE_LIMITED',
  },

  // Server errors
  INTERNAL_SERVER_ERROR: {
    message: 'Internal server error',
    userMessage: 'Something went wrong on our end. Please try again later.',
    code: 'INTERNAL_ERROR',
  },
  SERVICE_UNAVAILABLE: {
    message: 'Service temporarily unavailable',
    userMessage: 'The service is temporarily unavailable. Please try again in a few moments.',
    code: 'SERVICE_UNAVAILABLE',
  },

  // Network errors
  NETWORK_ERROR: {
    message: 'Network error',
    userMessage: 'There was a problem connecting to the server. Please check your internet connection and try again.',
    code: 'NETWORK_ERROR',
  },
  TIMEOUT_ERROR: {
    message: 'Request timeout',
    userMessage: 'The request took too long. Please try again.',
    code: 'TIMEOUT',
  },

  // Email errors
  EMAIL_SEND_ERROR: {
    message: 'Failed to send email',
    userMessage: 'Could not send the email. Please try again later.',
    code: 'EMAIL_ERROR',
  },

  // Generic error
  UNKNOWN_ERROR: {
    message: 'An unexpected error occurred',
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    code: 'UNKNOWN_ERROR',
  },
};

/**
 * Get user-friendly error message
 * @param {string} errorType - Error type key
 * @param {string} context - Additional context (optional)
 * @returns {object} Error message object
 */
export function getUserErrorMessage(errorType, context = '') {
  const error = errorMessages[errorType] || errorMessages.UNKNOWN_ERROR;
  return {
    ...error,
    userMessage: context ? `${error.userMessage} ${context}` : error.userMessage,
  };
}

/**
 * Convert HTTP status to user-friendly message
 * @param {number} statusCode - HTTP status code
 * @returns {object} Error message object
 */
export function getHttpErrorMessage(statusCode) {
  const httpMessages = {
    400: errorMessages.INVALID_INPUT,
    401: errorMessages.MISSING_TOKEN,
    403: errorMessages.INSUFFICIENT_PERMISSIONS,
    404: errorMessages.SHIPMENT_NOT_FOUND,
    409: errorMessages.DUPLICATE_SHIPMENT,
    422: errorMessages.VALIDATION_ERROR,
    429: errorMessages.RATE_LIMITED,
    500: errorMessages.INTERNAL_SERVER_ERROR,
    502: errorMessages.SERVICE_UNAVAILABLE,
    503: errorMessages.SERVICE_UNAVAILABLE,
  };

  return httpMessages[statusCode] || errorMessages.UNKNOWN_ERROR;
}

export default errorMessages;
