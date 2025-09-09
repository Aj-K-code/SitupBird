import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simplified game flow simulation
class GameFlowSimulator {
  constructor() {
    this.state = 'menu';
    this.roomCode = null;
    this.calibrationData = null;
    this.sensorActive = false;
    this.connected = false;
    this.score = 0;
    this.gameTime = 0;
    this.totalFlaps = 0;
    this.errors = [];
  }

  // Game setup flow
  async startGameSetup() {
    try {
      this.state = 'calibrating';
      
      // Simulate calibration
      const calibration = await this.performCalibration();
      if (!calibration.success) {
        throw new Error(`Calibration failed: ${calibration.error}`);
      }
      
      this.calibrationData = calibration.data;
      
      // Create room
      const room = await this.createRoom();
      if (!room.success) {
        throw new Error(`Room creation failed: ${room.error}`);
      }
      
      this.roomCode = room.code;
      this.state = 'waiting_for_controller';
      
      return { success: true, roomCode: this.roomCode };
    } catch (error) {
      this.errors.push(error.message);
      this.state = 'error';
      return { success: false, error: error.message };
    }
  }

  async performCalibration() {
    // Simulate calibration process
    await this.delay(100);
    
    const readings = this.generateCalibrationReadings();
    const minY = Math.min(...readings);
    const maxY = Math.max(...readings);
    const range = maxY - minY;
    
    if (range < 1.0) {
      return { success: false, error: 'Motion range too small' };
    }
    
    return {
      success: true,
      data: {
        minY: minY,
        maxY: maxY,
        range: range,
        threshold: 0.3
      }
    };
  }

  generateCalibrationReadings() {
    // Generate realistic calibration data
    return [2.1, 1.9, 3.2, 7.8, 8.1, 7.9, 2.5, 3.0, 7.5, 2.2];
  }

  async createRoom() {
    await this.delay(50);
    
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    return { success: true, code: code };
  }

  // Controller setup flow
  async setupController(roomCode) {
    try {
      this.state = 'connecting';
      
      // Validate room code
      if (!roomCode || roomCode.length !== 4 || !/^\d{4}$/.test(roomCode)) {
        throw new Error('Invalid room code');
      }
      
      // Connect to room
      const connection = await this.connectToRoom(roomCode);
      if (!connection.success) {
        throw new Error(`Connection failed: ${connection.error}`);
      }
      
      // Initialize sensors
      const sensors = await this.initializeSensors();
      if (!sensors.success) {
        throw new Error(`Sensor initialization failed: ${sensors.error}`);
      }
      
      this.roomCode = roomCode;
      this.connected = true;
      this.sensorActive = true;
      this.state = 'ready';
      
      return { success: true };
    } catch (error) {
      this.errors.push(error.message);
      this.state = 'error';
      return { success: false, error: error.message };
    }
  }

  async connectToRoom(roomCode) {
    await this.delay(100);
    
    // Simulate connection success/failure
    if (roomCode === '0000') {
      return { success: false, error: 'Room not found' };
    }
    
    return { success: true };
  }

  async initializeSensors() {
    await this.delay(150);
    
    // Simulate sensor initialization
    return { success: true };
  }

  // Gameplay simulation
  startGame() {
    if (this.state !== 'ready') {
      return { success: false, error: 'Game not ready' };
    }
    
    this.state = 'playing';
    this.score = 0;
    this.gameTime = 0;
    this.totalFlaps = 0;
    
    return { success: true };
  }

  processSensorInput(yValue) {
    if (!this.sensorActive || !this.calibrationData) {
      return { processed: false, error: 'Sensors not active' };
    }
    
    // Calculate normalized position
    const range = this.calibrationData.maxY - this.calibrationData.minY;
    const normalizedPosition = Math.max(0, Math.min(1, 
      (yValue - this.calibrationData.minY) / range
    ));
    
    // Simple flap detection
    const shouldFlap = normalizedPosition > 0.7;
    
    if (shouldFlap) {
      this.totalFlaps++;
    }
    
    return {
      processed: true,
      normalizedPosition: normalizedPosition,
      shouldFlap: shouldFlap
    };
  }

  updateGame(deltaTime = 16) {
    if (this.state !== 'playing') {
      return { updated: false };
    }
    
    this.gameTime += deltaTime;
    
    // Simulate scoring
    if (Math.random() < 0.1) { // 10% chance per update
      this.score++;
    }
    
    // Simulate game over
    if (Math.random() < 0.02) { // 2% chance per update
      this.endGame();
      return { updated: true, gameOver: true };
    }
    
    return { updated: true, gameOver: false };
  }

  endGame() {
    this.state = 'game_over';
    
    return {
      score: this.score,
      gameTime: this.gameTime,
      totalFlaps: this.totalFlaps,
      averageFlapsPerSecond: this.totalFlaps / (this.gameTime / 1000)
    };
  }

