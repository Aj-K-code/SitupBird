const WebSocket = require('ws');
const http = require('http');
const config = require('./config');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    // Generate 4-digit code
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // Production monitoring - get server stats
  getStats() {
    const stats = {
      totalRooms: this.rooms.size,
      activeConnections: 0,
      roomsWithTwoPlayers: 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    for (const room of this.rooms.values()) {
      stats.activeConnections += room.participants.length;
      if (room.participants.length === 2) {
        stats.roomsWithTwoPlayers++;
      }
    }

    return stats;
  }

  createRoom() {
    let code;
    // Ensure unique code
    do {
      code = this.generateRoomCode();
    } while (this.rooms.has(code));

    const room = {
      code,
      participants: [],
      createdAt: Date.now(),
      status: 'waiting'
    };

    this.rooms.set(code, room);
    
    // Production logging
    if (process.env.NODE_ENV === 'production') {
      console.log(`[${new Date().toISOString()}] Room created: ${code} | Total rooms: ${this.rooms.size}`);
    } else {
      console.log(`Room created: ${code}`);
    }
    
    return room;
  }

  joinRoom(code, socket) {
    const room = this.rooms.get(code);
    
    if (!room) {
      return { success: false, error: 'Room not found or is full' };
    }

    if (room.participants.length >= 2) {
      return { success: false, error: 'Room not found or is full' };
    }

    room.participants.push(socket);
    socket.roomCode = code;
    
    // Production logging with more detail
    if (process.env.NODE_ENV === 'production') {
      console.log(`[${new Date().toISOString()}] Client joined room: ${code} (${room.participants.length}/2) | Active connections: ${this.getActiveConnectionCount()}`);
    } else {
      console.log(`Client joined room: ${code} (${room.participants.length}/2)`);
    }
    
    return { success: true, room };
  }

  getActiveConnectionCount() {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.participants.length;
    }
    return count;
  }

  removeFromRoom(socket) {
    if (!socket.roomCode) return;

    const room = this.rooms.get(socket.roomCode);
    if (!room) return;

    const index = room.participants.indexOf(socket);
    if (index !== -1) {
      room.participants.splice(index, 1);
      
      // Production logging
      if (process.env.NODE_ENV === 'production') {
        console.log(`[${new Date().toISOString()}] Client left room: ${socket.roomCode} (${room.participants.length}/2) | Total rooms: ${this.rooms.size}`);
      } else {
        console.log(`Client left room: ${socket.roomCode} (${room.participants.length}/2)`);
      }
      
      // Notify remaining participant about disconnection
      if (room.participants.length > 0) {
        const remainingSocket = room.participants[0];
        this.sendMessage(remainingSocket, {
          type: 'PARTNER_DISCONNECTED'
        });
      }
      
      // Clean up empty rooms
      if (room.participants.length === 0) {
        this.rooms.delete(socket.roomCode);
        if (process.env.NODE_ENV === 'production') {
          console.log(`[${new Date().toISOString()}] Room deleted: ${socket.roomCode} | Remaining rooms: ${this.rooms.size}`);
        } else {
          console.log(`Room deleted: ${socket.roomCode}`);
        }
      }
    }
  }

  sendMessage(socket, message) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return true;
      } else {
        if (process.env.NODE_ENV === 'production') {
          console.warn(`[${new Date().toISOString()}] Attempted to send message to closed socket: ${socket.readyState}`);
        } else {
          console.warn('Attempted to send message to closed socket:', socket.readyState);
        }
        return false;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        console.error(`[${new Date().toISOString()}] Error sending message:`, error.message);
      } else {
        console.error('Error sending message:', error);
      }
      return false;
    }
  }

  routeMessage(fromSocket, message) {
    try {
      if (!fromSocket.roomCode) {
        console.warn('Attempted to route message from socket without room code');
        return false;
      }

      const room = this.rooms.get(fromSocket.roomCode);
      if (!room) {
        console.warn('Attempted to route message to non-existent room:', fromSocket.roomCode);
        this.sendMessage(fromSocket, {
          type: 'ERROR',
          message: 'Room no longer exists',
          code: 'ROOM_NOT_FOUND'
        });
        return false;
      }

      // Send message to other participant in the room
      const otherParticipant = room.participants.find(socket => socket !== fromSocket);
      if (otherParticipant) {
        return this.sendMessage(otherParticipant, message);
      } else {
        console.warn('No other participant found in room:', fromSocket.roomCode);
        this.sendMessage(fromSocket, {
          type: 'ERROR',
          message: 'No other participant in room',
          code: 'NO_PARTNER'
        });
        return false;
      }
    } catch (error) {
      console.error('Error routing message:', error);
      this.sendMessage(fromSocket, {
        type: 'ERROR',
        message: 'Error routing message',
        code: 'ROUTING_ERROR'
      });
      return false;
    }
  }

  // Cleanup old rooms based on configuration
  cleanupOldRooms() {
    const maxAge = config.roomMaxAge;
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt > maxAge) {
        // Close all connections in the room
        room.participants.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        });
        this.rooms.delete(code);
        cleanedCount++;
        
        if (process.env.NODE_ENV === 'production') {
          console.log(`[${new Date().toISOString()}] Cleaned up old room: ${code}`);
        } else {
          console.log(`Cleaned up old room: ${code}`);
        }
      }
    }
    
    // Log cleanup summary in production
    if (process.env.NODE_ENV === 'production' && cleanedCount > 0) {
      console.log(`[${new Date().toISOString()}] Cleanup completed: ${cleanedCount} rooms removed | Remaining: ${this.rooms.size}`);
    }
  }
}

