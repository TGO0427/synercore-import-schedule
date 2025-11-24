/**
 * Web Vitals Performance Monitoring
 * Tracks Core Web Vitals (LCP, FID, CLS) and other metrics
 * Automatically sent to Sentry for analysis
 */

import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';
import * as Sentry from '@sentry/react';

/**
 * Initialize Web Vitals monitoring
 * Call this in your app initialization
 */
export function initWebVitals() {
  try {
    // Largest Contentful Paint - measures loading performance
    onLCP((metric) => {
      if (metric.value > 2500) {
        // Good threshold is < 2.5s
        Sentry.captureMessage(`LCP is ${metric.value}ms - consider optimization`, 'warning');
      }
      reportMetric(metric, 'LCP');
    });

    // First Input Delay - measures interactivity
    onFID((metric) => {
      if (metric.value > 100) {
        // Good threshold is < 100ms
        Sentry.captureMessage(`FID is ${metric.value}ms - consider optimization`, 'warning');
      }
      reportMetric(metric, 'FID');
    });

    // Cumulative Layout Shift - measures visual stability
    onCLS((metric) => {
      if (metric.value > 0.1) {
        // Good threshold is < 0.1
        Sentry.captureMessage(`CLS is ${metric.value} - consider optimization`, 'warning');
      }
      reportMetric(metric, 'CLS');
    });

    // First Contentful Paint - measures when first content appears
    onFCP((metric) => {
      reportMetric(metric, 'FCP');
    });

    // Time to First Byte - measures server response time
    onTTFB((metric) => {
      if (metric.value > 600) {
        // Good threshold is < 600ms
        Sentry.captureMessage(`TTFB is ${metric.value}ms - server may need optimization`, 'info');
      }
      reportMetric(metric, 'TTFB');
    });
  } catch (error) {
    console.warn('Web Vitals initialization failed:', error);
  }
}

/**
 * Report metric to Sentry
 */
function reportMetric(metric, name) {
  try {
    Sentry.addBreadcrumb({
      message: `Performance Metric: ${name}`,
      category: 'performance',
      level: 'info',
      data: {
        metric: name,
        value: metric.value,
        unit: metric.unit,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
      },
    });
  } catch (error) {
    console.error('Failed to report metric:', error);
  }
}

/**
 * Get current Web Vitals scores
 * Returns a promise with all current metrics
 * Note: Web Vitals are callback-based, this collects them when available
 */
export async function getWebVitalsScores() {
  return new Promise((resolve) => {
    const scores = {};
    let completed = 0;
    const timeout = setTimeout(() => {
      resolve(scores); // Return whatever we have after 5 seconds
    }, 5000);

    onLCP((metric) => {
      scores.lcp = metric.value;
      completed++;
      if (completed === 5) {
        clearTimeout(timeout);
        resolve(scores);
      }
    });

    onFID((metric) => {
      scores.fid = metric.value;
      completed++;
      if (completed === 5) {
        clearTimeout(timeout);
        resolve(scores);
      }
    });

    onCLS((metric) => {
      scores.cls = metric.value;
      completed++;
      if (completed === 5) {
        clearTimeout(timeout);
        resolve(scores);
      }
    });

    onFCP((metric) => {
      scores.fcp = metric.value;
      completed++;
      if (completed === 5) {
        clearTimeout(timeout);
        resolve(scores);
      }
    });

    onTTFB((metric) => {
      scores.ttfb = metric.value;
      completed++;
      if (completed === 5) {
        clearTimeout(timeout);
        resolve(scores);
      }
    });
  });
}

/**
 * Get rating for a metric value
 * Returns 'good', 'needs-improvement', or 'poor'
 */
export function getMetricRating(metricName, value) {
  const thresholds = {
    LCP: { good: 2500, needsImprovement: 4000 },
    FID: { good: 100, needsImprovement: 300 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FCP: { good: 1800, needsImprovement: 3000 },
    TTFB: { good: 600, needsImprovement: 1200 },
  };

  const threshold = thresholds[metricName];
  if (!threshold) return 'unknown';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Log metrics to console in development
 */
export function logWebVitalsToConsole() {
  if (process.env.NODE_ENV !== 'development') return;

  try {
    onLCP((metric) => {
      console.log(`📊 LCP: ${metric.value}ms (${metric.rating})`);
    });

    onFID((metric) => {
      console.log(`📊 FID: ${metric.value}ms (${metric.rating})`);
    });

    onCLS((metric) => {
      console.log(`📊 CLS: ${metric.value} (${metric.rating})`);
    });

    onFCP((metric) => {
      console.log(`📊 FCP: ${metric.value}ms (${metric.rating})`);
    });

    onTTFB((metric) => {
      console.log(`📊 TTFB: ${metric.value}ms (${metric.rating})`);
    });
  } catch (error) {
    console.warn('Failed to log Web Vitals:', error);
  }
}

export default {
  initWebVitals,
  getWebVitalsScores,
  getMetricRating,
  logWebVitalsToConsole,
};