  resetGame() {
    this.state = 'ready';
    this.score = 0;
    this.gameTime = 0;
    this.totalFlaps = 0;
  }

  disconnect() {
    this.connected = false;
    this.sensorActive = false;
    this.state = 'disconnected';
  }

  // Utility methods
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getState() {
    return {
      state: this.state,
      roomCode: this.roomCode,
      connected: this.connected,
      sensorActive: this.sensorActive,
      score: this.score,
      gameTime: this.gameTime,
      totalFlaps: this.totalFlaps,
      errors: [...this.errors]
    };
  }

  // Simulate complete game session
  async simulateGameSession(duration = 2000) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    this.startGame();
    
    while (Date.now() < endTime && this.state === 'playing') {
      // Simulate sensor input
      const yValue = 2 + Math.random() * 6; // Random Y between 2-8
      this.processSensorInput(yValue);
      
      // Update game
      const result = this.updateGame();
      if (result.gameOver) {
        break;
      }
      
      await this.delay(16); // ~60 FPS
    }
    
    if (this.state === 'playing') {
      this.endGame();
    }
    
    return this.getState();
  }
}

describe('Complete Gameplay Flow E2E Tests', () => {
  let gameFlow;

  beforeEach(() => {
    gameFlow = new GameFlowSimulator();
  });

  describe('Game Setup Flow', () => {
    it('should complete full game setup successfully', async () => {
      const result = await gameFlow.startGameSetup();
      
      expect(result.success).toBe(true);
      expect(result.roomCode).toMatch(/^\d{4}$/);
      expect(gameFlow.state).toBe('waiting_for_controller');
      expect(gameFlow.calibrationData).toBeDefined();
      expect(gameFlow.calibrationData.range).toBeGreaterThan(1.0);
    });

    it('should handle calibration failure', async () => {
      // Mock insufficient motion range
      vi.spyOn(gameFlow, 'generateCalibrationReadings').mockReturnValue([5.0, 5.1, 5.2]);
      
      const result = await gameFlow.startGameSetup();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Motion range too small');
      expect(gameFlow.state).toBe('error');
    });

    it('should setup controller successfully', async () => {
      const setupResult = await gameFlow.startGameSetup();
      const controllerResult = await gameFlow.setupController(setupResult.roomCode);
      
      expect(controllerResult.success).toBe(true);
      expect(gameFlow.connected).toBe(true);
      expect(gameFlow.sensorActive).toBe(true);
      expect(gameFlow.state).toBe('ready');
    });

    it('should reject invalid room codes', async () => {
      const invalidCodes = ['123', '12345', 'abcd', ''];
      
      for (const code of invalidCodes) {
        const result = await gameFlow.setupController(code);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid room code');
      }
    });

    it('should handle room not found', async () => {
      const result = await gameFlow.setupController('0000');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Room not found');
    });
  });

  describe('Sensor Processing and Motion Detection', () => {
    beforeEach(async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
    });

    it('should process sensor data correctly', () => {
      const testCases = [
        { y: 2.0, expectedPosition: 0.0 },
        { y: 5.0, expectedPosition: 0.5 },
        { y: 8.0, expectedPosition: 1.0 }
      ];
      
      testCases.forEach(({ y, expectedPosition }) => {
        const result = gameFlow.processSensorInput(y);
        
        expect(result.processed).toBe(true);
        expect(result.normalizedPosition).toBeCloseTo(expectedPosition, 1);
      });
    });

    it('should detect flap motions', () => {
      // High position should trigger flap
      const result = gameFlow.processSensorInput(7.5);
      
      expect(result.shouldFlap).toBe(true);
      expect(gameFlow.totalFlaps).toBe(1);
    });

    it('should handle sensor errors gracefully', () => {
      gameFlow.sensorActive = false;
      
      const result = gameFlow.processSensorInput(5.0);
      
      expect(result.processed).toBe(false);
      expect(result.error).toContain('Sensors not active');
    });

    it('should clamp sensor values to valid range', () => {
      const extremeValues = [-10, 20];
      
      extremeValues.forEach(value => {
        const result = gameFlow.processSensorInput(value);
        
        expect(result.normalizedPosition).toBeGreaterThanOrEqual(0);
        expect(result.normalizedPosition).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Game Session Management', () => {
    beforeEach(async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
    });

    it('should start game successfully', () => {
      const result = gameFlow.startGame();
      
      expect(result.success).toBe(true);
      expect(gameFlow.state).toBe('playing');
      expect(gameFlow.score).toBe(0);
      expect(gameFlow.totalFlaps).toBe(0);
    });

    it('should update game state correctly', () => {
      gameFlow.startGame();
      
      const result = gameFlow.updateGame();
      
      expect(result.updated).toBe(true);
      expect(gameFlow.gameTime).toBeGreaterThan(0);
    });

    it('should end game and provide statistics', () => {
      gameFlow.startGame();
      gameFlow.totalFlaps = 10;
      gameFlow.gameTime = 5000;
      
      const result = gameFlow.endGame();
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.gameTime).toBe(5000);
      expect(result.totalFlaps).toBe(10);
      expect(result.averageFlapsPerSecond).toBe(2);
    });

    it('should reset game state', () => {
      gameFlow.startGame();
      gameFlow.score = 10;
      gameFlow.totalFlaps = 5;
      
      gameFlow.resetGame();
      
      expect(gameFlow.state).toBe('ready');
      expect(gameFlow.score).toBe(0);
      expect(gameFlow.totalFlaps).toBe(0);
    });
  });

  describe('Complete Game Sessions', () => {
    beforeEach(async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
    });

    it('should complete a full game session', async () => {
      const sessionResult = await gameFlow.simulateGameSession(1000);
      
      expect(sessionResult.state).toBe('game_over');
      expect(sessionResult.gameTime).toBeGreaterThan(0);
      expect(sessionResult.totalFlaps).toBeGreaterThanOrEqual(0);
      expect(sessionResult.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple game sessions', async () => {
      const sessions = [];
      
      for (let i = 0; i < 3; i++) {
        const session = await gameFlow.simulateGameSession(500);
        sessions.push(session);
        gameFlow.resetGame();
      }
      
      expect(sessions).toHaveLength(3);
      sessions.forEach(session => {
        expect(session.gameTime).toBeGreaterThan(0);
      });
    });

    it('should maintain performance during extended play', async () => {
      const startTime = performance.now();
      
      await gameFlow.simulateGameSession(2000);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (allowing for delays)
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle disconnection during setup', async () => {
      await gameFlow.startGameSetup();
      
      gameFlow.disconnect();
      
      expect(gameFlow.connected).toBe(false);
      expect(gameFlow.sensorActive).toBe(false);
      expect(gameFlow.state).toBe('disconnected');
    });

    it('should prevent game start when not ready', () => {
      gameFlow.state = 'error';
      
      const result = gameFlow.startGame();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game not ready');
    });

    it('should track errors throughout session', async () => {
      // Force calibration error
      vi.spyOn(gameFlow, 'generateCalibrationReadings').mockReturnValue([5.0, 5.1]);
      
      await gameFlow.startGameSetup();
      
      expect(gameFlow.errors).toHaveLength(1);
      expect(gameFlow.errors[0]).toContain('Motion range too small');
    });

    it('should handle sensor failures during gameplay', async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
      gameFlow.startGame();
      
      // Simulate sensor failure
      gameFlow.sensorActive = false;
      
      const result = gameFlow.processSensorInput(5.0);
      
      expect(result.processed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Device Compatibility Scenarios', () => {
    it('should handle different calibration ranges', async () => {
      const calibrationScenarios = [
        { readings: [1, 2, 8, 9], name: 'Normal range' },
        { readings: [-5, -4, 2, 3], name: 'Negative values' },
        { readings: [10, 11, 18, 19], name: 'High values' }
      ];
      
      for (const scenario of calibrationScenarios) {
        const flow = new GameFlowSimulator();
        vi.spyOn(flow, 'generateCalibrationReadings').mockReturnValue(scenario.readings);
        
        const result = await flow.startGameSetup();
        
        expect(result.success).toBe(true);
        expect(flow.calibrationData.range).toBeGreaterThan(1.0);
      }
    });

    it('should adapt to different motion patterns', async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
      
      const motionPatterns = [
        [2, 8, 2, 8], // Regular situps
        [3, 7, 3, 7], // Smaller range
        [1, 9, 1, 9]  // Larger range
      ];
      
      motionPatterns.forEach(pattern => {
        pattern.forEach(yValue => {
          const result = gameFlow.processSensorInput(yValue);
          expect(result.processed).toBe(true);
          expect(result.normalizedPosition).toBeGreaterThanOrEqual(0);
          expect(result.normalizedPosition).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    beforeEach(async () => {
      await gameFlow.startGameSetup();
      await gameFlow.setupController(gameFlow.roomCode);
    });

    it('should handle high-frequency sensor updates', () => {
      gameFlow.startGame();
      
      const startTime = performance.now();
      
      // Process 100 sensor readings
      for (let i = 0; i < 100; i++) {
        const yValue = 2 + Math.sin(i * 0.1) * 6;
        gameFlow.processSensorInput(yValue);
        gameFlow.updateGame();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should be fast
      expect(gameFlow.totalFlaps).toBeGreaterThan(0);
    });

    it('should maintain state consistency under rapid operations', () => {
      // Rapid state changes
      for (let i = 0; i < 10; i++) {
        gameFlow.startGame();
        gameFlow.processSensorInput(Math.random() * 10);
        gameFlow.updateGame();
        gameFlow.endGame();
        gameFlow.resetGame();
      }
      
      // Should end in consistent state
      expect(gameFlow.state).toBe('ready');
      expect(gameFlow.score).toBe(0);
      expect(gameFlow.totalFlaps).toBe(0);
    });
  });
});