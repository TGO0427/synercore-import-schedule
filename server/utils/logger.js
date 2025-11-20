/**
 * Structured logging utility
 * Provides consistent, structured logging across the application
 * Reduces console spam with appropriate log levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Determine current log level based on NODE_ENV
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

const LOG_LEVEL_NAMES = Object.keys(LOG_LEVELS);

/**
 * Format timestamp for logs
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Format context object for display
 */
function formatContext(context = {}) {
  if (Object.keys(context).length === 0) return '';
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
 * @param {string} message - Error message
 * @param {Error} error - Error object (optional)
 * @param {object} context - Additional context (optional)
 */
export function logError(message, error = null, context = {}) {
  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);
  const errorStr = error ? `\n  ${error.stack || error.message}` : '';

  console.error(
    `[${timestamp}] [ERROR] ${message}${contextStr}${errorStr}`
  );
}

/**
 * Warning logger - Logged in all environments
 * @param {string} message - Warning message
 * @param {object} context - Additional context (optional)
 */
export function logWarn(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.WARN) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.warn(
    `[${timestamp}] [WARN] ${message}${contextStr}`
  );
}

/**
 * Info logger - Useful operational information
 * @param {string} message - Info message
 * @param {object} context - Additional context (optional)
 */
export function logInfo(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.INFO) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.log(
    `[${timestamp}] [INFO] ${message}${contextStr}`
  );
}

/**
 * Debug logger - Development details
 * @param {string} message - Debug message
 * @param {object} context - Additional context (optional)
 */
export function logDebug(message, context = {}) {
  if (CURRENT_LOG_LEVEL < LOG_LEVELS.DEBUG) return;

  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);

  console.debug(
    `[${timestamp}] [DEBUG] ${message}${contextStr}`
  );
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

  const timestamp = formatTimestamp();
  const preview = query.replace(/\s+/g, ' ').slice(0, 100);
  const contextStr = formatContext(context);

  console.debug(
    `[${timestamp}] [QUERY] ${preview}... (${durationMs}ms, ${rowCount} rows)${contextStr}`
  );
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
export function logServerStart(port, environment) {
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
