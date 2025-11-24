/**
 * Standardized Error Handling Utility
 *
 * This module provides consistent error handling patterns across all backend services.
 * Features:
 * - Structured error logging with context
 * - Error classification (network, validation, auth, server)
 * - Automatic error recovery recommendations
 * - Consistent error response formats
 * - Production-safe error messages
 */

import { logError, logWarn, logInfo } from './logger.js';

/**
 * Error Classification Types
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SERVER = 'SERVER',
  EXTERNAL_API = 'EXTERNAL_API',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Standard Error Response Format
 */
export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: Record<string, any>;
  };
}

/**
 * Service Error Class
 */
export class ServiceError extends Error {
  constructor(
    public type: ErrorType,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>,
    public code?: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Classifies an error and returns appropriate HTTP status code
 */
function classifyError(error: any): { type: ErrorType; statusCode: number } {
  // Check if it's already a ServiceError
  if (error instanceof ServiceError) {
    return { type: error.type, statusCode: error.statusCode };
  }

  const message = error?.message?.toLowerCase() || '';
  const code = error?.code?.toUpperCase() || '';

  // Network Errors
  if (message.includes('econnrefused') || message.includes('enotfound') || code.includes('ECONNREFUSED')) {
    return { type: ErrorType.NETWORK, statusCode: 503 };
  }

  // Validation Errors
  if (message.includes('validation') || message.includes('invalid') || code.includes('VALIDATION')) {
    return { type: ErrorType.VALIDATION, statusCode: 400 };
  }

  // Authentication Errors
  if (message.includes('unauthorized') || message.includes('invalid token') || code.includes('AUTH')) {
    return { type: ErrorType.AUTHENTICATION, statusCode: 401 };
  }

  // Authorization Errors
  if (message.includes('forbidden') || message.includes('permission denied')) {
    return { type: ErrorType.AUTHORIZATION, statusCode: 403 };
  }

  // Not Found Errors
  if (message.includes('not found') || message.includes('does not exist') || code.includes('NOT_FOUND')) {
    return { type: ErrorType.NOT_FOUND, statusCode: 404 };
  }

  // Conflict Errors
  if (message.includes('conflict') || message.includes('already exists') || code.includes('CONFLICT')) {
    return { type: ErrorType.CONFLICT, statusCode: 409 };
  }

  // Database Errors
  if (message.includes('database') || message.includes('query') || code.includes('SQLITE_CONSTRAINT')) {
    return { type: ErrorType.DATABASE, statusCode: 500 };
  }

  // External API Errors
  if (message.includes('api') || message.includes('timeout') || error?.response?.status) {
    return { type: ErrorType.EXTERNAL_API, statusCode: error?.response?.status || 502 };
  }

  // Default to server error
  return { type: ErrorType.SERVER, statusCode: 500 };
}

/**
 * Get user-facing error message (safe for production)
 */
function getUserFacingMessage(errorType: ErrorType): string {
  const messages: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: 'Network connection error. Please check your internet connection.',
    [ErrorType.VALIDATION]: 'Invalid input. Please check your data and try again.',
    [ErrorType.AUTHENTICATION]: 'Authentication failed. Please login again.',
    [ErrorType.AUTHORIZATION]: 'You do not have permission to perform this action.',
    [ErrorType.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorType.CONFLICT]: 'This resource already exists.',
    [ErrorType.SERVER]: 'An internal server error occurred. Please try again later.',
    [ErrorType.EXTERNAL_API]: 'External service error. Please try again later.',
    [ErrorType.DATABASE]: 'Database error. Please try again later.',
    [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again later.',
  };

  return messages[errorType] || messages[ErrorType.UNKNOWN];
}

/**
 * Get recovery recommendations
 */
function getRecoveryRecommendations(errorType: ErrorType): string[] {
  const recommendations: Record<ErrorType, string[]> = {
    [ErrorType.NETWORK]: [
      'Check your internet connection',
      'Verify the server is reachable',
      'Try again in a few moments',
    ],
    [ErrorType.VALIDATION]: [
      'Review the validation rules',
      'Check input data format',
      'Ensure all required fields are present',
    ],
    [ErrorType.AUTHENTICATION]: [
      'Clear your browser cache and cookies',
      'Login again with correct credentials',
      'Check if your account is active',
    ],
    [ErrorType.AUTHORIZATION]: [
      'Contact your administrator',
      'Verify your access permissions',
      'Use an account with appropriate privileges',
    ],
    [ErrorType.NOT_FOUND]: [
      'Verify the resource ID is correct',
      'Check if the resource has been deleted',
      'Refresh the page and try again',
    ],
    [ErrorType.CONFLICT]: [
      'Use a different identifier',
      'Update the existing resource instead of creating a new one',
    ],
    [ErrorType.SERVER]: [
      'Try again in a few moments',
      'Contact support if the issue persists',
      'Check the system status page',
    ],
    [ErrorType.EXTERNAL_API]: [
      'Check if the external service is available',
      'Try again in a few moments',
      'Contact support if the issue persists',
    ],
    [ErrorType.DATABASE]: [
      'Try again in a few moments',
      'Check database connectivity',
      'Contact your database administrator',
    ],
    [ErrorType.UNKNOWN]: [
      'Try the operation again',
      'Contact support if the issue persists',
    ],
  };

  return recommendations[errorType] || recommendations[ErrorType.UNKNOWN];
}

/**
 * Handle and log an error with context
 */
export function handleError(
  error: any,
  context: {
    service?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    details?: Record<string, any>;
  }
): ErrorResponse {
  const { type, statusCode } = classifyError(error);
  const message = error?.message || 'Unknown error occurred';
  const timestamp = new Date().toISOString();
  const recommendations = getRecoveryRecommendations(type);
  const userMessage = getUserFacingMessage(type);

  // Log with full context (for debugging)
  logError(
    `[${context.service || 'Service'}] ${context.operation || 'Operation'} failed`,
    {
      errorType: type,
      message,
      statusCode,
      stack: error?.stack,
      code: error?.code,
      context: context.details || {},
      userId: context.userId,
      requestId: context.requestId,
      recommendations,
    }
  );

  return {
    success: false,
    error: {
      type,
      message: userMessage, // Send user-facing message
      code: error?.code || type,
      statusCode,
      timestamp,
      requestId: context.requestId,
      details: process.env.NODE_ENV === 'development' ? { originalMessage: message, ...context.details } : undefined,
    },
  };
}

/**
 * Wrap async function with automatic error handling
 */
export function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    service: string;
    operation: string;
    userId?: string;
    requestId?: string;
  }
): Promise<T> {
  return operation().catch((error) => {
    const response = handleError(error, context);
    throw new ServiceError(response.error.type, response.error.statusCode, response.error.message);
  });
}

