import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock complete application flow
class MockApplication {
  constructor() {
    this.gameClient = null;
    this.controllerClient = null;
    this.sensorManager = null;
    this.gameEngine = null;
    this.currentScreen = 'selection';
    this.roomCode = null;
    this.calibrationData = null;
    this.gameState = 'menu';
    this.connectionStatus = 'disconnected';
    this.sensorStatus = 'inactive';
    this.score = 0;
    this.gameStartTime = null;
    this.totalFlaps = 0;
    this.sessionData = {
      gamesPlayed: 0,
      totalScore: 0,
      averageScore: 0,
      playTime: 0
    };
  }

  // Game flow simulation
  async startGameFlow() {
    this.currentScreen = 'calibration';
    this.gameState = 'calibrating';
    
    // Simulate calibration process
    const calibrationResult = await this.performCalibration();
    if (!calibrationResult.success) {
      throw new Error('Calibration failed: ' + calibrationResult.error);
    }
    
    this.calibrationData = calibrationResult.data;
    
    // Create game room
    const roomResult = await this.createGameRoom();
    if (!roomResult.success) {
      throw new Error('Room creation failed: ' + roomResult.error);
    }
    
    this.roomCode = roomResult.roomCode;
    this.currentScreen = 'game';
    this.connectionStatus = 'waiting_for_controller';
    
    return { success: true, roomCode: this.roomCode };
  }

  async controllerFlow(roomCode) {
    this.currentScreen = 'controller';
    
    // Join room
    const joinResult = await this.joinRoom(roomCode);
    if (!joinResult.success) {
      throw new Error('Failed to join room: ' + joinResult.error);
    }
    
    this.roomCode = roomCode;
    this.connectionStatus = 'connected';
    
    // Initialize sensors
    const sensorResult = await this.initializeSensors();
    if (!sensorResult.success) {
      throw new Error('Sensor initialization failed: ' + sensorResult.error);
    }
    
    this.sensorStatus = 'active';
    
    return { success: true };
  }

  async performCalibration() {
    // Simulate calibration data collection
    const calibrationReadings = [
      { y: 2.1, timestamp: Date.now() },
      { y: 1.8, timestamp: Date.now() + 100 },
      { y: 3.2, timestamp: Date.now() + 200 },
      { y: 7.8, timestamp: Date.now() + 300 },
      { y: 8.1, timestamp: Date.now() + 400 },
      { y: 7.9, timestamp: Date.now() + 500 },
      { y: 2.5, timestamp: Date.now() + 600 }
    ];
    
    let minY = null;
    let maxY = null;
    
    calibrationReadings.forEach(reading => {
      if (minY === null || reading.y < minY) minY = reading.y;
      if (maxY === null || reading.y > maxY) maxY = reading.y;
    });
    
    const range = maxY - minY;
    
    if (range < 1.0) {
      return { success: false, error: 'Motion range too small' };
    }
    
    return {
      success: true,
      data: {
        minY: minY,
        maxY: maxY,
        threshold: 0.3,
        range: range
      }
    };
  }

  async createGameRoom() {
    // Simulate WebSocket connection and room creation
    await this.simulateDelay(100);
    
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    return { success: true, roomCode: roomCode };
  }

  async joinRoom(roomCode) {
    // Simulate room joining
    await this.simulateDelay(150);
    
    if (!roomCode || roomCode.length !== 4) {
      return { success: false, error: 'Invalid room code' };
    }
    
    return { success: true };
  }

  async initializeSensors() {
    // Simulate sensor permission and initialization
    await this.simulateDelay(200);
    
    // Simulate permission request
    const permissionGranted = true; // Mock granted permission
    
    if (!permissionGranted) {
      return { success: false, error: 'Sensor permission denied' };
    }
    
    return { success: true };
  }

  startGameplay() {
    this.gameState = 'playing';
    this.gameStartTime = Date.now();
    this.score = 0;
    this.totalFlaps = 0;
    this.sessionData.gamesPlayed++;
    
    return { success: true };
  }

