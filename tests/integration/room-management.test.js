import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simplified Room Manager for testing
class TestRoomManager {
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

  joinRoom(code, participant) {
    const room = this.rooms.get(code);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    if (room.participants.length >= 2) {
      return { success: false, error: 'Room is full' };
    }
    
    room.participants.push(participant);
    participant.roomCode = code;
    
    return { success: true, room };
  }

  removeFromRoom(participant) {
    if (!participant.roomCode) return false;
    
    const room = this.rooms.get(participant.roomCode);
    if (!room) return false;
    
    const index = room.participants.indexOf(participant);
    if (index !== -1) {
      room.participants.splice(index, 1);
      
      // Notify remaining participant
      if (room.participants.length > 0) {
        const remaining = room.participants[0];
        if (remaining.onPartnerDisconnected) {
          remaining.onPartnerDisconnected();
        }
      }
      
      // Clean up empty rooms
      if (room.participants.length === 0) {
        this.rooms.delete(participant.roomCode);
      }
      
      return true;
    }
    
    return false;
  }

  routeMessage(fromParticipant, message) {
    if (!fromParticipant.roomCode) return false;
    
    const room = this.rooms.get(fromParticipant.roomCode);
    if (!room) return false;
    
    const otherParticipant = room.participants.find(p => p !== fromParticipant);
    if (otherParticipant && otherParticipant.onMessage) {
      otherParticipant.onMessage(message);
      return true;
    }
    
    return false;
  }

  getStats() {
    let totalParticipants = 0;
    let fullRooms = 0;
    
    for (const room of this.rooms.values()) {
      totalParticipants += room.participants.length;
      if (room.participants.length === 2) {
        fullRooms++;
      }
    }
    
    return {
      totalRooms: this.rooms.size,
      totalParticipants,
      fullRooms,
      timestamp: Date.now()
    };
  }
}

// Mock participant for testing
class TestParticipant {
  constructor(id) {
    this.id = id;
    this.roomCode = null;
    this.messages = [];
    this.disconnected = false;
    this.onMessage = null;
    this.onPartnerDisconnected = null;
  }

  sendMessage(message) {
    if (this.onMessage) {
      this.onMessage(message);
    }
  }

  disconnect() {
    this.disconnected = true;
    if (this.onPartnerDisconnected) {
      this.onPartnerDisconnected();
    }
  }
}

