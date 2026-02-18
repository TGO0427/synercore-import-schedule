// server/websocket/socketManager.ts
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { AuthenticatedSocket, UserViewingNotification, UserDisconnectedNotification } from '../types/index.js';

// Extend Socket type to include authentication properties
interface AuthSocket extends Socket {
  userId?: string | null;
  userRole?: 'user' | 'admin' | 'supplier' | 'guest';
}

// Track connected users per shipment for collaboration features
const userViewingShipments = new Map<string | null | undefined, Set<string>>();
const shipmentConnections = new Map<string, Set<string>>();

class SocketManager {
  private io: Server | null = null;

  /**
   * Initialize Socket.io with Express server
   * @param httpServer - Express app wrapped in http.createServer()
   * @returns Socket.io instance
   */
  initialize(httpServer: any): Server {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:5173',
      process.env.FRONTEND_URL || 'https://synercore-frontend.vercel.app',
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ];

    console.log('[SocketManager] Initializing with allowed origins:', allowedOrigins);

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

    // Handle connection errors at server level
    this.io.engine.on('connection_error', (err: any) => {
      console.error('[SocketManager] Engine connection error:', {
        code: err.code,
        message: err.message,
        context: err.context
      });
    });

    console.log('✓ Socket.io initialized successfully');
    console.log(`✓ Listening for WebSocket connections on configured transports: websocket, polling`);
    return this.io;
  }

  /**
   * Authenticate WebSocket connections using JWT
   * @param socket - Socket.io socket instance
   * @param next - Next middleware handler
   */
  async authenticateConnection(socket: AuthSocket, next: Function): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        // Allow unauthenticated connections for supplier portal (they have supplier_token in localStorage)
        socket.userId = null;
        socket.userRole = 'guest';
        console.log(`[SocketManager] Guest connection established: ${socket.id}`);
        return next();
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.userId = decoded.id;
      socket.userRole = decoded.role || 'user';

      console.log(`[SocketManager] Authenticated connection: userId=${socket.userId}, role=${socket.userRole}, socketId=${socket.id}`);

      next();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown authentication error';
      console.error('[SocketManager] Socket authentication failed:', {
        error: errorMsg,
        socketId: socket.id,
        hasToken: !!socket.handshake.auth.token
      });
      next(new Error('Authentication error: ' + errorMsg));
    }
  }

  /**
   * Handle new WebSocket connections
   * @param socket - Socket.io socket instance
   */
  handleConnection(socket: AuthSocket): void {
    console.log(`[SocketManager] ✓ Connection established: user=${socket.userId || 'guest'}, socketId=${socket.id}`);

    // User joins a shipment to watch for updates
    socket.on('join:shipment', (data: any) => this.handleJoinShipment(socket, data));

    // User leaves a shipment
    socket.on('leave:shipment', (data: any) => this.handleLeaveShipment(socket, data));

    // Handle disconnection
    socket.on('disconnect', (reason: string) => this.handleDisconnect(socket, reason));

    // Handle connection errors
    socket.on('error', (error: any) => {
      console.error(`[SocketManager] Socket error for ${socket.id}:`, error);
    });

    // Heartbeat for connection keep-alive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  /**
   * Handle user joining a shipment room
   * @param socket - Socket.io socket instance
   * @param data - { shipmentId }
   */
  handleJoinShipment(socket: AuthSocket, data: any): void {
    const { shipmentId } = data;

    if (!shipmentId) return socket.emit('error', { message: 'shipmentId required' });

    const roomName = `shipment:${shipmentId}`;
    socket.join(roomName);

    // Track user viewing this shipment
    if (!userViewingShipments.has(socket.userId)) {
      userViewingShipments.set(socket.userId, new Set());
    }
    userViewingShipments.get(socket.userId)!.add(shipmentId);

    // Track socket connection for this shipment
    if (!shipmentConnections.has(shipmentId)) {
      shipmentConnections.set(shipmentId, new Set());
    }
    shipmentConnections.get(shipmentId)!.add(socket.id);

    // Notify others in the room that a user is viewing
    const notification: UserViewingNotification = {
      userId: socket.userId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    };
    socket.to(roomName).emit('user:viewing', notification);

    // Send confirmation to requester
    socket.emit('shipment:joined', {
      shipmentId,
      viewersCount: shipmentConnections.get(shipmentId)!.size,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] User ${socket.userId} joined shipment ${shipmentId} (viewers: ${shipmentConnections.get(shipmentId)!.size})`);
  }

  /**
   * Handle user leaving a shipment room
   * @param socket - Socket.io socket instance
   * @param data - { shipmentId }
   */
  handleLeaveShipment(socket: AuthSocket, data: any): void {
    const { shipmentId } = data;

    if (!shipmentId) return;

    const roomName = `shipment:${shipmentId}`;
    socket.leave(roomName);

    // Clean up tracking
    if (userViewingShipments.has(socket.userId)) {
      userViewingShipments.get(socket.userId)!.delete(shipmentId);
    }

    if (shipmentConnections.has(shipmentId)) {
      shipmentConnections.get(shipmentId)!.delete(socket.id);

      // Notify others that a user left
      if (shipmentConnections.get(shipmentId)!.size === 0) {
        shipmentConnections.delete(shipmentId);
      } else {
        const notification: UserDisconnectedNotification = {
          userId: socket.userId,
          socketId: socket.id,
          viewersCount: shipmentConnections.get(shipmentId)!.size,
          timestamp: new Date().toISOString()
        };
        this.io!.to(roomName).emit('user:disconnected', notification);
      }
    }

    console.log(`[Socket] User ${socket.userId} left shipment ${shipmentId}`);
  }

  /**
   * Handle user disconnection
   * @param socket - Socket.io socket instance
   * @param reason - Disconnection reason
   */
  handleDisconnect(socket: AuthSocket, reason: string): void {
    console.log(`[SocketManager] ✗ Disconnection: user=${socket.userId || 'guest'}, socketId=${socket.id}, reason=${reason}`);

    // Clean up all shipment tracking for this user
    if (userViewingShipments.has(socket.userId)) {
      const shipments = Array.from(userViewingShipments.get(socket.userId)!);
      shipments.forEach(shipmentId => {
        const roomName = `shipment:${shipmentId}`;

        if (shipmentConnections.has(shipmentId)) {
          shipmentConnections.get(shipmentId)!.delete(socket.id);

          if (shipmentConnections.get(shipmentId)!.size === 0) {
            shipmentConnections.delete(shipmentId);
          } else {
            // Notify remaining users
            const notification: UserDisconnectedNotification = {
              userId: socket.userId,
              socketId: socket.id,
              viewersCount: shipmentConnections.get(shipmentId)!.size,
              timestamp: new Date().toISOString()
            };
            this.io!.to(roomName).emit('user:disconnected', notification);
          }
        }
      });
      userViewingShipments.delete(socket.userId);
    }
  }

  /**
   * Broadcast shipment status update to all viewers
   * @param shipmentId - Shipment ID
   * @param updates - Update data
   */
  broadcastShipmentUpdate(shipmentId: string, updates: any): void {
    const roomName = `shipment:${shipmentId}`;
    this.io!.to(roomName).emit('shipment:updated', {
      shipmentId,
      ...updates,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcast shipment update for ${shipmentId}: ${updates.status || 'unknown'}`);
  }

  /**
   * Broadcast document upload to all viewers
   * @param shipmentId - Shipment ID
   * @param document - Document details
   */
  broadcastDocumentUpload(shipmentId: string, document: any): void {
    const roomName = `shipment:${shipmentId}`;
    this.io!.to(roomName).emit('document:uploaded', {
      shipmentId,
      document,
      timestamp: new Date().toISOString()
    });

    console.log(`[Socket] Broadcast document upload for ${shipmentId}: ${document.fileName}`);
  }

  /**
   * Get list of users currently viewing a shipment
   * @param shipmentId - Shipment ID
   * @returns Set of socket IDs
   */
  getShipmentViewers(shipmentId: string): Set<string> {
    return shipmentConnections.get(shipmentId) || new Set();
  }

  /**
   * Get all shipments a user is currently viewing
   * @param userId - User ID
   * @returns Set of shipment IDs
   */
  getUserViewingShipments(userId: string | null | undefined): Set<string> {
    return userViewingShipments.get(userId) || new Set();
  }

  /**
   * Get Socket.io instance
   * @returns Socket.io instance
   */
  getIO(): Server | null {
    return this.io;
  }

  /**
   * Gracefully shutdown Socket.io
   */
  shutdown(): void {
    if (this.io) {
      this.io.close();
      console.log('✓ Socket.io shutdown gracefully');
    }
  }
}

// Export singleton instance
export default new SocketManager();
