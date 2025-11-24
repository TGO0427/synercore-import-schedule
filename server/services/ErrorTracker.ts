/**
 * Error Tracking Service
 * Centralizes error logging, monitoring, and reporting
 * Supports multiple backends (console, file, external services like Sentry)
 */

import { logError, logWarn, logInfo } from '../utils/logger.js';

/**
 * Error context information
 */
export interface ErrorContext {
  userId?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  timestamp?: Date;
  [key: string]: any;
}

/**
 * Error event for tracking
 */
export interface ErrorEvent {
  id: string;
  type: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolved: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byType: Record<string, number>;
  byPath: Record<string, number>;
  errorRate: number;
}

/**
 * Error Tracker Service
 */
export class ErrorTracker {
  private static errors: Map<string, ErrorEvent> = new Map();
  private static errorHistory: ErrorEvent[] = [];
  private static maxHistorySize = 1000;
  private static externalHandlers: Array<(error: ErrorEvent) => Promise<void>> = [];

  /**
   * Register external error handler (e.g., Sentry, DataDog)
   */
  static registerExternalHandler(
    handler: (error: ErrorEvent) => Promise<void>
  ): void {
    this.externalHandlers.push(handler);
    logInfo(`Registered external error handler`);
  }

  /**
   * Track an error event
   */
  static async trackError(
    error: Error | string,
    context: ErrorContext = {},
    severity: 'critical' | 'high' | 'medium' | 'low' = 'high'
  ): Promise<void> {
    try {
      const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      const errorEvent: ErrorEvent = {
        id: errorId,
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        message,
        stack,
        context: {
          ...context,
          timestamp: context.timestamp || new Date()
        },
        severity,
        resolved: false,
        timestamp: new Date()
      };

      // Store in memory
      this.errors.set(errorId, errorEvent);
      this.errorHistory.push(errorEvent);

      // Maintain max history size
      if (this.errorHistory.length > this.maxHistorySize) {
        this.errorHistory.shift();
      }

      // Log based on severity
      this.logBySeverity(errorEvent);

      // Notify external handlers
      await this.notifyExternalHandlers(errorEvent);

      return;
    } catch (trackingError) {
      logError('Failed to track error:', trackingError as Error);
    }
  }

  /**
   * Track a warning (non-fatal issue)
   */
  static async trackWarning(
    message: string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.trackError(message, context, 'low');
  }

  /**
   * Track a critical error
   */
  static async trackCriticalError(
    error: Error | string,
    context: ErrorContext = {}
  ): Promise<void> {
    await this.trackError(error, context, 'critical');
  }

  /**
   * Get error by ID
   */
  static getError(errorId: string): ErrorEvent | undefined {
    return this.errors.get(errorId);
  }

  /**
   * Get all errors by severity
   */
  static getErrorsBySeverity(
    severity: 'critical' | 'high' | 'medium' | 'low'
  ): ErrorEvent[] {
    return Array.from(this.errors.values()).filter(
      (error) => error.severity === severity
    );
  }

  /**
   * Get errors for a specific user
   */
  static getErrorsForUser(userId: string): ErrorEvent[] {
    return Array.from(this.errors.values()).filter(
      (error) => error.context.userId === userId
    );
  }

  /**
   * Get errors for a specific path
   */
  static getErrorsForPath(path: string): ErrorEvent[] {
    return Array.from(this.errors.values()).filter(
      (error) => error.context.path === path
    );
  }

  /**
   * Get error statistics
   */
  static getStatistics(): ErrorStats {
    const errors = Array.from(this.errors.values());
    const byType: Record<string, number> = {};
    const byPath: Record<string, number> = {};

    errors.forEach((error) => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      if (error.context.path) {
        byPath[error.context.path] = (byPath[error.context.path] || 0) + 1;
      }
    });

    return {
      totalErrors: errors.length,
      criticalCount: errors.filter((e) => e.severity === 'critical').length,
      highCount: errors.filter((e) => e.severity === 'high').length,
      mediumCount: errors.filter((e) => e.severity === 'medium').length,
      lowCount: errors.filter((e) => e.severity === 'low').length,
      byType,
      byPath,
      errorRate:
        errors.length > 0
          ? (errors.filter((e) => !e.resolved).length / errors.length) * 100
          : 0
    };
  }

  /**
   * Get recent errors
   */
  static getRecentErrors(limit: number = 50): ErrorEvent[] {
    return this.errorHistory.slice(-limit).reverse();
  }

  /**
   * Mark error as resolved
   */
  static resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Clear all errors (for testing)
   */
  static clearErrors(): void {
    this.errors.clear();
    this.errorHistory = [];
  }

  /**
   * Log error based on severity
   */
  private static logBySeverity(error: ErrorEvent): void {
    switch (error.severity) {
      case 'critical':
        logError(`[CRITICAL] ${error.message}`, new Error(error.stack), error.context);
        break;
      case 'high':
        logError(`[HIGH] ${error.message}`, new Error(error.stack), error.context);
        break;
      case 'medium':
        logWarn(`[MEDIUM] ${error.message}`, error.context);
        break;
      case 'low':
        logInfo(`[LOW] ${error.message}`);
        break;
    }
  }

  /**
   * Notify external handlers
   */
  private static async notifyExternalHandlers(error: ErrorEvent): Promise<void> {
    for (const handler of this.externalHandlers) {
      try {
        await handler(error);
      } catch (handlerError) {
        logError('External error handler failed:', handlerError as Error);
      }
    }
  }
}

/**
 * Sentry integration (example external handler)
 */
export const sentryHandler = (dsn: string) => {
  return async (error: ErrorEvent) => {
    try {
      // This would use the actual Sentry SDK in production
      // Example structure:
      // await Sentry.captureException(new Error(error.message), {
      //   level: error.severity,
      //   tags: { type: error.type },
      //   extra: error.context
      // });

      logInfo(`[Sentry] Error reported: ${error.id}`);
    } catch (e) {
      logError('Failed to report to Sentry:', e as Error);
    }
  };
};

/**
 * DataDog integration (example external handler)
 */
export const datadogHandler = (apiKey: string) => {
  return async (error: ErrorEvent) => {
    try {
      // This would use the actual DataDog SDK in production
      // Example structure:
      // await dd.logger.error(error.message, {
      //   errorId: error.id,
      //   severity: error.severity,
      //   context: error.context
      // });

      logInfo(`[DataDog] Error logged: ${error.id}`);
    } catch (e) {
      logError('Failed to log to DataDog:', e as Error);
    }
  };
};

export default ErrorTracker;
