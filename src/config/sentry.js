/**
 * Sentry configuration for frontend error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for frontend
 * Must be called before React renders
 */
export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️  REACT_APP_SENTRY_DSN not set. Error tracking disabled.');
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: NODE_ENV,
      integrations: [
        // Built-in integrations are included by default
        Sentry.httpClientIntegration({
          failedRequestTargets: [
            /synercore-import-schedule-production\.up\.railway\.app/,
            /localhost/,
          ],
        }),
      ],
      tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
      maxBreadcrumbs: 50,
      beforeSend(event, hint) {
        // Filter out client-side errors that aren't worth tracking
        if (hint.originalException instanceof Error) {
          const message = hint.originalException.message;
          // Ignore network timeouts and cancellations
          if (message.includes('AbortError') || message.includes('timeout')) {
            return null;
          }
        }
        return event;
      },
    });

    console.log(`✓ Sentry frontend initialized (${NODE_ENV})`);
    return true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    return false;
  }
}

/**
 * Capture user for error context
 */
export function setUser(user) {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture breadcrumb for debugging
 */
export function addBreadcrumb(message, category = 'info', data = {}) {
  if (!SENTRY_DSN) return;

  Sentry.captureMessage(message, 'info');
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

export default Sentry;
