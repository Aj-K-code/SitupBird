import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock GameEngine class extracted from app.js
class MockGameEngine {
  constructor(canvas, calibrationData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.calibrationData = calibrationData;
    
    // Game state
    this.bird = {
      x: 100,
      y: 300,
      width: 50,
      height: 40,
      velocity: 0,
      gravity: 0.2,
      flapStrength: -4.5,
      maxVelocity: 8
    };
    
    this.pipes = [];
    this.score = 0;
    this.gameState = 'start'; // start, playing, over
    this.frame = 0;
    
    // Pipe generation
    this.pipeWidth = 80;
    this.pipeGap = 200;
    this.pipeSpawnInterval = 180; // frames
    this.pipeSpeed = 2;
    this.lastPipeFrame = 0;
    
    // Collision detection
    this.collisionPadding = 5;
  }

  updateBird(sensorData) {
    if (this.gameState !== 'playing') return;
    
    // Apply flap if sensor indicates
    if (sensorData && sensorData.shouldFlap) {
      this.bird.velocity = this.bird.flapStrength;
    }
    
    // Apply gravity
    this.bird.velocity += this.bird.gravity;
    
    // Limit velocity
    this.bird.velocity = Math.max(-this.bird.maxVelocity, 
                                 Math.min(this.bird.maxVelocity, this.bird.velocity));
    
    // Update position
    this.bird.y += this.bird.velocity;
    
    // Keep bird in bounds (top)
    if (this.bird.y < 0) {
      this.bird.y = 0;
      this.bird.velocity = 0;
    }
    
    // Check ground collision
    if (this.bird.y + this.bird.height > this.canvas.height) {
      this.bird.y = this.canvas.height - this.bird.height;
      this.gameOver();
    }
  }

  spawnPipes() {
    if (this.gameState !== 'playing') return;
    
    if (this.frame - this.lastPipeFrame >= this.pipeSpawnInterval) {
      const gapPosition = this.calculateGapPosition();
      const gapY = gapPosition * (this.canvas.height - this.pipeGap);
      
      const pipe = {
        x: this.canvas.width,
        topHeight: gapY,
        bottomY: gapY + this.pipeGap,
        bottomHeight: this.canvas.height - (gapY + this.pipeGap),
        width: this.pipeWidth,
        scored: false
      };
      
      this.pipes.push(pipe);
      this.lastPipeFrame = this.frame;
    }
  }

  calculateGapPosition() {
    // Use calibration data to determine gap position
    // Default to middle if no calibration data
    if (!this.calibrationData || !this.calibrationData.currentPosition) {
      return 0.5;
    }
    
    // Map user's current position to gap position
    return Math.max(0.1, Math.min(0.9, this.calibrationData.currentPosition));
  }

  updatePipes() {
    if (this.gameState !== 'playing') return;
    
    // Move pipes left
    this.pipes.forEach(pipe => {
      pipe.x -= this.pipeSpeed;
    });
    
    // Remove off-screen pipes and update score
    this.pipes = this.pipes.filter(pipe => {
      if (pipe.x + pipe.width < 0) {
        return false; // Remove pipe
      }
      
      // Check if bird passed pipe for scoring
      if (!pipe.scored && pipe.x + pipe.width < this.bird.x) {
        pipe.scored = true;
        this.score++;
      }
      
      return true;
    });
  }

  checkCollisions() {
    if (this.gameState !== 'playing') return false;
    
    const birdLeft = this.bird.x + this.collisionPadding;
    const birdRight = this.bird.x + this.bird.width - this.collisionPadding;
    const birdTop = this.bird.y + this.collisionPadding;
    const birdBottom = this.bird.y + this.bird.height - this.collisionPadding;
    
    for (const pipe of this.pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + pipe.width;
      
      // Check horizontal overlap
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check collision with top pipe
        if (birdTop < pipe.topHeight) {
          return true;
        }
        
        // Check collision with bottom pipe
        if (birdBottom > pipe.bottomY) {
          return true;
        }
      }
    }
    
