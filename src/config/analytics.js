/**
 * Google Analytics configuration
 * Tracks user interactions and page views
 */

const GA_ID = process.env.REACT_APP_GA_ID;

/**
 * Initialize Google Analytics
 * Add tracking to page
 */
export function initializeAnalytics() {
  if (!GA_ID) {
    console.warn('⚠️  REACT_APP_GA_ID not set. Analytics disabled.');
    return false;
  }

  try {
    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, {
      page_path: window.location.pathname,
    });

    console.log('✓ Google Analytics initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Analytics:', error);
    return false;
  }
}

/**
 * Track page view
 * @param {string} path - Page path
 */
export function trackPageView(path) {
  if (!GA_ID || !window.gtag) return;

  try {
    window.gtag('config', GA_ID, {
      page_path: path,
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
}

/**
 * Track custom event
 * @param {string} eventName - Event name
 * @param {object} eventData - Event data
 */
export function trackEvent(eventName, eventData = {}) {
  if (!GA_ID || !window.gtag) return;

  try {
    window.gtag('event', eventName, eventData);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Track user action
 * @param {string} action - Action type (e.g., 'create', 'update', 'delete')
 * @param {string} category - Category (e.g., 'shipment', 'supplier')
 * @param {string} label - Additional label (optional)
 */
export function trackUserAction(action, category, label = '') {
  trackEvent('user_action', {
    action,
    category,
    label,
  });
}

/**
 * Track error
 * @param {string} errorType - Type of error
 * @param {string} description - Error description
 */
export function trackError(errorType, description = '') {
  trackEvent('error', {
    event_category: 'error',
    event_label: errorType,
    description,
  });
}

/**
 * Track performance metric
 * @param {string} metricName - Metric name (e.g., 'page_load_time')
 * @param {number} value - Metric value
 */
export function trackPerformance(metricName, value) {
  trackEvent('performance', {
    event_category: 'performance',
    event_label: metricName,
    value: Math.round(value),
  });
}

/**
 * Track shipment creation
 */
export function trackShipmentCreated() {
  trackUserAction('create', 'shipment');
}

/**
 * Track shipment update
 */
export function trackShipmentUpdated() {
  trackUserAction('update', 'shipment');
}

/**
 * Track shipment deletion
 */
export function trackShipmentDeleted() {
  trackUserAction('delete', 'shipment');
}

/**
 * Track login
 * @param {string} role - User role
 */
export function trackLogin(role = '') {
  trackUserAction('login', 'auth', role);
}

/**
 * Track logout
 */
export function trackLogout() {
  trackUserAction('logout', 'auth');
}

/**
 * Track report generation
 * @param {string} reportType - Type of report
 */
export function trackReportGenerated(reportType) {
  trackUserAction('generate', 'report', reportType);
}

/**
 * Track data export
 * @param {string} format - Export format (Excel, PDF, etc)
 */
export function trackExport(format) {
  trackUserAction('export', 'data', format);
}

export default {
  initializeAnalytics,
  trackPageView,
  trackEvent,
  trackUserAction,
  trackError,
  trackPerformance,
  trackShipmentCreated,
  trackShipmentUpdated,
  trackShipmentDeleted,
  trackLogin,
  trackLogout,
  trackReportGenerated,
  trackExport,
};
