import { useEffect, useRef, useCallback, useState } from 'react';

const PREFIX = 'synercore_draft_';

/**
 * Auto-saves form data to localStorage with debounce.
 * Restores saved draft on mount. Clears on successful submit.
 *
 * @param {string} key - Unique draft key (e.g. 'costing_new', 'shipment_abc123')
 * @param {object} formData - Current form state
 * @param {function} setFormData - State setter to restore draft into
 * @param {object} options
 * @param {number} options.debounceMs - Debounce delay in ms (default 1000)
 * @param {boolean} options.enabled - Whether drafting is active (default true)
 * @returns {{ clearDraft: function, hasDraft: boolean }}
 */
export default function useFormDraft(key, formData, setFormData, { debounceMs = 1000, enabled = true } = {}) {
  const storageKey = PREFIX + key;
  const [hasDraft, setHasDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const timerRef = useRef(null);
  const initializedRef = useRef(false);

  // Restore draft when enabled (once per enable cycle)
  useEffect(() => {
    if (!enabled) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          setFormData(prev => ({ ...prev, ...saved }));
          setHasDraft(true);
        }
      }
    } catch {
      // Corrupt data — remove it
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, enabled, setFormData]);

  // Debounced save on formData change
  useEffect(() => {
    if (!enabled || !initializedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsDirty(true);

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formData, storageKey, debounceMs, enabled]);

  // Reset initialization when disabled so re-enabling restores draft again
  useEffect(() => {
    if (!enabled) {
      initializedRef.current = false;
      setIsDirty(false);
    }
  }, [enabled]);

  // Warn user about unsaved changes before leaving the page.
  // Triggers whenever the form/dialog is active (enabled=true).
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  // Clear draft (call on successful submit)
  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setIsDirty(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [storageKey]);

  return { clearDraft, hasDraft, isDirty };
}
