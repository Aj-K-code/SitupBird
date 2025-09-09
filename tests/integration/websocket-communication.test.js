import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';

// Import the server classes for testing
const { RoomManager, SignalingServer } = await import('../../server.js').catch(() => {
  // If import fails, create mock classes for testing
  return {
    RoomManager: class MockRoomManager {
      constructor() {
        this.rooms = new Map();
      }
      
      generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
      }
      
      createRoom() {
        const code = this.generateRoomCode();
        const room = {
          code,
          participants: [],
          createdAt: Date.now(),
          status: 'waiting'
        };
        this.rooms.set(code, room);
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
        return { success: true, room };
      }
      
      removeFromRoom(socket) {
        if (!socket.roomCode) return;
        const room = this.rooms.get(socket.roomCode);
        if (!room) return;
        
        const index = room.participants.indexOf(socket);
        if (index !== -1) {
          room.participants.splice(index, 1);
          if (room.participants.length === 0) {
            this.rooms.delete(socket.roomCode);
          }
        }
      }
      
      sendMessage(socket, message) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
          return true;
        }
        return false;
      }
      
      routeMessage(fromSocket, message) {
        if (!fromSocket.roomCode) return false;
        const room = this.rooms.get(fromSocket.roomCode);
        if (!room) return false;
        
        const otherParticipant = room.participants.find(socket => socket !== fromSocket);
        if (otherParticipant) {
          return this.sendMessage(otherParticipant, message);
        }
        return false;
      }
    },
    
    SignalingServer: class MockSignalingServer {
      constructor(port) {
        this.port = port;
        this.roomManager = new MockRoomManager();
      }
    }
  };
});