  processSensorInput(sensorData) {
    if (this.gameState !== 'playing') return { processed: false };
    
    // Simulate sensor data processing
    const { y, timestamp } = sensorData;
    
    if (!this.calibrationData) {
      return { processed: false, error: 'No calibration data' };
    }
    
    // Calculate normalized position
    const range = this.calibrationData.maxY - this.calibrationData.minY;
    const normalizedPosition = Math.max(0, Math.min(1, 
      (y - this.calibrationData.minY) / range
    ));
    
    // Determine if flap should occur
    const shouldFlap = normalizedPosition > 0.7; // Simplified flap detection
    
    if (shouldFlap) {
      this.totalFlaps++;
    }
    
    return {
      processed: true,
      normalizedPosition: normalizedPosition,
      shouldFlap: shouldFlap,
      gapPosition: normalizedPosition
    };
  }

  updateGameState(sensorResult) {
    if (this.gameState !== 'playing') return;
    
    // Simulate game physics update
    if (sensorResult.shouldFlap) {
      // Bird flaps up
    }
    
    // Simulate scoring
    if (Math.random() < 0.1) { // 10% chance to score each update
      this.score++;
      this.sessionData.totalScore++;
    }
    
    // Simulate game over condition
    if (Math.random() < 0.05) { // 5% chance of game over each update
      this.endGame();
    }
  }

  endGame() {
    this.gameState = 'over';
    const playTime = Date.now() - this.gameStartTime;
    this.sessionData.playTime += playTime;
    this.sessionData.averageScore = this.sessionData.totalScore / this.sessionData.gamesPlayed;
    
    return {
      score: this.score,
      playTime: playTime,
      totalFlaps: this.totalFlaps,
      sessionData: { ...this.sessionData }
    };
  }

  resetGame() {
    this.gameState = 'menu';
    this.score = 0;
    this.totalFlaps = 0;
    this.gameStartTime = null;
  }

  disconnect() {
    this.connectionStatus = 'disconnected';
    this.sensorStatus = 'inactive';
    this.gameState = 'menu';
    this.currentScreen = 'selection';
  }

  async simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for testing
  getGameStats() {
    return {
      currentScore: this.score,
      totalFlaps: this.totalFlaps,
      gameState: this.gameState,
      connectionStatus: this.connectionStatus,
      sensorStatus: this.sensorStatus,
      playTime: this.gameStartTime ? Date.now() - this.gameStartTime : 0
    };
  }

  simulateGameSession(duration = 5000) {
    return new Promise((resolve) => {
      this.startGameplay();
      
      const interval = setInterval(() => {
        // Simulate sensor input
        const sensorData = {
          y: 2 + Math.random() * 6, // Random Y between 2-8
          timestamp: Date.now()
        };
        
        const sensorResult = this.processSensorInput(sensorData);
        if (sensorResult.processed) {
          this.updateGameState(sensorResult);
        }
        
        // Check if game ended
        if (this.gameState === 'over') {
          clearInterval(interval);
          resolve(this.endGame());
        }
      }, 16); // ~60 FPS
      
      // Force end after duration
      setTimeout(() => {
        if (this.gameState === 'playing') {
          clearInterval(interval);
          resolve(this.endGame());
        }
      }, duration);
    });
  }
}

