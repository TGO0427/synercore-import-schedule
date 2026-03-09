/**
 * Structured logging utility
 * Provides consistent, structured logging across the application
 * - JSON output in production for log aggregation tools
 * - Pretty, human-readable format in development
 * - Respects LOG_LEVEL env var (default: 'info')
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Determine current log level from LOG_LEVEL env var, falling back to env-based default
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

const LOG_LEVEL_NAMES = Object.keys(LOG_LEVELS);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Format timestamp for logs
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Format context object for pretty (development) display
 */
function formatContext(context = {}) {
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
 * Core log emitter - outputs JSON in production, pretty text in development
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} message
 * @param {object} metadata - optional structured metadata
 */
function emit(level, message, metadata) {
  const timestamp = formatTimestamp();
  const consoleFn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'debug' ? console.debug :
    console.log;

  if (IS_PRODUCTION) {
    // Structured JSON for log aggregation (Railway, Datadog, etc.)
    const entry = { timestamp, level, message };
    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }
    consoleFn(JSON.stringify(entry));
  } else {
    // Human-readable pretty format for development
    const contextStr = formatContext(metadata);
    consoleFn(`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);
  }
}

/**
 * Error logger - Always logged
 * @param {string} message - Error message
 * @param {Error} error - Error object (optional)
 * @param {object} context - Additional context (optional)
 */
export function logError(message, error = null, context = {}) {
  const metadata = { ...context };
  if (error) {
    metadata.error = error.message;
    metadata.stack = error.stack;
  }
  emit('error', message, metadata);
}

/**
 * Warning logger - Logged in all environments
 * @param {string} message - Warning message
 * @param {object} context - Additional context (optional)
 */
export function logWarn(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.WARN) return;
  emit('warn', message, context);
}

/**
 * Info logger - Useful operational information
 * @param {string} message - Info message
 * @param {object} context - Additional context (optional)
 */
export function logInfo(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.INFO) return;
  emit('info', message, context);
}

/**
 * Debug logger - Development details
 * @param {string} message - Debug message
 * @param {object} context - Additional context (optional)
 */
export function logDebug(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;
  emit('debug', message, context);
}

/**
 * Log database query
 * @param {string} query - SQL query preview
 * @param {number} durationMs - Query duration in milliseconds
 * @param {number} rowCount - Number of rows affected
 * @param {object} context - Additional context (optional)
 */
export function logQuery(query, durationMs, rowCount, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;

  const preview = query.replace(/\s+/g, ' ').slice(0, 100);
  emit('debug', `QUERY: ${preview}...`, {
    durationMs,
    rowCount,
    ...context
  });
}

/**
 * Log HTTP request
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} statusCode - Response status code
 * @param {number} durationMs - Request duration
 * @param {object} context - Additional context (optional)
 */
export function logRequest(method, path, statusCode, durationMs, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.INFO) return;

  emit('info', `${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    durationMs,
    ...context
  });
}

/**
 * Log server startup
 */
export function logServerStart(port, environment) {
  if (IS_PRODUCTION) {
    emit('info', 'Server started', { port, environment, logLevel: LOG_LEVEL_NAMES[CURRENT_LOG_LEVEL] });
  } else {
    console.log('\n--- Server started ---');
    console.log(`  Port: ${port}`);
    console.log(`  Environment: ${environment}`);
    console.log(`  Log Level: ${LOG_LEVEL_NAMES[CURRENT_LOG_LEVEL]}`);
    console.log('---------------------\n');
  }
}

/**
 * Log database connection
 */
export function logDatabaseConnected(dbUrl) {
  const masked = dbUrl.replace(/([a-zA-Z0-9]+):([a-zA-Z0-9!@#$%^&*]+)@/, '$1:****@');
  logInfo('Database connected', { url: masked });
}

/**
 * Log socket connection
 */
export function logSocketConnection(socketId, userId) {
  logInfo('Socket connected', { socketId, userId });
}

/**
 * Get current log level
 */
export function getLogLevel() {
  return LOG_LEVEL_NAMES[CURRENT_LOG_LEVEL];
}

/**
 * Convenience logger namespace with standard method names.
 * Usage: import { logger } from './utils/logger.js';
 *        logger.info('Server started', { port: 5001 });
 *        logger.error('Failed to connect', { host: 'db.example.com' });
 */
export const logger = {
  error(message, metadata = {}) { logError(message, null, metadata); },
  warn(message, metadata = {})  { logWarn(message, metadata); },
  info(message, metadata = {})  { logInfo(message, metadata); },
  debug(message, metadata = {}) { logDebug(message, metadata); },
};

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
  getLogLevel,
  logger
};
