/**
 * Structured logging utility
 * Provides consistent, structured logging across the application
 * Reduces console spam with appropriate log levels
 */

import type { LogContext } from '../types/index.js';

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

const LOG_LEVEL_NAMES = Object.keys(LogLevel).filter(key => isNaN(Number(key)));

// Determine current log level based on NODE_ENV
const CURRENT_LOG_LEVEL: number = process.env.LOG_LEVEL
  ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO
  : (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);

/**
 * Format timestamp for logs
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format context object for display
 */
function formatContext(context: LogContext = {}): string {
  if (!context || Object.keys(context).length === 0) return '';
  const parts = Object.entries(context)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join(' ');
  return ` ${parts}`;
}

/**
 * Error logger - Always logged
 */
export function logError(message: string, error?: Error | null, context: LogContext = {}): void {
  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);
  const errorStr = error ? `\n  ${error.stack || error.message}` : '';

  console.error(
    `[${timestamp}] [ERROR] ${message}${contextStr}${errorStr}`
  );
}

/**
 * Warning logger - Logged in all environments
 */
export function logWarn(message: string, context: LogContext = {}): void {
  if (CURRENT_LOG_LEVEL < LogLevel.WARN) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.warn(
    `[${timestamp}] [WARN] ${message}${contextStr}`
  );
}

/**
 * Info logger - Useful operational information
 */
export function logInfo(message: string, context: LogContext = {}): void {
  if (CURRENT_LOG_LEVEL < LogLevel.INFO) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.log(
    `[${timestamp}] [INFO] ${message}${contextStr}`
  );
}

/**
 * Debug logger - Development details
 */
export function logDebug(message: string, context: LogContext = {}): void {
  if (CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.debug(
    `[${timestamp}] [DEBUG] ${message}${contextStr}`
  );
}

/**
 * Log database query
 */
export function logQuery(query: string, durationMs: number, rowCount: number, context: LogContext = {}): void {
  if (CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

  const timestamp = formatTimestamp();
  const preview = query.replace(/\s+/g, ' ').slice(0, 100);
  const contextStr = formatContext(context);

  console.debug(
    `[${timestamp}] [QUERY] ${preview}... (${durationMs}ms, ${rowCount} rows)${contextStr}`
  );
}

/**
 * Log HTTP request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context: LogContext = {}
): void {
  if (CURRENT_LOG_LEVEL < LogLevel.INFO) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);
  const statusColor = statusCode >= 400 ? '❌' : '✓';

  console.log(
    `[${timestamp}] [REQUEST] ${statusColor} ${method.padEnd(6)} ${path} ${statusCode} (${durationMs}ms)${contextStr}`
  );
}

/**
 * Log server startup
 */
export function logServerStart(port: number, environment: string): void {
  console.log('\n✓ Server started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Port: ${port}`);
  console.log(`  Environment: ${environment}`);
  console.log(`  Log Level: ${LOG_LEVEL_NAMES[CURRENT_LOG_LEVEL]}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Log database connection
 */
export function logDatabaseConnected(dbUrl: string): void {
  const masked = dbUrl.replace(/([a-zA-Z0-9]+):([a-zA-Z0-9!@#$%^&*]+)@/, '$1:****@');
  logInfo('Database connected', { url: masked });
}

/**
 * Log socket connection
 */
export function logSocketConnection(socketId: string, userId?: string): void {
  const context: LogContext = { socketId };
  if (userId) {
    context.userId = userId;
  }
  logInfo('Socket connected', context);
}

/**
 * Get current log level
 */
export function getLogLevel(): string {
  const levelName = LOG_LEVEL_NAMES[CURRENT_LOG_LEVEL];
  return typeof levelName === 'string' ? levelName : 'DEBUG';
}

export default {
  logError,
  logWarn,
  logInfo,
  logDebug,
  logQuery,
  logRequest,
  logServerStart,
  logDatabaseConnected,
  logSocketConnection,
  getLogLevel
};
