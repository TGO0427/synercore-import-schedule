// src/utils/socketClient.js
import { io } from 'socket.io-client';
import { getApiUrl } from '../config/api';

// Determine socket server URL
const getSocketURL = () => {
  // In production, use the API base URL from environment
  if (process.env.NODE_ENV === 'production') {
    const apiUrl = getApiUrl('');
    // Remove /api if present and return the base URL
    return apiUrl.replace('/api', '');
  }

  // In development, connect to backend server
  const apiUrl = getApiUrl('');
  // Convert API URL to socket URL (remove /api if present)
  return apiUrl.replace('/api', '');
};

// Helper to log connection diagnostics
const logDiagnostics = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [SocketClient] ${message}`, data);
};

class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize Socket.io connection
   * @param {string} token - JWT token for authentication
   */
  connect(token = null) {
    if (this.socket?.connected) {
      logDiagnostics('Already connected, skipping connection attempt');
      return; // Already connected
    }

    try {
      // Get token from localStorage if not provided
      const authToken = token || localStorage.getItem('auth_access_token') || localStorage.getItem('token');
      const supplierToken = localStorage.getItem('supplier_token');
      const hasToken = !!(authToken || supplierToken);

      const socketURL = getSocketURL();
      logDiagnostics('Attempting connection', {
        url: socketURL,
        hasAuthToken: hasToken,
        env: process.env.NODE_ENV,
        apiBase: getApiUrl('')
      });

      // Create socket connection with authentication
      this.socket = io(socketURL, {
        auth: {
          token: authToken || supplierToken || null
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        transports: ['websocket', 'polling'],
        upgrade: true,
        rejectUnauthorized: false // Allow self-signed certs in dev
      });

      // Setup event listeners
      this.socket.on('connect', () => this.handleConnect());
      this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
      this.socket.on('connect_error', (error) => this.handleError(error));
      this.socket.on('error', (error) => this.handleError(error));

      // Log reconnection attempts
      this.socket.on('reconnect_attempt', () => {
        logDiagnostics('Reconnection attempt', { attempt: this.reconnectAttempts + 1 });
      });

      // Log successful reconnection
      this.socket.on('reconnect', () => {
        logDiagnostics('Successfully reconnected', { socketId: this.socket.id });
      });

      return this.socket;
    } catch (error) {
      console.error('[SocketClient] Connection error:', error);
      logDiagnostics('Fatal connection error', { error: error.message });
      return null;
    }
  }

  /**
   * Handle successful connection
   */
  handleConnect() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    logDiagnostics('✓ Connected successfully', {
      socketId: this.socket.id,
      transport: this.socket.io.engine.transport.name
    });
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(reason) {
    this.isConnected = false;
    logDiagnostics('✗ Disconnected', { reason });
  }

  /**
   * Handle connection errors
   */
  handleError(error) {
    this.reconnectAttempts++;
    const errorMessage = error?.message || error?.data || String(error);

    logDiagnostics('✗ Connection error', {
      error: errorMessage,
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logDiagnostics('✗ Max reconnection attempts reached - WebSocket will be unavailable', {
        totalAttempts: this.reconnectAttempts,
        fallback: 'Using polling mode for data updates'
      });
      this.disconnect();
    }
  }

  /**
   * Emit event to server
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {Function} callback - Optional callback for acknowledgment
   */
  emit(event, data, callback = null) {
    if (!this.socket?.connected) {
      console.warn('[SocketClient] Not connected. Event not sent:', event);
      return;
    }

    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen for event from server
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn('[SocketClient] Socket not initialized');
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * Listen for event once
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  once(event, callback) {
    if (!this.socket) {
      console.warn('[SocketClient] Socket not initialized');
      return;
    }

    this.socket.once(event, callback);
  }

  /**
   * Stop listening for event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.socket) return;

    this.socket.off(event, callback);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  connected() {
    return this.isConnected && this.socket?.connected;
  }

  /**
   * Get socket ID
   * @returns {string} Socket ID
   */
  getId() {
    return this.socket?.id || null;
  }

  /**
   * Reconnect to server
   */
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.connect();
    }
  }

  /**
   * Join a room (shipment update room)
   * @param {string} shipmentId - Shipment ID
   */
  joinShipment(shipmentId) {
    this.emit('join:shipment', { shipmentId });
  }

  /**
   * Leave a room
   * @param {string} shipmentId - Shipment ID
   */
  leaveShipment(shipmentId) {
    this.emit('leave:shipment', { shipmentId });
  }
}

// Create singleton instance
const socketClient = new SocketClient();

export default socketClient;
