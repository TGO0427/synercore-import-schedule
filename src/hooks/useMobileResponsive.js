import { useState, useEffect, useCallback } from 'react';
import {
  isMobileDevice,
  isPortraitOrientation,
  getViewportSize,
  matchesBreakpoint,
  isTouchDevice,
  prefersReducedMotion,
  prefersDarkMode,
  throttle
} from '../utils/mobileHelpers';

/**
 * Hook for responsive mobile state and utilities
 * Provides viewport size, orientation, and device capability detection
 *
 * @returns {Object} Mobile responsive state and utilities
 */
export const useMobileResponsive = () => {
  const [viewport, setViewport] = useState(getViewportSize());
  const [orientation, setOrientation] = useState(
    isPortraitOrientation() ? 'portrait' : 'landscape'
  );
  const [isMobile, setIsMobile] = useState(isMobileDevice());
  const [isTablet, setIsTablet] = useState(matchesBreakpoint('md'));
  const [isDesktop, setIsDesktop] = useState(matchesBreakpoint('lg'));

  // Update viewport on resize
  useEffect(() => {
    const handleResize = throttle(() => {
      const newSize = getViewportSize();
      setViewport(newSize);
      setOrientation(isPortraitOrientation() ? 'portrait' : 'landscape');
      setIsMobile(isMobileDevice());
      setIsTablet(matchesBreakpoint('md'));
      setIsDesktop(matchesBreakpoint('lg'));
    }, 250);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    viewport,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice: isTouchDevice(),
    prefersReducedMotion: prefersReducedMotion(),
    prefersDarkMode: prefersDarkMode()
  };
};

/**
 * Hook for managing mobile modal state
 * Handles open/close state with body scroll control
 *
 * @param {boolean} initialState - Initial modal open state
 * @returns {Object} Modal state and methods
 */
export const useMobileModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
    // Prevent body scroll when modal is open
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Re-enable body scroll
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  return {
    isOpen,
    open,
    close,
    toggle
  };
};

/**
 * Hook for managing form state with mobile optimizations
 * Auto-focuses on first field and handles keyboard events
 *
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Submit callback
 * @returns {Object} Form state and methods
 */
export const useMobileForm = (initialValues = {}, onSubmit = () => {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  }, []);

  const handleFocus = useCallback((e) => {
    const { name } = e.target;
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  }, [errors]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        await onSubmit(values);
      } catch (err) {
        console.error('Form submission error:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, onSubmit]
  );

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleFocus,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError
  };
};

/**
 * Hook for managing list scroll position and loading
 * Useful for infinite scroll lists on mobile
 *
 * @param {Function} loadMore - Callback when scroll reaches bottom
 * @param {number} threshold - Pixel threshold from bottom
 * @returns {Object} Scroll state and ref
 */
export const useMobileListScroll = (loadMore, threshold = 200) => {
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useCallback(node => {
    if (!node) return;

    const handleScroll = throttle(() => {
      if (isLoading) return;

      const { scrollHeight, scrollTop, clientHeight } = node;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceToBottom < threshold) {
        setIsLoading(true);
        loadMore(() => setIsLoading(false));
      }
    }, 250);

    node.addEventListener('scroll', handleScroll);

    return () => {
      node.removeEventListener('scroll', handleScroll);
    };
  }, [loadMore, isLoading, threshold]);

  return {
    scrollRef,
    isLoading,
    setIsLoading
  };
};

/**
 * Hook for handling mobile orientation changes
 *
 * @param {Function} onOrientationChange - Callback on orientation change
 * @returns {string} Current orientation ('portrait' or 'landscape')
 */
export const useMobileOrientation = (onOrientationChange) => {
  const [orientation, setOrientation] = useState(
    isPortraitOrientation() ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      const newOrientation = isPortraitOrientation() ? 'portrait' : 'landscape';
      setOrientation(newOrientation);

      if (onOrientationChange) {
        onOrientationChange(newOrientation);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [onOrientationChange]);

  return orientation;
};

/**
 * Hook for managing debounced value (useful for search inputs)
 *
 * @param {any} value - Value to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {any} Debounced value
 */
export const useMobileDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for managing touch interactions
 * Detects swipe, long press, and double tap
 *
 * @param {Object} options - Callback options {onSwipeLeft, onSwipeRight, onLongPress, onDoubleTap}
 * @returns {Object} Touch event handlers and state
 */
export const useMobileTouch = (options = {}) => {
  const [touch, setTouch] = useState({
    startX: 0,
    startY: 0,
    startTime: 0,
    lastTapTime: 0
  });

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    setTouch(prev => ({
      ...prev,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now()
    }));
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();

    const diffX = Math.abs(endX - touch.startX);
    const diffY = Math.abs(endY - touch.startY);
    const duration = endTime - touch.startTime;

    // Swipe detection (> 50px movement, < 300ms)
    if (diffX > 50 && diffY < 50 && duration < 300) {
      if (endX < touch.startX && options.onSwipeLeft) {
        options.onSwipeLeft();
      } else if (endX > touch.startX && options.onSwipeRight) {
        options.onSwipeRight();
      }
    }

    // Long press detection (> 500ms stationary)
    if (diffX < 10 && diffY < 10 && duration > 500 && options.onLongPress) {
      options.onLongPress();
    }

    // Double tap detection
    if (duration < 300 && endTime - touch.lastTapTime < 300) {
      if (options.onDoubleTap) {
        options.onDoubleTap();
      }
      setTouch(prev => ({
        ...prev,
        lastTapTime: 0
      }));
    } else {
      setTouch(prev => ({
        ...prev,
        lastTapTime: endTime
      }));
    }
  }, [touch, options]);

  return {
    handleTouchStart,
    handleTouchEnd
  };
};

/**
 * Hook for managing keyboard visibility (mobile)
 * Note: This is a heuristic and not always accurate
 *
 * @returns {boolean} Is keyboard visible
 */
export const useMobileKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleResize = throttle(() => {
      const initialHeight = window.screen.height;
      const currentHeight = window.innerHeight;
      setIsKeyboardVisible(currentHeight < initialHeight * 0.75);
    }, 250);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardVisible;
};

export default {
  useMobileResponsive,
  useMobileModal,
  useMobileForm,
  useMobileListScroll,
  useMobileOrientation,
  useMobileDebounce,
  useMobileTouch,
  useMobileKeyboardVisible
};
