const WebSocket = require('ws');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomCode() {
    // Generate 4-digit code
    return Math.floor(1000 + Math.random() * 9000).toString();
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
    console.log(`Room created: ${code}`);
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
    
    console.log(`Client joined room: ${code} (${room.participants.length}/2)`);
    
    return { success: true, room };
  }

  removeFromRoom(socket) {
    if (!socket.roomCode) return;

    const room = this.rooms.get(socket.roomCode);
    if (!room) return;

    const index = room.participants.indexOf(socket);
    if (index !== -1) {
      room.participants.splice(index, 1);
      console.log(`Client left room: ${socket.roomCode} (${room.participants.length}/2)`);
      
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
        console.log(`Room deleted: ${socket.roomCode}`);
      }
    }
  }

  sendMessage(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  routeMessage(fromSocket, message) {
    if (!fromSocket.roomCode) return;

    const room = this.rooms.get(fromSocket.roomCode);
    if (!room) return;

    // Send message to other participant in the room
    const otherParticipant = room.participants.find(socket => socket !== fromSocket);
    if (otherParticipant) {
      this.sendMessage(otherParticipant, message);
    }
  }

  // Cleanup old rooms (older than 1 hour)
  cleanupOldRooms() {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.createdAt > oneHour) {
        // Close all connections in the room
        room.participants.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        });
        this.rooms.delete(code);
        console.log(`Cleaned up old room: ${code}`);
      }
    }
  }
}

class SignalingServer {
  constructor(port) {
    this.port = port;
    this.roomManager = new RoomManager();
    this.wss = null;
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    console.log(`Signaling server started on port ${this.port}`);

    this.wss.on('connection', (socket) => {
      console.log('New client connected');

      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(socket, message);
        } catch (error) {
          console.error('Invalid message format:', error);
          this.roomManager.sendMessage(socket, {
            type: 'ERROR',
            message: 'Invalid message format'
          });
        }
      });

      socket.on('close', () => {
        console.log('Client disconnected');
        this.roomManager.removeFromRoom(socket);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.roomManager.removeFromRoom(socket);
      });
    });

    // Cleanup old rooms every 10 minutes
    setInterval(() => {
      this.roomManager.cleanupOldRooms();
    }, 10 * 60 * 1000);
  }

  handleMessage(socket, message) {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'CREATE_ROOM':
        this.handleCreateRoom(socket);
        break;
        
      case 'JOIN_ROOM':
        this.handleJoinRoom(socket, message.code);
        break;
        
      case 'SENSOR_DATA':
      case 'CALIBRATION_DATA':
        // Route these messages to the paired device
        this.roomManager.routeMessage(socket, message);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        this.roomManager.sendMessage(socket, {
          type: 'ERROR',
          message: 'Unknown message type'
        });
    }
  }

  handleCreateRoom(socket) {
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
        message: 'Failed to create room'
      });
    }
  }

  handleJoinRoom(socket, code) {
    if (!code || code.length !== 4) {
      this.roomManager.sendMessage(socket, {
        type: 'ERROR',
        message: 'Invalid room code'
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
      this.roomManager.sendMessage(socket, {
        type: 'ERROR',
        message: joinResult.error
      });
    }
  }
}

// Get port from environment or default to 8080
const PORT = process.env.PORT || 8080;

// Create and start the signaling server
const server = new SignalingServer(PORT);
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  if (server.wss) {
    server.wss.close(() => {
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  if (server.wss) {
    server.wss.close(() => {
      process.exit(0);
    });
  }
});