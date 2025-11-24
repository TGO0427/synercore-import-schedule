/**
 * Web Vitals Performance Monitoring
 * Tracks Core Web Vitals (LCP, FID, CLS) and other metrics
 * Automatically sent to Sentry for analysis
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import * as Sentry from '@sentry/react';

/**
 * Initialize Web Vitals monitoring
 * Call this in your app initialization
 */
export function initWebVitals() {
  // Largest Contentful Paint - measures loading performance
  getLCP((metric) => {
    if (metric.value > 2500) {
      // Good threshold is < 2.5s
      Sentry.captureMessage(`LCP is ${metric.value}ms - consider optimization`, 'warning');
    }
    reportMetric(metric, 'LCP');
  });

  // First Input Delay - measures interactivity
  getFID((metric) => {
    if (metric.value > 100) {
      // Good threshold is < 100ms
      Sentry.captureMessage(`FID is ${metric.value}ms - consider optimization`, 'warning');
    }
    reportMetric(metric, 'FID');
  });

  // Cumulative Layout Shift - measures visual stability
  getCLS((metric) => {
    if (metric.value > 0.1) {
      // Good threshold is < 0.1
      Sentry.captureMessage(`CLS is ${metric.value} - consider optimization`, 'warning');
    }
    reportMetric(metric, 'CLS');
  });

  // First Contentful Paint - measures when first content appears
  getFCP((metric) => {
    reportMetric(metric, 'FCP');
  });

  // Time to First Byte - measures server response time
  getTTFB((metric) => {
    if (metric.value > 600) {
      // Good threshold is < 600ms
      Sentry.captureMessage(`TTFB is ${metric.value}ms - server may need optimization`, 'info');
    }
    reportMetric(metric, 'TTFB');
  });
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
 */
export async function getWebVitalsScores() {
  return new Promise((resolve) => {
    const scores = {};
    let completed = 0;

    getLCP((metric) => {
      scores.lcp = metric.value;
      completed++;
      if (completed === 5) resolve(scores);
    });

    getFID((metric) => {
      scores.fid = metric.value;
      completed++;
      if (completed === 5) resolve(scores);
    });

    getCLS((metric) => {
      scores.cls = metric.value;
      completed++;
      if (completed === 5) resolve(scores);
    });

    getFCP((metric) => {
      scores.fcp = metric.value;
      completed++;
      if (completed === 5) resolve(scores);
    });

    getTTFB((metric) => {
      scores.ttfb = metric.value;
      completed++;
      if (completed === 5) resolve(scores);
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

  getLCP((metric) => {
    console.log(`📊 LCP: ${metric.value}ms (${metric.rating})`);
  });

  getFID((metric) => {
    console.log(`📊 FID: ${metric.value}ms (${metric.rating})`);
  });

  getCLS((metric) => {
    console.log(`📊 CLS: ${metric.value} (${metric.rating})`);
  });

  getFCP((metric) => {
    console.log(`📊 FCP: ${metric.value}ms (${metric.rating})`);
  });

  getTTFB((metric) => {
    console.log(`📊 TTFB: ${metric.value}ms (${metric.rating})`);
  });
}

export default {
  initWebVitals,
  getWebVitalsScores,
  getMetricRating,
  logWebVitalsToConsole,
};
