/**
 * Sentry configuration for error tracking and performance monitoring
 * Captures unhandled exceptions, API errors, and performance metrics
 */

// Lazy-load Sentry to avoid blocking server startup (~20s import time)
let Sentry = null;
const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for backend error tracking (async, non-blocking)
 */
export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not set. Error tracking disabled.');
    return null;
  }

  // Load Sentry in background so server can start immediately
  import('@sentry/node').then(async (SentryModule) => {
    const Integrations = await import('@sentry/integrations');
    Sentry = SentryModule;
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: NODE_ENV,
        integrations: [
          new Integrations.Http({ tracing: true }),
          new Integrations.OnUncaughtException(),
          new Integrations.OnUnhandledRejection(),
        ],
        tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
        maxBreadcrumbs: 50,
        maxValueLength: 1024,
        ignoreErrors: ['chrome-extension://', 'moz-extension://', 'NetworkError', 'TimeoutError'],
        beforeSend(event) {
          if (event.request && event.request.url) {
            const statusCode = event.exception?.values?.[0]?.value?.match?.(/\d{3}/)?.[0];
            if (statusCode && statusCode.startsWith('4') && !['401', '403'].includes(statusCode)) {
              return null;
            }
          }
          return event;
        },
      });
      console.log(`✓ Sentry initialized (${NODE_ENV})`);
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }).catch(err => {
    console.error('Failed to load Sentry module:', err.message);
  });

  return null;
}

/**
 * Express middleware for Sentry request handling
 */
export function getSentryRequestHandler() {
  // Return passthrough middleware — Sentry may not be loaded yet
  return (req, res, next) => {
    if (Sentry && Sentry.Handlers) {
      return Sentry.Handlers.requestHandler()(req, res, next);
    }
    next();
  };
}

/**
 * Express middleware for Sentry error handling
 */
export function getSentryErrorHandler() {
  return (err, req, res, next) => {
    if (Sentry && Sentry.Handlers) {
      return Sentry.Handlers.errorHandler()(err, req, res, next);
    }
    next(err);
  };
}

/**
 * Capture exception with context
 */
export function captureException(error, context = {}) {
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureException(error);
  });
}

/**
 * Capture message with level
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureMessage(message, level);
  });
}

export default { get: () => Sentry };
