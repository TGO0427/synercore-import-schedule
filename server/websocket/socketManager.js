// server/websocket/socketManager.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Track connected users per shipment for collaboration features
const userViewingShipments = new Map();
const shipmentConnections = new Map();

class SocketManager {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.io with Express server
   * @param {http.Server} httpServer - Express app wrapped in http.createServer()
   * @returns {Server} Socket.io instance
   */
  initialize(httpServer) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:5173',
      process.env.FRONTEND_URL || 'https://synercore-frontend.vercel.app',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ];

    this.io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
        maxAge: 86400
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 60000,
      maxHttpBufferSize: 1e6,
    });

    // Authenticate WebSocket connections
    this.io.use(this.authenticateConnection.bind(this));

    // Handle new connections
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('✓ Socket.io initialized');
    return this.io;
  }

  /**
   * Authenticate WebSocket connections using JWT
   * @param {Socket} socket - Socket.io socket instance
   * @param {Function} next - Next middleware handler
   */
  async authenticateConnection(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        // Allow unauthenticated connections for supplier portal (they have supplier_token in localStorage)
        socket.userId = null;
        socket.userRole = 'guest';
        return next();
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.id;
      socket.userRole = decoded.role || 'user';

      next();
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      next(new Error('Authentication error'));
    }
  }

  /**
   * Handle new WebSocket connections
   * @param {Socket} socket - Socket.io socket instance
   */
  handleConnection(socket) {
    console.log(`[Socket] User ${socket.userId || 'guest'} connected: ${socket.id}`);

    // User joins a shipment to watch for updates
    socket.on('join:shipment', (data) => this.handleJoinShipment(socket, data));

    // User leaves a shipment
    socket.on('leave:shipment', (data) => this.handleLeaveShipment(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Heartbeat for connection keep-alive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  /**
   * Handle user joining a shipment room
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - { shipmentId }
   */
  handleJoinShipment(socket, data) {
    const { shipmentId } = data;

    if (!shipmentId) return socket.emit('error', { message: 'shipmentId required' });

    const roomName = `shipment:${shipmentId}`;
    socket.join(roomName);

    // Track user viewing this shipment
    if (!userViewingShipments.has(socket.userId)) {
      userViewingShipments.set(socket.userId, new Set());
    }
    userViewingShipments.get(socket.userId).add(shipmentId);

    // Track socket connection for this shipment
    if (!shipmentConnections.has(shipmentId)) {
      shipmentConnections.set(shipmentId, new Set());
    }
    shipmentConnections.get(shipmentId).add(socket.id);

    // Notify others in the room that a user is viewing
    socket.to(roomName).emit('user:viewing', {
      userId: socket.userId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Send confirmation to requester
    socket.emit('shipment:joined', {
      shipmentId,
      viewersCount: shipmentConnections.get(shipmentId).size,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] User ${socket.userId} joined shipment ${shipmentId} (viewers: ${shipmentConnections.get(shipmentId).size})`);
  }

  /**
   * Handle user leaving a shipment room
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - { shipmentId }
   */
  handleLeaveShipment(socket, data) {
    const { shipmentId } = data;

    if (!shipmentId) return;

    const roomName = `shipment:${shipmentId}`;
    socket.leave(roomName);

    // Clean up tracking
    if (userViewingShipments.has(socket.userId)) {
      userViewingShipments.get(socket.userId).delete(shipmentId);
    }

    if (shipmentConnections.has(shipmentId)) {
      shipmentConnections.get(shipmentId).delete(socket.id);

      // Notify others that a user left
      if (shipmentConnections.get(shipmentId).size === 0) {
        shipmentConnections.delete(shipmentId);
      } else {
        this.io.to(roomName).emit('user:disconnected', {
          userId: socket.userId,
          socketId: socket.id,
          viewersCount: shipmentConnections.get(shipmentId).size,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`[Socket] User ${socket.userId} left shipment ${shipmentId}`);
  }

  /**
   * Handle user disconnection
   * @param {Socket} socket - Socket.io socket instance
   */
  handleDisconnect(socket) {
    console.log(`[Socket] User ${socket.userId || 'guest'} disconnected: ${socket.id}`);

    // Clean up all shipment tracking for this user
    if (userViewingShipments.has(socket.userId)) {
      const shipments = Array.from(userViewingShipments.get(socket.userId));
      shipments.forEach(shipmentId => {
        const roomName = `shipment:${shipmentId}`;

        if (shipmentConnections.has(shipmentId)) {
          shipmentConnections.get(shipmentId).delete(socket.id);

          if (shipmentConnections.get(shipmentId).size === 0) {
            shipmentConnections.delete(shipmentId);
          } else {
            // Notify remaining users
            this.io.to(roomName).emit('user:disconnected', {
              userId: socket.userId,
              socketId: socket.id,
              viewersCount: shipmentConnections.get(shipmentId).size,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
      userViewingShipments.delete(socket.userId);
    }
  }

  /**
   * Broadcast shipment status update to all viewers
   * @param {string} shipmentId - Shipment ID
   * @param {Object} updates - { status, updatedAt, updatedBy, ... }
   */
  broadcastShipmentUpdate(shipmentId, updates) {
    const roomName = `shipment:${shipmentId}`;
    this.io.to(roomName).emit('shipment:updated', {
      shipmentId,
      ...updates,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcast shipment update for ${shipmentId}: ${updates.status || 'unknown'}`);
  }

  /**
   * Broadcast document upload to all viewers
   * @param {string} shipmentId - Shipment ID
   * @param {Object} document - Document details { fileName, documentType, uploadedBy, ... }
   */
  broadcastDocumentUpload(shipmentId, document) {
    const roomName = `shipment:${shipmentId}`;
    this.io.to(roomName).emit('document:uploaded', {
      shipmentId,
      document,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcast document upload for ${shipmentId}: ${document.fileName}`);
  }

  /**
   * Get list of users currently viewing a shipment
   * @param {string} shipmentId - Shipment ID
   * @returns {Set} Set of socket IDs
   */
  getShipmentViewers(shipmentId) {
    return shipmentConnections.get(shipmentId) || new Set();
  }

  /**
   * Get all shipments a user is currently viewing
   * @param {string} userId - User ID
   * @returns {Set} Set of shipment IDs
   */
  getUserViewingShipments(userId) {
    return userViewingShipments.get(userId) || new Set();
  }

  /**
   * Get Socket.io instance
   * @returns {Server} Socket.io instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Gracefully shutdown Socket.io
   */
  shutdown() {
    if (this.io) {
      this.io.close();
      console.log('✓ Socket.io shutdown gracefully');
    }
  }
}

// Export singleton instance
export default new SocketManager();