class SignalingServer {
  constructor(port) {
    this.port = port;
    this.roomManager = new RoomManager();
    this.wss = null;
    this.server = null;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  start() {
    // Create HTTP server for health checks and WebSocket upgrade
    this.server = http.createServer((req, res) => {
      // Health check endpoint for Render
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          rooms: this.roomManager.rooms.size,
          environment: process.env.NODE_ENV || 'development'
        }));
        return;
      }
      
      // CORS headers based on configuration
      if (this.isProduction) {
        const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin];
        const origin = req.headers.origin;
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      
      // Default response
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('WebSocket server running');
    });

    // Create WebSocket server with configuration
    const wsOptions = {
      server: this.server,
      ...config.websocketOptions
    };
    this.wss = new WebSocket.Server(wsOptions);
    
    this.server.listen(this.port, () => {
      console.log(`Signaling server started on port ${this.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check available at: http://localhost:${this.port}/health`);
    });

    this.wss.on('connection', (socket, request) => {
      // Enhanced connection logging for production
      const clientIP = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
      const userAgent = request.headers['user-agent'];
      
      if (this.isProduction) {
        console.log(`[${new Date().toISOString()}] New client connected from ${clientIP} | Total connections: ${this.roomManager.getActiveConnectionCount() + 1}`);
      } else {
        console.log('New client connected');
      }

      // Set up connection metadata for monitoring
      socket.connectedAt = Date.now();
      socket.clientIP = clientIP;
      socket.userAgent = userAgent;

      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(socket, message);
        } catch (error) {
          if (this.isProduction) {
            console.error(`[${new Date().toISOString()}] Invalid message format from ${clientIP}:`, error.message);
          } else {
            console.error('Invalid message format:', error);
          }
          this.roomManager.sendMessage(socket, {
            type: 'ERROR',
            message: 'Invalid message format'
          });
        }
      });

      socket.on('close', (code, reason) => {
        if (this.isProduction) {
          const duration = Date.now() - socket.connectedAt;
          console.log(`[${new Date().toISOString()}] Client disconnected from ${clientIP} | Duration: ${Math.round(duration/1000)}s | Code: ${code}`);
        } else {
          console.log('Client disconnected');
        }
        this.roomManager.removeFromRoom(socket);
      });

      socket.on('error', (error) => {
        if (this.isProduction) {
          console.error(`[${new Date().toISOString()}] WebSocket error from ${clientIP}:`, error.message);
        } else {
          console.error('WebSocket error:', error);
        }
        this.roomManager.removeFromRoom(socket);
      });
    });

    // Cleanup old rooms based on configuration
    setInterval(() => {
      this.roomManager.cleanupOldRooms();
    }, config.roomCleanupInterval);

    // Production monitoring based on configuration
    if (config.enableStats) {
      setInterval(() => {
        const stats = this.roomManager.getStats();
        console.log(`[${new Date().toISOString()}] Server Stats:`, JSON.stringify(stats));
      }, config.statsInterval);
    }
  }

  handleMessage(socket, message) {
    if (this.isProduction) {
      // Only log non-sensor messages in production to reduce noise
      if (message.type !== 'SENSOR_DATA') {
        console.log(`[${new Date().toISOString()}] Received message: ${message.type} from ${socket.clientIP}`);
      }
    } else {
      console.log('Received message:', message.type);
    }

    try {
      switch (message.type) {
        case 'CREATE_ROOM':
          this.handleCreateRoom(socket);
          break;
          
        case 'JOIN_ROOM':
          this.handleJoinRoom(socket, message.code);
          break;
          
        case 'SENSOR_DATA':
        case 'CALIBRATION_DATA':
          // Enhanced debugging for sensor data routing
          if (message.type === 'SENSOR_DATA') {
            console.log(`📡 Routing ${message.type} from ${socket.clientIP} in room ${socket.roomCode}`);
          }
          // Route these messages to the paired device
          const routeSuccess = this.roomManager.routeMessage(socket, message);
          if (!routeSuccess && message.type === 'SENSOR_DATA') {
            console.warn(`❌ Failed to route ${message.type} in room ${socket.roomCode}`);
          }
          break;
          
        default:
          if (this.isProduction) {
            console.warn(`[${new Date().toISOString()}] Unknown message type: ${message.type} from ${socket.clientIP}`);
          } else {
            console.warn('Unknown message type:', message.type);
          }
          this.roomManager.sendMessage(socket, {
            type: 'ERROR',
            message: 'Unknown message type',
            code: 'UNKNOWN_MESSAGE_TYPE'
          });
      }
    } catch (error) {
      if (this.isProduction) {
        console.error(`[${new Date().toISOString()}] Error handling message from ${socket.clientIP}:`, error.message);
      } else {
        console.error('Error handling message:', error);
      }
      this.roomManager.sendMessage(socket, {
        type: 'ERROR',
        message: 'Server error occurred while processing request',
        code: 'SERVER_ERROR'
      });
    }
  }

  handleCreateRoom(socket) {
    try {
      const room = this.roomManager.createRoom();
      const joinResult = this.roomManager.joinRoom(room.code, socket);
      
      if (joinResult.success) {
        this.roomManager.sendMessage(socket, {
          type: 'ROOM_CREATED',
          code: room.code
        });
      } else {
        this.roomManager.sendMessage(socket, {
          type: 'ERROR',
          message: 'Failed to create room: ' + joinResult.error,
          code: 'ROOM_CREATION_FAILED'
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      this.roomManager.sendMessage(socket, {
        type: 'ERROR',
        message: 'Server error while creating room',
        code: 'ROOM_CREATION_ERROR'
      });
    }
  }

  handleJoinRoom(socket, code) {
    try {
      // Validate room code format
      if (!code) {
        this.roomManager.sendMessage(socket, {
          type: 'ERROR',
          message: 'Room code is required',
          code: 'MISSING_ROOM_CODE'
        });
        return;
      }

      if (typeof code !== 'string' || code.length !== 4 || !/^\d{4}$/.test(code)) {
        this.roomManager.sendMessage(socket, {
          type: 'ERROR',
          message: 'Invalid room code format. Please enter a 4-digit code.',
          code: 'INVALID_ROOM_CODE'
        });
        return;
      }

      const joinResult = this.roomManager.joinRoom(code, socket);
      
      if (joinResult.success) {
        const room = joinResult.room;
        
        // Send success to joining client
        this.roomManager.sendMessage(socket, {
          type: 'CONNECTION_SUCCESS'
        });
        
        // If room is now full, notify both participants
        if (room.participants.length === 2) {
          room.participants.forEach(participant => {
            this.roomManager.sendMessage(participant, {
              type: 'ROOM_FULL'
            });
          });
        }
      } else {
        // Provide specific error codes for different scenarios
        let errorCode = 'ROOM_JOIN_FAILED';
        if (joinResult.error.includes('not found')) {
          errorCode = 'ROOM_NOT_FOUND';
        } else if (joinResult.error.includes('full')) {
          errorCode = 'ROOM_FULL';
        }
        
        this.roomManager.sendMessage(socket, {
          type: 'ERROR',
          message: joinResult.error,
          code: errorCode
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      this.roomManager.sendMessage(socket, {
        type: 'ERROR',
        message: 'Server error while joining room',
        code: 'ROOM_JOIN_ERROR'
      });
    }
  }
}

// Get port from environment or default to 8080
const PORT = process.env.PORT || 8080;

// Create and start the signaling server
const server = new SignalingServer(PORT);
server.start();

// Graceful shutdown with enhanced logging
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully`);
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully`);
  gracefulShutdown();
});

// Handle uncaught exceptions in production
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
  if (process.env.NODE_ENV === 'production') {
    // Log error and attempt graceful shutdown
    gracefulShutdown();
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    // Log error but don't exit in production
    console.error('Continuing execution despite unhandled rejection');
  }
});

function gracefulShutdown() {
  const stats = server.roomManager.getStats();
  console.log(`[${new Date().toISOString()}] Shutdown stats:`, JSON.stringify(stats));
  
  if (server.wss) {
    // Close all WebSocket connections
    server.wss.clients.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1001, 'Server shutting down');
      }
    });
    
    server.wss.close(() => {
      console.log(`[${new Date().toISOString()}] WebSocket server closed`);
      if (server.server) {
        server.server.close(() => {
          console.log(`[${new Date().toISOString()}] HTTP server closed`);
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
}