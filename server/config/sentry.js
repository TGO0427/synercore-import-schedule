/**
 * Sentry configuration for error tracking and performance monitoring
 * Captures unhandled exceptions, API errors, and performance metrics
 */

import * as Sentry from '@sentry/node';
import * as Integrations from '@sentry/integrations';

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for backend error tracking
 */
export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not set. Error tracking disabled.');
    return null;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: NODE_ENV,
      integrations: [
        new Integrations.Http({ tracing: true }),
        new Integrations.OnUncaughtException(),
        new Integrations.OnUnhandledRejection(),
      ],
      tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
      maxBreadcrumbs: 50,
      maxValueLength: 1024,
      ignoreErrors: [
        // Browser extensions
        'chrome-extension://',
        'moz-extension://',
        // Network timeouts
        'NetworkError',
        'TimeoutError',
      ],
      beforeSend(event, hint) {
        // Don't send 4xx errors (client errors) except for 401/403
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
    return Sentry;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return null;
  }
}

/**
 * Express middleware for Sentry request handling
 */
export function getSentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Express middleware for Sentry error handling
 */
export function getSentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture exception with context
 */
export function captureException(error, context = {}) {
  if (!SENTRY_DSN) return;

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
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureMessage(message, level);
  });
}

export default Sentry;