describe('Complete Gameplay Flow E2E Tests', () => {
  let app;

  beforeEach(() => {
    app = new MockApplication();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Full Game Setup Flow', () => {
    it('should complete entire game setup process', async () => {
      // Start game flow
      const gameResult = await app.startGameFlow();
      expect(gameResult.success).toBe(true);
      expect(gameResult.roomCode).toMatch(/^\d{4}$/);
      expect(app.currentScreen).toBe('game');
      expect(app.connectionStatus).toBe('waiting_for_controller');
      
      // Controller joins
      const controllerResult = await app.controllerFlow(gameResult.roomCode);
      expect(controllerResult.success).toBe(true);
      expect(app.connectionStatus).toBe('connected');
      expect(app.sensorStatus).toBe('active');
    });

    it('should handle calibration process correctly', async () => {
      const calibrationResult = await app.performCalibration();
      
      expect(calibrationResult.success).toBe(true);
      expect(calibrationResult.data.minY).toBeLessThan(calibrationResult.data.maxY);
      expect(calibrationResult.data.range).toBeGreaterThan(1.0);
      expect(calibrationResult.data.threshold).toBe(0.3);
    });

    it('should reject insufficient calibration data', async () => {
      // Mock insufficient motion range
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Fixed value for consistent range
      
      const calibrationResult = await app.performCalibration();
      
      // With fixed random, range will be too small
      expect(calibrationResult.success).toBe(false);
      expect(calibrationResult.error).toContain('Motion range too small');
    });

    it('should handle room creation failures gracefully', async () => {
      // Mock room creation failure
      const originalCreateRoom = app.createGameRoom;
      app.createGameRoom = vi.fn().mockResolvedValue({
        success: false,
        error: 'Server unavailable'
      });
      
      await expect(app.startGameFlow()).rejects.toThrow('Room creation failed: Server unavailable');
    });

    it('should validate room codes correctly', async () => {
      const invalidCodes = ['123', '12345', 'abcd', '', null];
      
      for (const code of invalidCodes) {
        const result = await app.joinRoom(code);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid room code');
      }
    });
  });

  describe('Sensor Integration and Motion Processing', () => {
    beforeEach(async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      app.startGameplay();
    });

    it('should process sensor data correctly', () => {
      const testCases = [
        { y: 2.0, expectedPosition: 0.0, shouldFlap: false },
        { y: 5.0, expectedPosition: 0.5, shouldFlap: false },
        { y: 8.0, expectedPosition: 1.0, shouldFlap: true }
      ];
      
      testCases.forEach(({ y, expectedPosition, shouldFlap }) => {
        const result = app.processSensorInput({ y, timestamp: Date.now() });
        
        expect(result.processed).toBe(true);
        expect(result.normalizedPosition).toBeCloseTo(expectedPosition, 1);
        expect(result.shouldFlap).toBe(shouldFlap);
      });
    });

    it('should track flap count accurately', () => {
      const flapInputs = [
        { y: 8.0 }, // Should flap
        { y: 2.0 }, // No flap
        { y: 7.5 }, // Should flap
        { y: 8.1 }  // Should flap
      ];
      
      flapInputs.forEach(input => {
        app.processSensorInput({ ...input, timestamp: Date.now() });
      });
      
      expect(app.totalFlaps).toBe(3);
    });

    it('should handle missing calibration data', () => {
      app.calibrationData = null;
      
      const result = app.processSensorInput({ y: 5.0, timestamp: Date.now() });
      
      expect(result.processed).toBe(false);
      expect(result.error).toBe('No calibration data');
    });

    it('should clamp sensor values to valid range', () => {
      const extremeInputs = [
        { y: -10.0 }, // Below range
        { y: 20.0 }   // Above range
      ];
      
      extremeInputs.forEach(input => {
        const result = app.processSensorInput({ ...input, timestamp: Date.now() });
        
        expect(result.normalizedPosition).toBeGreaterThanOrEqual(0);
        expect(result.normalizedPosition).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Complete Game Session', () => {
    it('should complete a full game session', async () => {
      // Setup
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      
      // Play game
      vi.useRealTimers(); // Use real timers for this test
      const gameResult = await app.simulateGameSession(1000); // 1 second game
      vi.useFakeTimers();
      
      expect(gameResult.score).toBeGreaterThanOrEqual(0);
      expect(gameResult.playTime).toBeGreaterThan(0);
      expect(gameResult.totalFlaps).toBeGreaterThanOrEqual(0);
      expect(gameResult.sessionData.gamesPlayed).toBe(1);
    });

    it('should track session statistics correctly', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      
      // Play multiple games
      for (let i = 0; i < 3; i++) {
        vi.useRealTimers();
        await app.simulateGameSession(500);
        vi.useFakeTimers();
        app.resetGame();
      }
      
      const stats = app.sessionData;
      expect(stats.gamesPlayed).toBe(3);
      expect(stats.totalScore).toBeGreaterThanOrEqual(0);
      expect(stats.averageScore).toBe(stats.totalScore / stats.gamesPlayed);
      expect(stats.playTime).toBeGreaterThan(0);
    });

    it('should handle game state transitions correctly', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      
      expect(app.gameState).toBe('menu');
      
      app.startGameplay();
      expect(app.gameState).toBe('playing');
      
      app.endGame();
      expect(app.gameState).toBe('over');
      
      app.resetGame();
      expect(app.gameState).toBe('menu');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle controller disconnection during gameplay', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      app.startGameplay();
      
      // Simulate disconnection
      app.disconnect();
      
      expect(app.connectionStatus).toBe('disconnected');
      expect(app.sensorStatus).toBe('inactive');
      expect(app.gameState).toBe('menu');
    });

    it('should handle sensor permission denial', async () => {
      await app.startGameFlow();
      
      // Mock sensor initialization failure
      app.initializeSensors = vi.fn().mockResolvedValue({
        success: false,
        error: 'Sensor permission denied'
      });
      
      await expect(app.controllerFlow(app.roomCode))
        .rejects.toThrow('Sensor initialization failed: Sensor permission denied');
    });

    it('should recover from temporary connection issues', async () => {
      await app.startGameFlow();
      
      // Simulate connection failure then success
      let callCount = 0;
      app.joinRoom = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ success: false, error: 'Connection timeout' });
        }
        return Promise.resolve({ success: true });
      });
      
      // First attempt should fail
      await expect(app.controllerFlow(app.roomCode))
        .rejects.toThrow('Failed to join room: Connection timeout');
      
      // Second attempt should succeed
      const result = await app.controllerFlow(app.roomCode);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle high-frequency sensor updates', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      app.startGameplay();
      
      // Send 100 sensor updates rapidly
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        const result = app.processSensorInput({
          y: 2 + Math.sin(i * 0.1) * 3, // Oscillating motion
          timestamp: Date.now()
        });
        expect(result.processed).toBe(true);
      }
      const endTime = Date.now();
      
      // Should process all updates quickly
      expect(endTime - startTime).toBeLessThan(100); // Less than 100ms
      expect(app.totalFlaps).toBeGreaterThan(0);
    });

    it('should maintain performance during extended gameplay', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      
      // Simulate extended session
      vi.useRealTimers();
      const longGameResult = await app.simulateGameSession(2000); // 2 seconds
      vi.useFakeTimers();
      
      expect(longGameResult.playTime).toBeGreaterThan(1500); // At least 1.5 seconds
      expect(app.sessionData.gamesPlayed).toBe(1);
    });

    it('should handle multiple rapid game restarts', async () => {
      await app.startGameFlow();
      await app.controllerFlow(app.roomCode);
      
      // Rapid start/stop cycles
      for (let i = 0; i < 10; i++) {
        app.startGameplay();
        expect(app.gameState).toBe('playing');
        
        app.endGame();
        expect(app.gameState).toBe('over');
        
        app.resetGame();
        expect(app.gameState).toBe('menu');
      }
      
      expect(app.sessionData.gamesPlayed).toBe(10);
    });
  });

  describe('Cross-Device Compatibility Scenarios', () => {
    it('should handle different device orientations', async () => {
      const orientationScenarios = [
        { name: 'Portrait', minY: -8, maxY: -2 },
        { name: 'Landscape', minY: -4, maxY: 4 },
        { name: 'Inverted', minY: 2, maxY: 8 }
      ];
      
      for (const scenario of orientationScenarios) {
        app = new MockApplication();
        app.calibrationData = {
          minY: scenario.minY,
          maxY: scenario.maxY,
          threshold: 0.3,
          range: scenario.maxY - scenario.minY
        };
        
        await app.startGameFlow();
        await app.controllerFlow(app.roomCode);
        app.startGameplay();
        
        // Test sensor processing with this orientation
        const midPoint = (scenario.minY + scenario.maxY) / 2;
        const result = app.processSensorInput({ y: midPoint, timestamp: Date.now() });
        
        expect(result.processed).toBe(true);
        expect(result.normalizedPosition).toBeCloseTo(0.5, 1);
      }
    });

    it('should adapt to different motion ranges', async () => {
      const motionRanges = [
        { minY: 1, maxY: 3 },   // Small range
        { minY: 0, maxY: 10 },  // Large range
        { minY: -5, maxY: 5 }   // Centered range
      ];
      
      for (const range of motionRanges) {
        app = new MockApplication();
        app.calibrationData = {
          minY: range.minY,
          maxY: range.maxY,
          threshold: 0.3,
          range: range.maxY - range.minY
        };
        
        await app.startGameFlow();
        await app.controllerFlow(app.roomCode);
        app.startGameplay();
        
        // Test boundary values
        const minResult = app.processSensorInput({ y: range.minY, timestamp: Date.now() });
        const maxResult = app.processSensorInput({ y: range.maxY, timestamp: Date.now() });
        
        expect(minResult.normalizedPosition).toBeCloseTo(0, 1);
        expect(maxResult.normalizedPosition).toBeCloseTo(1, 1);
      }
    });
  });
});