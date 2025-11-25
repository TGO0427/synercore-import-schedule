/**
 * Sentry configuration for frontend error tracking and performance monitoring
 *
 * SECURITY: DSN is loaded from environment variables only.
 * Never hardcode DSN or sensitive credentials in source code.
 * See: https://docs.sentry.io/security/
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/browser';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const MODE = import.meta.env.MODE || 'development';

/**
 * Initialize Sentry for frontend
 * Must be called before React renders
 *
 * Security best practices:
 * - Never send PII (Personally Identifiable Information) without user consent
 * - Filter sensitive data from breadcrumbs
 * - Use allowUrls/denyUrls to filter third-party errors
 * - Set appropriate sample rates to minimize data collection
 */
export function initializeSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️  VITE_SENTRY_DSN not set. Error tracking disabled.');
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: MODE,

      // Security: Never send default PII
      sendDefaultPii: false, // SECURITY: Do NOT set to true without explicit user consent

      integrations: [
        new BrowserTracing(),
        // Built-in integrations are included by default
        Sentry.httpClientIntegration({
          failedRequestTargets: [
            /synercore-import-schedule-production\.up\.railway\.app/,
            /localhost/,
          ],
        }),
      ],

      // Sample rates - production sends 10%, development sends 100%
      tracesSampleRate: MODE === 'production' ? 0.1 : 1.0,

      // Limit breadcrumbs to prevent excessive data collection
      maxBreadcrumbs: 50,

      // Security: Ignore errors from third-party scripts
      ignoreErrors: [
        // Browser extensions
        'chrome-extension://',
        'moz-extension://',
        // Third-party scripts
        'top.GLOBALS',
        'Can\'t find variable: ZiteReader',
        'jigsaw is not defined',
        'ComboSearch is not defined',
      ],

      // Security: Only track our application URLs
      allowUrls: [
        /synercore-import-schedule\.vercel\.app/,
        /synercore-import-schedule-production\.up\.railway\.app/,
        /localhost/,
      ],

      // Security: Don't track third-party errors
      denyUrls: [
        /script.google-analytics\.com/,
        /connect.facebook.net/,
        /graph.instagram.com/,
      ],

      beforeSend(event, hint) {
        // Security: Filter out sensitive data

        // 1. Don't track network timeouts
        if (hint.originalException instanceof Error) {
          const message = hint.originalException.message;
          if (message.includes('AbortError') || message.includes('timeout')) {
            return null;
          }
        }

        // 2. Filter out third-party errors (GA, FB, etc)
        if (event.request?.url?.includes('google') ||
            event.request?.url?.includes('facebook')) {
          return null;
        }

        // 3. Don't track expected errors (404s, auth, etc)
        if (event.exception?.values?.[0]?.value?.includes('404') ||
            event.exception?.values?.[0]?.value?.includes('401')) {
          return null;
        }

        // 4. Remove sensitive headers from requests
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
          delete event.request.headers['X-CSRF-Token'];
        }

        // 5. Don't send request bodies (may contain sensitive data)
        if (event.request?.body) {
          delete event.request.body;
        }

        return event;
      },

      beforeBreadcrumb(breadcrumb, hint) {
        // Security: Filter sensitive breadcrumbs

        // Don't track navigation to sensitive pages
        if (breadcrumb.category === 'navigation' &&
            (breadcrumb.message?.includes('password') ||
             breadcrumb.message?.includes('token') ||
             breadcrumb.message?.includes('secret'))) {
          return null;
        }

        // Don't track console logs containing sensitive data
        if (breadcrumb.category === 'console' &&
            (breadcrumb.message?.includes('password') ||
             breadcrumb.message?.includes('token') ||
             breadcrumb.message?.includes('key') ||
             breadcrumb.message?.includes('secret'))) {
          return null;
        }

        // Don't track XHR/fetch with sensitive headers
        if ((breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') &&
            breadcrumb.data?.request_body) {
          delete breadcrumb.data.request_body;
        }

        return breadcrumb;
      },
    });

    console.log(
      'Sentry frontend initialized (production)',
      MODE,
      SENTRY_DSN ? 'DSN set' : 'DSN MISSING'
    );
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
