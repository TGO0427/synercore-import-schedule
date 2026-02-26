// src/hooks/useAlerts.js
import { useState, useEffect, useCallback } from 'react';
import { computeShipmentAlerts, createCustomAlert } from '../utils/alerts';

export function useAlerts(shipments) {
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissedAlerts') || '[]')); }
    catch { return new Set(); }
  });

  // Whenever shipments change, recompute alerts
  useEffect(() => {
    setAlerts(prev => {
      const computed = computeShipmentAlerts(shipments);
      // preserve "read" state across recomputes, filter out dismissed
      const readSet = new Set(prev.filter(a => a.read).map(a => a.id));
      return computed
        .filter(a => !dismissedAlertIds.has(a.id))
        .map(a => ({ ...a, read: readSet.has(a.id) ? true : a.read || false }));
    });
  }, [shipments, dismissedAlertIds]);

  const handleAlertDismiss = useCallback((id) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('dismissedAlerts', JSON.stringify([...next]));
      return next;
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAlertMarkRead = useCallback((id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }, []);

  const pushAlert = useCallback((alert) => {
    setAlerts(prev => [
      createCustomAlert(alert.severity || 'info', alert.title, alert.description, alert.meta),
      ...prev
    ]);
  }, []);

  return {
    alerts,
    handleAlertDismiss,
    handleAlertMarkRead,
    pushAlert,
  };
}

export default useAlerts;
