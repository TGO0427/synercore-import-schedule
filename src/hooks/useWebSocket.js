// src/hooks/useWebSocket.js
import { useEffect, useRef, useCallback, useState } from 'react';
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
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeShipments, setActiveShipments] = useState(new Set());
  const listenerRefsRef = useRef({});

  // Initialize WebSocket on mount
  useEffect(() => {
    const handleConnect = () => {
      console.log('[useWebSocket] Connected to server');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('[useWebSocket] Disconnected from server');
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
  }, []);

  /**
   * Join a shipment room to receive real-time updates
   * @param {string} shipmentId - Shipment ID
   */
  const joinShipment = useCallback((shipmentId) => {
    if (!shipmentId) return;

    socketClient.emit('join:shipment', { shipmentId }, (response) => {
      if (response?.shipmentId) {
        setActiveShipments(prev => new Set(prev).add(shipmentId));
        console.log(`[useWebSocket] Joined shipment ${shipmentId}`);
      }
    });
  }, []);

  /**
   * Leave a shipment room
   * @param {string} shipmentId - Shipment ID
   */
  const leaveShipment = useCallback((shipmentId) => {
    if (!shipmentId) return;

    socketClient.emit('leave:shipment', { shipmentId });
    setActiveShipments(prev => {
      const updated = new Set(prev);
      updated.delete(shipmentId);
      return updated;
    });
    console.log(`[useWebSocket] Left shipment ${shipmentId}`);
  }, []);

  /**
   * Register callback for shipment updates
   * @param {Function} callback - Callback function that receives update data
   * @returns {Function} Unsubscribe function
   */
  const onShipmentUpdate = useCallback((callback) => {
    socketClient.on('shipment:updated', callback);

    return () => {
      socketClient.off('shipment:updated', callback);
    };
  }, []);

  /**
   * Register callback for document uploads
   * @param {Function} callback - Callback function that receives document data
   * @returns {Function} Unsubscribe function
   */
  const onDocumentUpload = useCallback((callback) => {
    socketClient.on('document:uploaded', callback);

    return () => {
      socketClient.off('document:uploaded', callback);
    };
  }, []);

  /**
   * Register callback for user viewing updates
   * @param {Function} callback - Callback function that receives user viewing data
   * @returns {Function} Unsubscribe function
   */
  const onUserViewing = useCallback((callback) => {
    socketClient.on('user:viewing', callback);

    return () => {
      socketClient.off('user:viewing', callback);
    };
  }, []);

  /**
   * Register callback for user disconnection
   * @param {Function} callback - Callback function that receives disconnect data
   * @returns {Function} Unsubscribe function
   */
  const onUserDisconnected = useCallback((callback) => {
    socketClient.on('user:disconnected', callback);

    return () => {
      socketClient.off('user:disconnected', callback);
    };
  }, []);

  /**
   * Register callback for warehouse capacity changes
   * @param {Function} callback - Callback function that receives capacity data
   * @returns {Function} Unsubscribe function
   */
  const onWarehouseCapacityChange = useCallback((callback) => {
    socketClient.on('warehouse:capacity_updated', callback);

    return () => {
      socketClient.off('warehouse:capacity_updated', callback);
    };
  }, []);

  /**
   * Emit custom event to server
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  const emit = useCallback((event, data) => {
    socketClient.emit(event, data);
  }, []);

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