    return false;
  }

  gameOver() {
    this.gameState = 'over';
    this.bird.velocity = 0;
  }

  startGame() {
    this.gameState = 'playing';
    this.score = 0;
    this.frame = 0;
    this.pipes = [];
    this.bird.y = 300;
    this.bird.velocity = 0;
    this.lastPipeFrame = 0;
  }

  update(sensorData) {
    if (this.gameState === 'playing') {
      this.frame++;
      this.updateBird(sensorData);
      this.spawnPipes();
      this.updatePipes();
      
      if (this.checkCollisions()) {
        this.gameOver();
      }
    }
  }

  // Utility methods for testing
  getBirdBounds() {
    return {
      left: this.bird.x,
      right: this.bird.x + this.bird.width,
      top: this.bird.y,
      bottom: this.bird.y + this.bird.height
    };
  }

  getPipeCount() {
    return this.pipes.length;
  }

  getActivePipes() {
    return this.pipes.filter(pipe => pipe.x + pipe.width > 0);
  }
}

describe('GameEngine - Core Game Logic', () => {
  let gameEngine;
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = {
      width: 800,
      height: 600,
      getContext: vi.fn().mockReturnValue({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn()
      })
    };
    
    const calibrationData = {
      minY: 2.0,
      maxY: 8.0,
      currentPosition: 0.5
    };
    
    gameEngine = new MockGameEngine(mockCanvas, calibrationData);
  });

  describe('Bird Physics', () => {
    beforeEach(() => {
      gameEngine.startGame();
    });

    it('should apply gravity to bird velocity', () => {
      const initialVelocity = gameEngine.bird.velocity;
      gameEngine.updateBird({});
      
      expect(gameEngine.bird.velocity).toBe(initialVelocity + gameEngine.bird.gravity);
    });

    it('should apply flap when sensor data indicates', () => {
      const sensorData = { shouldFlap: true };
      gameEngine.updateBird(sensorData);
      
      expect(gameEngine.bird.velocity).toBe(gameEngine.bird.flapStrength);
    });

    it('should limit bird velocity to maximum', () => {
      // Set high velocity
      gameEngine.bird.velocity = 15;
      gameEngine.updateBird({});
      
      expect(gameEngine.bird.velocity).toBeLessThanOrEqual(gameEngine.bird.maxVelocity);
    });

    it('should limit bird velocity to minimum', () => {
      // Set very negative velocity
      gameEngine.bird.velocity = -15;
      gameEngine.updateBird({});
      
      expect(gameEngine.bird.velocity).toBeGreaterThanOrEqual(-gameEngine.bird.maxVelocity);
    });

    it('should update bird position based on velocity', () => {
      const initialY = gameEngine.bird.y;
      gameEngine.bird.velocity = 5;
      gameEngine.updateBird({});
      
      expect(gameEngine.bird.y).toBe(initialY + 5);
    });

    it('should prevent bird from going above screen', () => {
      gameEngine.bird.y = -10;
      gameEngine.bird.velocity = -5;
      gameEngine.updateBird({});
      
      expect(gameEngine.bird.y).toBe(0);
      expect(gameEngine.bird.velocity).toBe(0);
    });

    it('should trigger game over when bird hits ground', () => {
      gameEngine.bird.y = mockCanvas.height;
      gameEngine.updateBird({});
      
      expect(gameEngine.gameState).toBe('over');
    });
  });

  describe('Pipe Generation', () => {
    beforeEach(() => {
      gameEngine.startGame();
    });

    it('should spawn pipes at regular intervals', () => {
      // Advance frames to trigger pipe spawn
      gameEngine.frame = gameEngine.pipeSpawnInterval;
      gameEngine.spawnPipes();
      
      expect(gameEngine.pipes.length).toBe(1);
    });

    it('should not spawn pipes before interval', () => {
      gameEngine.frame = gameEngine.pipeSpawnInterval - 1;
      gameEngine.spawnPipes();
      
      expect(gameEngine.pipes.length).toBe(0);
    });

    it('should position pipe gap based on calibration data', () => {
      gameEngine.calibrationData.currentPosition = 0.8;
      gameEngine.frame = gameEngine.pipeSpawnInterval;
      gameEngine.spawnPipes();
      
      const pipe = gameEngine.pipes[0];
      const gapCenter = pipe.topHeight + (gameEngine.pipeGap / 2);
      const expectedCenter = 0.8 * mockCanvas.height;
      
      expect(gapCenter).toBeCloseTo(expectedCenter, 0);
    });

    it('should create pipes with correct dimensions', () => {
      gameEngine.frame = gameEngine.pipeSpawnInterval;
      gameEngine.spawnPipes();
      
      const pipe = gameEngine.pipes[0];
      expect(pipe.width).toBe(gameEngine.pipeWidth);
      expect(pipe.x).toBe(mockCanvas.width);
      expect(pipe.bottomY - pipe.topHeight).toBe(gameEngine.pipeGap);
    });
  });

  describe('Pipe Movement and Cleanup', () => {
    beforeEach(() => {
      gameEngine.startGame();
      // Add a test pipe
      gameEngine.pipes.push({
        x: 400,
        topHeight: 200,
        bottomY: 400,
        bottomHeight: 200,
        width: 80,
        scored: false
      });
    });

    it('should move pipes left at correct speed', () => {
      const initialX = gameEngine.pipes[0].x;
      gameEngine.updatePipes();
      
      expect(gameEngine.pipes[0].x).toBe(initialX - gameEngine.pipeSpeed);
    });

    it('should remove off-screen pipes', () => {
      gameEngine.pipes[0].x = -100; // Off-screen
      gameEngine.updatePipes();
      
      expect(gameEngine.pipes.length).toBe(0);
    });

    it('should increment score when bird passes pipe', () => {
      gameEngine.pipes[0].x = 50; // Behind bird
      gameEngine.updatePipes();
      
      expect(gameEngine.score).toBe(1);
      expect(gameEngine.pipes[0].scored).toBe(true);
    });

    it('should not score the same pipe twice', () => {
      gameEngine.pipes[0].x = 50;
      gameEngine.updatePipes(); // First pass
      gameEngine.updatePipes(); // Second pass
      
      expect(gameEngine.score).toBe(1);
    });
  });

  describe('Collision Detection', () => {
    beforeEach(() => {
      gameEngine.startGame();
    });

    it('should detect collision with top pipe', () => {
      // Add pipe that bird will collide with
      gameEngine.pipes.push({
        x: 90,
        topHeight: 250,
        bottomY: 450,
        width: 80,
        scored: false
      });
      
      // Position bird to collide with top pipe
      gameEngine.bird.y = 200;
      
      expect(gameEngine.checkCollisions()).toBe(true);
    });

    it('should detect collision with bottom pipe', () => {
      gameEngine.pipes.push({
        x: 90,
        topHeight: 150,
        bottomY: 350,
        width: 80,
        scored: false
      });
      
      // Position bird to collide with bottom pipe
      gameEngine.bird.y = 400;
      
      expect(gameEngine.checkCollisions()).toBe(true);
    });

    it('should not detect collision when bird passes through gap', () => {
      gameEngine.pipes.push({
        x: 90,
        topHeight: 200,
        bottomY: 400,
        width: 80,
        scored: false
      });
      
      // Position bird in the gap
      gameEngine.bird.y = 300;
      
      expect(gameEngine.checkCollisions()).toBe(false);
    });

    it('should not detect collision when bird is not horizontally aligned', () => {
      gameEngine.pipes.push({
        x: 200, // Far from bird
        topHeight: 250,
        bottomY: 450,
        width: 80,
        scored: false
      });
      
      gameEngine.bird.y = 200; // Would collide if aligned
      
      expect(gameEngine.checkCollisions()).toBe(false);
    });

    it('should use collision padding for more forgiving gameplay', () => {
      gameEngine.pipes.push({
        x: 90,
        topHeight: 250,
        bottomY: 450,
        width: 80,
        scored: false
      });
      
      // Position bird just barely touching (within padding)
      gameEngine.bird.y = 250 - gameEngine.collisionPadding + 1;
      
      expect(gameEngine.checkCollisions()).toBe(false);
    });
  });

  describe('Game State Management', () => {
    it('should start game with correct initial state', () => {
      gameEngine.startGame();
      
      expect(gameEngine.gameState).toBe('playing');
      expect(gameEngine.score).toBe(0);
      expect(gameEngine.frame).toBe(0);
      expect(gameEngine.pipes.length).toBe(0);
      expect(gameEngine.bird.velocity).toBe(0);
    });

    it('should handle game over correctly', () => {
      gameEngine.startGame();
      gameEngine.gameOver();
      
      expect(gameEngine.gameState).toBe('over');
      expect(gameEngine.bird.velocity).toBe(0);
    });

    it('should not update game when not playing', () => {
      gameEngine.gameState = 'start';
      const initialFrame = gameEngine.frame;
      
      gameEngine.update({});
      
      expect(gameEngine.frame).toBe(initialFrame);
    });

    it('should trigger game over on collision during update', () => {
      gameEngine.startGame();
      
      // Add collision scenario
      gameEngine.pipes.push({
        x: 90,
        topHeight: 250,
        bottomY: 450,
        width: 80,
        scored: false
      });
      gameEngine.bird.y = 200;
      
      gameEngine.update({});
      
      expect(gameEngine.gameState).toBe('over');
    });
  });

  describe('Calibration Integration', () => {
    it('should use calibration data for gap positioning', () => {
      const testPositions = [0.1, 0.3, 0.5, 0.7, 0.9];
      
      testPositions.forEach(position => {
        gameEngine.calibrationData.currentPosition = position;
        const gapPosition = gameEngine.calculateGapPosition();
        
        expect(gapPosition).toBeCloseTo(position, 1);
      });
    });

    it('should clamp gap position to safe bounds', () => {
      gameEngine.calibrationData.currentPosition = -0.5;
      expect(gameEngine.calculateGapPosition()).toBe(0.1);
      
      gameEngine.calibrationData.currentPosition = 1.5;
      expect(gameEngine.calculateGapPosition()).toBe(0.9);
    });

    it('should handle missing calibration data gracefully', () => {
      gameEngine.calibrationData = null;
      expect(gameEngine.calculateGapPosition()).toBe(0.5);
      
      gameEngine.calibrationData = {};
      expect(gameEngine.calculateGapPosition()).toBe(0.5);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle multiple rapid flaps', () => {
      gameEngine.startGame();
      
      // Simulate rapid flapping
      for (let i = 0; i < 10; i++) {
        gameEngine.updateBird({ shouldFlap: true });
      }
      
      // Bird should not exceed velocity limits
      expect(gameEngine.bird.velocity).toBeGreaterThanOrEqual(-gameEngine.bird.maxVelocity);
      expect(gameEngine.bird.velocity).toBeLessThanOrEqual(gameEngine.bird.maxVelocity);
    });

    it('should handle many pipes efficiently', () => {
      gameEngine.startGame();
      
      // Add many pipes
      for (let i = 0; i < 100; i++) {
        gameEngine.pipes.push({
          x: 800 + (i * 200),
          topHeight: 200,
          bottomY: 400,
          bottomHeight: 200,
          width: 80,
          scored: false
        });
      }
      
      // Should handle update without issues
      expect(() => gameEngine.update({})).not.toThrow();
      expect(gameEngine.pipes.length).toBe(100);
    });

    it('should maintain consistent frame rate calculations', () => {
      gameEngine.startGame();
      
      // Simulate multiple frames
      for (let i = 0; i < 1000; i++) {
        gameEngine.update({});
      }
      
      expect(gameEngine.frame).toBe(1000);
    });
  });
});