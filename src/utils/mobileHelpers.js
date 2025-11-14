/**
 * Mobile Helper Functions
 * Utility functions for mobile-responsive features and device detection
 */

/**
 * Detect if device is mobile
 * @returns {boolean} True if device is mobile
 */
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Detect if device is in portrait orientation
 * @returns {boolean} True if portrait
 */
export const isPortraitOrientation = () => {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
};

/**
 * Detect if device is in landscape orientation
 * @returns {boolean} True if landscape
 */
export const isLandscapeOrientation = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > window.innerHeight;
};

/**
 * Get current viewport size
 * @returns {Object} {width, height}
 */
export const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
};

/**
 * Check if viewport matches a breakpoint
 * @param {string} breakpoint - 'xs', 'sm', 'md', 'lg', 'xl'
 * @returns {boolean} True if viewport matches breakpoint
 */
export const matchesBreakpoint = (breakpoint) => {
  if (typeof window === 'undefined') return false;

  const breakpoints = {
    xs: 320,
    sm: 576,
    md: 768,
    lg: 1024,
    xl: 1440
  };

  const width = window.innerWidth;
  return width >= breakpoints[breakpoint];
};

/**
 * Check if device supports touch
 * @returns {boolean} True if touch is supported
 */
export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return (
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0)) ||
    false
  );
};

/**
 * Check if device is in landscape and wide enough for desktop layout
 * @returns {boolean} True if should use desktop layout
 */
export const shouldUseDesktopLayout = () => {
  return matchesBreakpoint('md');
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format date for mobile display
 * @param {string|Date} date - Date to format
 * @param {boolean} includeTime - Include time in output
 * @returns {string} Formatted date
 */
export const formatMobileDate = (date, includeTime = false) => {
  if (!date) return '-';

  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if today
  if (d.toDateString() === today.toDateString()) {
    if (includeTime) {
      return `Today at ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
    return 'Today';
  }

  // Check if yesterday
  if (d.toDateString() === yesterday.toDateString()) {
    if (includeTime) {
      return `Yesterday at ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
    return 'Yesterday';
  }

  // Check if within week
  const daysDiff = Math.floor((today - d) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7 && daysDiff >= 0) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (includeTime) {
      return `${dayName} at ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
    return dayName;
  }

  // Default format
  if (includeTime) {
    return d.toLocaleDateString() +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
};

/**
 * Debounce function for mobile events
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay = 250) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Throttle function for mobile scroll events
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, delay = 250) => {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    }
  };
};

/**
 * Check if user prefers reduced motion
 * @returns {boolean} True if reduced motion is preferred
 */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if user prefers dark mode
 * @returns {boolean} True if dark mode is preferred
 */
export const prefersDarkMode = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Check if user prefers high contrast
 * @returns {boolean} True if high contrast is preferred
 */
export const prefersHighContrast = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
};

/**
 * Get safe area insets for notch/status bar support
 * @returns {Object} {top, right, bottom, left}
 */
export const getSafeAreaInsets = () => {
  if (typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const root = document.documentElement;
  return {
    top: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-top')) || 0,
    right: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-right')) || 0,
    bottom: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom')) || 0,
    left: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-left')) || 0
  };
};

/**
 * Add safe area padding to element
 * @param {HTMLElement} element - Element to add padding to
 * @param {string} side - 'top', 'right', 'bottom', 'left', or 'all'
 */
export const addSafeAreaPadding = (element, side = 'all') => {
  if (!element) return;

  const insets = getSafeAreaInsets();
  const padding = element.style.padding || '';

  if (side === 'top') {
    element.style.paddingTop = `${insets.top}px`;
  } else if (side === 'bottom') {
    element.style.paddingBottom = `${insets.bottom}px`;
  } else if (side === 'all') {
    element.style.padding = `
      ${insets.top}px
      ${insets.right}px
      ${insets.bottom}px
      ${insets.left}px
    `.trim();
  }
};

/**
 * Prevent body scroll (for modals)
 */
export const disableBodyScroll = () => {
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = `${scrollbarWidth}px`;
};

/**
 * Re-enable body scroll
 */
export const enableBodyScroll = () => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
};

/**
 * Detect if keyboard is visible (mobile)
 * @returns {boolean} True if keyboard might be visible
 */
export const isKeyboardVisible = () => {
  if (typeof window === 'undefined') return false;

  // This is a heuristic - actual detection is hard
  // Check if viewport height has decreased
  const initialHeight = window.screen.height;
  const currentHeight = window.innerHeight;

  return currentHeight < initialHeight * 0.75;
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

/**
 * Share via native share if available
 * @param {Object} options - Share options {title, text, url}
 * @returns {Promise<boolean>} True if shared
 */
export const nativeShare = async (options) => {
  if (navigator.share) {
    try {
      await navigator.share(options);
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
      return false;
    }
  }
  return false;
};

/**
 * Check if native share is available
 * @returns {boolean} True if native share is available
 */
export const isNativeShareAvailable = () => {
  return typeof navigator !== 'undefined' && !!navigator.share;
};

/**
 * Haptic feedback (vibration)
 * @param {number|array} pattern - Single duration or pattern array
 */
export const hapticFeedback = (pattern = 20) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

/**
 * Log performance metrics
 * @param {string} label - Metric label
 * @param {number} value - Metric value
 */
export const logMetric = (label, value) => {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      window.performance.mark(`${label}-${Date.now()}`);
      if (console && console.log) {
        console.log(`[Metric] ${label}: ${value}ms`);
      }
    } catch (err) {
      console.error('Error logging metric:', err);
    }
  }
};

/**
 * Create a mobile-safe URL
 * @param {string} url - URL to make safe
 * @returns {string} Safe URL
 */
export const createMobileSafeUrl = (url) => {
  // Ensure URL is properly encoded and safe for mobile
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.toString();
  } catch (err) {
    console.error('Invalid URL:', err);
    return '';
  }
};

/**
 * Scroll to element smoothly with mobile optimization
 * @param {HTMLElement} element - Element to scroll to
 * @param {number} offset - Offset from top in pixels
 */
export const scrollToElement = (element, offset = 0) => {
  if (!element) return;

  const top = element.getBoundingClientRect().top + window.scrollY - offset;

  // Use smooth scroll if supported
  if (window.scrollTo) {
    window.scrollTo({
      top,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  } else {
    // Fallback for older browsers
    window.scrollY = top;
  }
};

export default {
  isMobileDevice,
  isPortraitOrientation,
  isLandscapeOrientation,
  getViewportSize,
  matchesBreakpoint,
  isTouchDevice,
  shouldUseDesktopLayout,
  formatFileSize,
  formatMobileDate,
  debounce,
  throttle,
  prefersReducedMotion,
  prefersDarkMode,
  prefersHighContrast,
  getSafeAreaInsets,
  addSafeAreaPadding,
  disableBodyScroll,
  enableBodyScroll,
  isKeyboardVisible,
  copyToClipboard,
  nativeShare,
  isNativeShareAvailable,
  hapticFeedback,
  logMetric,
  createMobileSafeUrl,
  scrollToElement
};
