// src/hooks/useWebSocket.js
import { useEffect, useCallback, useState } from 'react';
import socketClient from '../utils/socketClient';

/**
 * Custom hook for WebSocket integration
 * Handles connection, authentication, room management, and event listening
 *
 * Usage:
 * const { isConnected, joinShipment, leaveShipment, onShipmentUpdate, onDocumentUpload } = useWebSocket();
 *
 * useEffect(() => {
 *   onShipmentUpdate((data) => console.log('Shipment updated:', data));
 *   onDocumentUpload((data) => console.log('Document uploaded:', data));
 * }, [onShipmentUpdate, onDocumentUpload]);
 */
export function useWebSocket({ enabled = true } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeShipments, setActiveShipments] = useState(new Set());

  // Initialize WebSocket on mount
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      setActiveShipments(new Set());
      socketClient.disconnect({ force: true });
      return undefined;
    }

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socketClient.on('connect', handleConnect);
    socketClient.on('disconnect', handleDisconnect);

    // Initialize connection
    socketClient.connect();

    return () => {
      socketClient.off('connect', handleConnect);
      socketClient.off('disconnect', handleDisconnect);
      socketClient.disconnect();
    };
  }, [enabled]);

  /**
   * Join a shipment room to receive real-time updates
   * @param {string} shipmentId - Shipment ID
   */
  const joinShipment = useCallback((shipmentId) => {
    if (!enabled || !shipmentId) return;

    socketClient.emit('join:shipment', { shipmentId }, (response) => {
      if (response?.shipmentId) {
        setActiveShipments(prev => new Set(prev).add(shipmentId));
      }
    });
  }, [enabled]);

  /**
   * Leave a shipment room
   * @param {string} shipmentId - Shipment ID
   */
  const leaveShipment = useCallback((shipmentId) => {
    if (!enabled || !shipmentId) return;

    socketClient.emit('leave:shipment', { shipmentId });
    setActiveShipments(prev => {
      const updated = new Set(prev);
      updated.delete(shipmentId);
      return updated;
    });
  }, [enabled]);

  /**
   * Register callback for shipment updates
   * @param {Function} callback - Callback function that receives update data
   * @returns {Function} Unsubscribe function
   */
  const onShipmentUpdate = useCallback((callback) => {
    if (!enabled) return () => {};

    socketClient.on('shipment:updated', callback);

    return () => {
      socketClient.off('shipment:updated', callback);
    };
  }, [enabled]);

  /**
   * Register callback for document uploads
   * @param {Function} callback - Callback function that receives document data
   * @returns {Function} Unsubscribe function
   */
  const onDocumentUpload = useCallback((callback) => {
    if (!enabled) return () => {};

    socketClient.on('document:uploaded', callback);

    return () => {
      socketClient.off('document:uploaded', callback);
    };
  }, [enabled]);

  /**
   * Register callback for user viewing updates
   * @param {Function} callback - Callback function that receives user viewing data
   * @returns {Function} Unsubscribe function
   */
  const onUserViewing = useCallback((callback) => {
    if (!enabled) return () => {};

    socketClient.on('user:viewing', callback);

    return () => {
      socketClient.off('user:viewing', callback);
    };
  }, [enabled]);

  /**
   * Register callback for user disconnection
   * @param {Function} callback - Callback function that receives disconnect data
   * @returns {Function} Unsubscribe function
   */
  const onUserDisconnected = useCallback((callback) => {
    if (!enabled) return () => {};

    socketClient.on('user:disconnected', callback);

    return () => {
      socketClient.off('user:disconnected', callback);
    };
  }, [enabled]);

  /**
   * Register callback for warehouse capacity changes
   * @param {Function} callback - Callback function that receives capacity data
   * @returns {Function} Unsubscribe function
   */
  const onWarehouseCapacityChange = useCallback((callback) => {
    if (!enabled) return () => {};

    socketClient.on('warehouse:capacity_updated', callback);

    return () => {
      socketClient.off('warehouse:capacity_updated', callback);
    };
  }, [enabled]);

  /**
   * Emit custom event to server
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  const emit = useCallback((event, data) => {
    if (!enabled) return;
    socketClient.emit(event, data);
  }, [enabled]);

  return {
    isConnected,
    activeShipments: Array.from(activeShipments),
    joinShipment,
    leaveShipment,
    onShipmentUpdate,
    onDocumentUpload,
    onUserViewing,
    onUserDisconnected,
    onWarehouseCapacityChange,
    emit
  };
}

export default useWebSocket;