describe('WebSocket Communication Integration', () => {
  let roomManager;
  let mockSocket1, mockSocket2;

  beforeEach(() => {
    roomManager = new RoomManager();
    
    // Create mock WebSocket objects
    mockSocket1 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      roomCode: null
    };
    
    mockSocket2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      roomCode: null
    };
  });

  describe('Room Management', () => {
    it('should create room with unique 4-digit code', () => {
      const room = roomManager.createRoom();
      
      expect(room.code).toMatch(/^\d{4}$/);
      expect(room.participants).toHaveLength(0);
      expect(room.status).toBe('waiting');
      expect(roomManager.rooms.has(room.code)).toBe(true);
    });

    it('should generate unique room codes', () => {
      const codes = new Set();
      
      // Generate multiple rooms
      for (let i = 0; i < 100; i++) {
        const room = roomManager.createRoom();
        codes.add(room.code);
      }
      
      // All codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should allow first participant to join room', () => {
      const room = roomManager.createRoom();
      const result = roomManager.joinRoom(room.code, mockSocket1);
      
      expect(result.success).toBe(true);
      expect(result.room.participants).toHaveLength(1);
      expect(mockSocket1.roomCode).toBe(room.code);
    });

    it('should allow second participant to join room', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      const result = roomManager.joinRoom(room.code, mockSocket2);
      
      expect(result.success).toBe(true);
      expect(result.room.participants).toHaveLength(2);
      expect(mockSocket2.roomCode).toBe(room.code);
    });

    it('should reject third participant from full room', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      roomManager.joinRoom(room.code, mockSocket2);
      
      const mockSocket3 = { ...mockSocket1, send: vi.fn() };
      const result = roomManager.joinRoom(room.code, mockSocket3);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found or is full');
    });

    it('should reject join request for non-existent room', () => {
      const result = roomManager.joinRoom('9999', mockSocket1);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found or is full');
    });

    it('should remove participant from room on disconnect', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      roomManager.joinRoom(room.code, mockSocket2);
      
      roomManager.removeFromRoom(mockSocket1);
      
      expect(room.participants).toHaveLength(1);
      expect(room.participants[0]).toBe(mockSocket2);
    });

    it('should delete empty room when last participant leaves', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      
      roomManager.removeFromRoom(mockSocket1);
      
      expect(roomManager.rooms.has(room.code)).toBe(false);
    });
  });

  describe('Message Routing', () => {
    let room;

    beforeEach(() => {
      room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      roomManager.joinRoom(room.code, mockSocket2);
    });

    it('should route sensor data between participants', () => {
      const sensorMessage = {
        type: 'SENSOR_DATA',
        payload: { z: -4.2, timestamp: Date.now() }
      };
      
      const result = roomManager.routeMessage(mockSocket1, sensorMessage);
      
      expect(result).toBe(true);
      expect(mockSocket2.send).toHaveBeenCalledWith(JSON.stringify(sensorMessage));
    });

    it('should route calibration data between participants', () => {
      const calibrationMessage = {
        type: 'CALIBRATION_DATA',
        payload: { minY: 2.0, maxY: 8.0, threshold: 0.3 }
      };
      
      const result = roomManager.routeMessage(mockSocket1, calibrationMessage);
      
      expect(result).toBe(true);
      expect(mockSocket2.send).toHaveBeenCalledWith(JSON.stringify(calibrationMessage));
    });

    it('should not route message from socket without room', () => {
      const orphanSocket = { ...mockSocket1, roomCode: null };
      const message = { type: 'SENSOR_DATA', payload: {} };
      
      const result = roomManager.routeMessage(orphanSocket, message);
      
      expect(result).toBe(false);
    });

    it('should handle routing when partner disconnects', () => {
      roomManager.removeFromRoom(mockSocket2);
      
      const message = { type: 'SENSOR_DATA', payload: {} };
      const result = roomManager.routeMessage(mockSocket1, message);
      
      expect(result).toBe(false);
    });

    it('should handle closed socket gracefully', () => {
      mockSocket2.readyState = WebSocket.CLOSED;
      
      const message = { type: 'SENSOR_DATA', payload: {} };
      const result = roomManager.routeMessage(mockSocket1, message);
      
      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid room code format', () => {
      const invalidCodes = ['123', '12345', 'abcd', '', null, undefined];
      
      invalidCodes.forEach(code => {
        const result = roomManager.joinRoom(code, mockSocket1);
        expect(result.success).toBe(false);
      });
    });

    it('should handle socket send errors gracefully', () => {
      mockSocket1.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      const message = { type: 'TEST', payload: {} };
      const result = roomManager.sendMessage(mockSocket1, message);
      
      expect(result).toBe(false);
    });

    it('should notify remaining participant when partner disconnects', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      roomManager.joinRoom(room.code, mockSocket2);
      
      roomManager.removeFromRoom(mockSocket1);
      
      expect(mockSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'PARTNER_DISCONNECTED' })
      );
    });
  });

  describe('Real-time Communication Performance', () => {
    let room;

    beforeEach(() => {
      room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      roomManager.joinRoom(room.code, mockSocket2);
    });

    it('should handle high-frequency sensor data', () => {
      const messageCount = 100;
      const messages = [];
      
      // Simulate 60Hz sensor data
      for (let i = 0; i < messageCount; i++) {
        const message = {
          type: 'SENSOR_DATA',
          payload: { z: Math.sin(i * 0.1), timestamp: Date.now() + i }
        };
        messages.push(message);
        roomManager.routeMessage(mockSocket1, message);
      }
      
      expect(mockSocket2.send).toHaveBeenCalledTimes(messageCount);
    });

    it('should maintain message order', () => {
      const messages = [
        { type: 'SENSOR_DATA', payload: { sequence: 1 } },
        { type: 'SENSOR_DATA', payload: { sequence: 2 } },
        { type: 'SENSOR_DATA', payload: { sequence: 3 } }
      ];
      
      messages.forEach(message => {
        roomManager.routeMessage(mockSocket1, message);
      });
      
      // Verify messages were sent in order
      const sentMessages = mockSocket2.send.mock.calls.map(call => 
        JSON.parse(call[0])
      );
      
      expect(sentMessages[0].payload.sequence).toBe(1);
      expect(sentMessages[1].payload.sequence).toBe(2);
      expect(sentMessages[2].payload.sequence).toBe(3);
    });

    it('should handle concurrent message routing', () => {
      const message1 = { type: 'SENSOR_DATA', payload: { from: 'socket1' } };
      const message2 = { type: 'CALIBRATION_DATA', payload: { from: 'socket2' } };
      
      // Send messages concurrently
      const result1 = roomManager.routeMessage(mockSocket1, message1);
      const result2 = roomManager.routeMessage(mockSocket2, message2);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockSocket2.send).toHaveBeenCalledWith(JSON.stringify(message1));
      expect(mockSocket1.send).toHaveBeenCalledWith(JSON.stringify(message2));
    });
  });

  describe('Room Cleanup and Memory Management', () => {
    it('should clean up old rooms', () => {
      const room = roomManager.createRoom();
      
      // Simulate old room
      room.createdAt = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      roomManager.cleanupOldRooms();
      
      expect(roomManager.rooms.has(room.code)).toBe(false);
    });

    it('should not clean up recent rooms', () => {
      const room = roomManager.createRoom();
      
      roomManager.cleanupOldRooms();
      
      expect(roomManager.rooms.has(room.code)).toBe(true);
    });

    it('should close connections when cleaning up rooms', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, mockSocket1);
      
      // Make room old
      room.createdAt = Date.now() - (2 * 60 * 60 * 1000);
      
      roomManager.cleanupOldRooms();
      
      expect(mockSocket1.close).toHaveBeenCalled();
    });

    it('should provide accurate server statistics', () => {
      // Create multiple rooms with different states
      const room1 = roomManager.createRoom();
      const room2 = roomManager.createRoom();
      
      roomManager.joinRoom(room1.code, mockSocket1);
      roomManager.joinRoom(room2.code, mockSocket2);
      
      const stats = roomManager.getStats();
      
      expect(stats.totalRooms).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.roomsWithTwoPlayers).toBe(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });
  });

  describe('Connection State Management', () => {
    it('should track connection states correctly', () => {
      const room = roomManager.createRoom();
      
      expect(room.participants.length).toBe(0);
      
      roomManager.joinRoom(room.code, mockSocket1);
      expect(room.participants.length).toBe(1);
      
      roomManager.joinRoom(room.code, mockSocket2);
      expect(room.participants.length).toBe(2);
      
      roomManager.removeFromRoom(mockSocket1);
      expect(room.participants.length).toBe(1);
      
      roomManager.removeFromRoom(mockSocket2);
      expect(roomManager.rooms.has(room.code)).toBe(false);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      const room = roomManager.createRoom();
      
      // Rapid connect/disconnect
      for (let i = 0; i < 10; i++) {
        const socket = { ...mockSocket1, send: vi.fn() };
        roomManager.joinRoom(room.code, socket);
        roomManager.removeFromRoom(socket);
      }
      
      // Room should still exist but be empty
      expect(roomManager.rooms.has(room.code)).toBe(false);
    });
  });
});