/**
 * Wrap sync function with automatic error handling
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  context: {
    service: string;
    operation: string;
    userId?: string;
    requestId?: string;
  }
): T {
  try {
    return operation();
  } catch (error) {
    const response = handleError(error, context);
    throw new ServiceError(response.error.type, response.error.statusCode, response.error.message);
  }
}

/**
 * Validate required parameters
 */
export function validateRequired(
  value: any,
  fieldName: string,
  context?: { service?: string; operation?: string }
): void {
  if (value === null || value === undefined || value === '') {
    const error = new ServiceError(
      ErrorType.VALIDATION,
      400,
      `Missing required field: ${fieldName}`,
      { fieldName },
      'MISSING_REQUIRED_FIELD'
    );
    logError(`[${context?.service}] Validation failed: ${fieldName}`, { error: error.message });
    throw error;
  }
}

/**
 * Validate field type
 */
export function validateType(
  value: any,
  expectedType: string,
  fieldName: string,
  context?: { service?: string; operation?: string }
): void {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    const error = new ServiceError(
      ErrorType.VALIDATION,
      400,
      `Field ${fieldName} must be ${expectedType}, got ${actualType}`,
      { fieldName, expectedType, actualType },
      'INVALID_TYPE'
    );
    logError(`[${context?.service}] Type validation failed for ${fieldName}`, { error: error.message });
    throw error;
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, context?: { service?: string; operation?: string }): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const error = new ServiceError(
      ErrorType.VALIDATION,
      400,
      'Invalid email format',
      { email },
      'INVALID_EMAIL'
    );
    logError(`[${context?.service}] Email validation failed`, { error: error.message });
    throw error;
  }
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: any, requestId?: string): ErrorResponse {
  if (error instanceof ServiceError) {
    return {
      success: false,
      error: {
        type: error.type,
        message: getUserFacingMessage(error.type),
        code: error.code,
        statusCode: error.statusCode,
        timestamp: new Date().toISOString(),
        requestId,
        details: error.details,
      },
    };
  }

  const { type, statusCode } = classifyError(error);
  return {
    success: false,
    error: {
      type,
      message: getUserFacingMessage(type),
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

export default {
  handleError,
  ServiceError,
  ErrorType,
  withErrorHandling,
  withErrorHandlingSync,
  validateRequired,
  validateType,
  validateEmail,
  formatErrorResponse,
};