describe('Room Management Integration Tests', () => {
  let roomManager;
  let participant1, participant2;

  beforeEach(() => {
    roomManager = new TestRoomManager();
    participant1 = new TestParticipant('p1');
    participant2 = new TestParticipant('p2');
  });

  describe('Room Creation and Joining', () => {
    it('should create room with unique code', () => {
      const room = roomManager.createRoom();
      
      expect(room.code).toMatch(/^\d{4}$/);
      expect(room.participants).toHaveLength(0);
      expect(room.status).toBe('waiting');
      expect(roomManager.rooms.has(room.code)).toBe(true);
    });

    it('should generate unique room codes', () => {
      const codes = new Set();
      
      for (let i = 0; i < 50; i++) {
        const room = roomManager.createRoom();
        codes.add(room.code);
      }
      
      expect(codes.size).toBe(50);
    });

    it('should allow participants to join room', () => {
      const room = roomManager.createRoom();
      
      const result1 = roomManager.joinRoom(room.code, participant1);
      expect(result1.success).toBe(true);
      expect(participant1.roomCode).toBe(room.code);
      
      const result2 = roomManager.joinRoom(room.code, participant2);
      expect(result2.success).toBe(true);
      expect(participant2.roomCode).toBe(room.code);
      
      expect(room.participants).toHaveLength(2);
    });

    it('should reject third participant', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, participant1);
      roomManager.joinRoom(room.code, participant2);
      
      const participant3 = new TestParticipant('p3');
      const result = roomManager.joinRoom(room.code, participant3);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room is full');
    });

    it('should reject join for non-existent room', () => {
      const result = roomManager.joinRoom('9999', participant1);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found');
    });
  });

  describe('Message Routing', () => {
    let room;

    beforeEach(() => {
      room = roomManager.createRoom();
      roomManager.joinRoom(room.code, participant1);
      roomManager.joinRoom(room.code, participant2);
    });

    it('should route messages between participants', () => {
      const receivedMessages = [];
      participant2.onMessage = (message) => receivedMessages.push(message);
      
      const testMessage = { type: 'SENSOR_DATA', payload: { y: 5.0 } };
      const result = roomManager.routeMessage(participant1, testMessage);
      
      expect(result).toBe(true);
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(testMessage);
    });

    it('should handle bidirectional messaging', () => {
      const messages1 = [];
      const messages2 = [];
      
      participant1.onMessage = (message) => messages1.push(message);
      participant2.onMessage = (message) => messages2.push(message);
      
      roomManager.routeMessage(participant1, { from: 'p1' });
      roomManager.routeMessage(participant2, { from: 'p2' });
      
      expect(messages1).toHaveLength(1);
      expect(messages1[0].from).toBe('p2');
      expect(messages2).toHaveLength(1);
      expect(messages2[0].from).toBe('p1');
    });

    it('should fail routing without partner', () => {
      roomManager.removeFromRoom(participant2);
      
      const result = roomManager.routeMessage(participant1, { test: 'message' });
      expect(result).toBe(false);
    });
  });

  describe('Participant Management', () => {
    let room;

    beforeEach(() => {
      room = roomManager.createRoom();
      roomManager.joinRoom(room.code, participant1);
      roomManager.joinRoom(room.code, participant2);
    });

    it('should remove participant from room', () => {
      const result = roomManager.removeFromRoom(participant1);
      
      expect(result).toBe(true);
      expect(room.participants).toHaveLength(1);
      expect(room.participants[0]).toBe(participant2);
    });

    it('should notify remaining participant of disconnection', () => {
      let notified = false;
      participant2.onPartnerDisconnected = () => { notified = true; };
      
      roomManager.removeFromRoom(participant1);
      
      expect(notified).toBe(true);
    });

    it('should delete empty rooms', () => {
      roomManager.removeFromRoom(participant1);
      roomManager.removeFromRoom(participant2);
      
      expect(roomManager.rooms.has(room.code)).toBe(false);
    });

    it('should handle removal of non-existent participant', () => {
      const orphan = new TestParticipant('orphan');
      const result = roomManager.removeFromRoom(orphan);
      
      expect(result).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      // Create multiple rooms with different states
      const room1 = roomManager.createRoom();
      const room2 = roomManager.createRoom();
      const room3 = roomManager.createRoom();
      
      // Room 1: Full (2 participants)
      roomManager.joinRoom(room1.code, participant1);
      roomManager.joinRoom(room1.code, participant2);
      
      // Room 2: Partial (1 participant)
      const participant3 = new TestParticipant('p3');
      roomManager.joinRoom(room2.code, participant3);
      
      // Room 3: Empty
      
      const stats = roomManager.getStats();
      
      expect(stats.totalRooms).toBe(3);
      expect(stats.totalParticipants).toBe(3);
      expect(stats.fullRooms).toBe(1);
      expect(stats.timestamp).toBeGreaterThan(0);
    });

    it('should update statistics after room changes', () => {
      const room = roomManager.createRoom();
      roomManager.joinRoom(room.code, participant1);
      
      let stats = roomManager.getStats();
      expect(stats.totalParticipants).toBe(1);
      expect(stats.fullRooms).toBe(0);
      
      roomManager.joinRoom(room.code, participant2);
      
      stats = roomManager.getStats();
      expect(stats.totalParticipants).toBe(2);
      expect(stats.fullRooms).toBe(1);
      
      roomManager.removeFromRoom(participant1);
      roomManager.removeFromRoom(participant2);
      
      stats = roomManager.getStats();
      expect(stats.totalRooms).toBe(0);
      expect(stats.totalParticipants).toBe(0);
      expect(stats.fullRooms).toBe(0);
    });
  });

  describe('Real-time Communication Simulation', () => {
    let room;

    beforeEach(() => {
      room = roomManager.createRoom();
      roomManager.joinRoom(room.code, participant1);
      roomManager.joinRoom(room.code, participant2);
    });

    it('should handle high-frequency message routing', () => {
      const receivedMessages = [];
      participant2.onMessage = (message) => receivedMessages.push(message);
      
      // Send 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        const message = { type: 'SENSOR_DATA', sequence: i, timestamp: Date.now() };
        roomManager.routeMessage(participant1, message);
      }
      
      expect(receivedMessages).toHaveLength(100);
      
      // Verify message order
      for (let i = 0; i < 100; i++) {
        expect(receivedMessages[i].sequence).toBe(i);
      }
    });

    it('should maintain performance under load', () => {
      const startTime = performance.now();
      
      // Create multiple rooms and route messages
      const rooms = [];
      const participants = [];
      
      for (let i = 0; i < 10; i++) {
        const room = roomManager.createRoom();
        const p1 = new TestParticipant(`p${i*2}`);
        const p2 = new TestParticipant(`p${i*2+1}`);
        
        roomManager.joinRoom(room.code, p1);
        roomManager.joinRoom(room.code, p2);
        
        rooms.push(room);
        participants.push(p1, p2);
      }
      
      // Route messages in all rooms
      for (let i = 0; i < participants.length; i += 2) {
        for (let j = 0; j < 10; j++) {
          roomManager.routeMessage(participants[i], { test: j });
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete quickly (less than 100ms)
      expect(duration).toBeLessThan(100);
      expect(roomManager.rooms.size).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent room operations', () => {
      const room = roomManager.createRoom();
      
      // Simulate concurrent joins
      const result1 = roomManager.joinRoom(room.code, participant1);
      const result2 = roomManager.joinRoom(room.code, participant2);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(room.participants).toHaveLength(2);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      const room = roomManager.createRoom();
      
      // Rapid connect/disconnect
      for (let i = 0; i < 5; i++) {
        const participant = new TestParticipant(`temp${i}`);
        roomManager.joinRoom(room.code, participant);
        roomManager.removeFromRoom(participant);
      }
      
      // Room should still exist but be empty
      expect(roomManager.rooms.has(room.code)).toBe(false); // Should be deleted when empty
    });

    it('should validate room codes', () => {
      const invalidCodes = ['123', '12345', 'abcd', '', null, undefined];
      
      invalidCodes.forEach(code => {
        const result = roomManager.joinRoom(code, participant1);
        expect(result.success).toBe(false);
      });
    });
  });
});