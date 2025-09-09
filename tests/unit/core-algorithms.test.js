import { describe, it, expect, vi, beforeEach } from 'vitest';

// Core algorithm implementations for testing
class SensorProcessor {
  constructor() {
    this.readings = [];
    this.maxReadings = 5;
  }

  processReading(yValue, calibrationData) {
    // Add to readings for smoothing
    this.readings.push(yValue);
    if (this.readings.length > this.maxReadings) {
      this.readings.shift();
    }

    // Calculate smoothed value
    const smoothedY = this.readings.reduce((sum, val) => sum + val, 0) / this.readings.length;

    // Calculate normalized position
    const range = calibrationData.maxY - calibrationData.minY;
    let normalizedPosition = 0.5; // Default

    if (range > 0) {
      normalizedPosition = Math.max(0, Math.min(1, 
        (smoothedY - calibrationData.minY) / range
      ));
    }

    return {
      rawY: yValue,
      smoothedY: smoothedY,
      normalizedPosition: normalizedPosition,
      range: range
    };
  }

  validateCalibration(calibrationData) {
    const { minY, maxY, threshold } = calibrationData;
    const errors = [];

    if (minY === null || maxY === null) {
      errors.push('Calibration data incomplete');
    }

    if (minY !== null && maxY !== null) {
      const range = maxY - minY;
      if (range < 1.0) {
        errors.push('Motion range too small');
      }
      if (range > 20.0) {
        errors.push('Motion range too large');
      }
    }

    if (threshold < 0.1 || threshold > 0.9) {
      errors.push('Invalid threshold');
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      range: maxY !== null && minY !== null ? maxY - minY : null
    };
  }
}

class MotionDetector {
  constructor() {
    this.isInDownState = false;
    this.lastFlapTime = 0;
    this.flapCooldown = 200;
  }

  detectMotion(normalizedPosition, threshold = 0.3) {
    const downThreshold = threshold;
    const upThreshold = 1 - threshold;
    const currentTime = Date.now();
    
    let shouldFlap = false;

    // Check for down state
    if (normalizedPosition < downThreshold && !this.isInDownState) {
      this.isInDownState = true;
    } 
    // Check for up transition (flap)
    else if (normalizedPosition > upThreshold && this.isInDownState) {
      if (currentTime - this.lastFlapTime > this.flapCooldown) {
        shouldFlap = true;
        this.lastFlapTime = currentTime;
      }
      this.isInDownState = false;
    }

    return {
      isDown: this.isInDownState,
      shouldFlap: shouldFlap,
      position: normalizedPosition
    };
  }
}

class GamePhysics {
  constructor() {
    this.bird = {
      x: 100,
      y: 300,
      velocity: 0,
      gravity: 0.2,
      flapStrength: -4.5
    };
    this.pipes = [];
    this.score = 0;
  }

  updateBird(shouldFlap) {
    // Apply gravity first
    this.bird.velocity += this.bird.gravity;
    
    // Then apply flap if needed
    if (shouldFlap) {
      this.bird.velocity = this.bird.flapStrength;
    }

    this.bird.y += this.bird.velocity;

    // Keep bird in bounds
    if (this.bird.y < 0) {
      this.bird.y = 0;
      this.bird.velocity = 0;
    }
  }

  checkCollision(pipeX, pipeTopHeight, pipeBottomY, pipeWidth) {
    const birdLeft = this.bird.x;
    const birdRight = this.bird.x + 50; // bird width
    const birdTop = this.bird.y;
    const birdBottom = this.bird.y + 40; // bird height

    const pipeLeft = pipeX;
    const pipeRight = pipeX + pipeWidth;

    // Check horizontal overlap
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      // Check collision with top or bottom pipe
      if (birdTop < pipeTopHeight || birdBottom > pipeBottomY) {
        return true;
      }
    }

    return false;
  }

  calculateScore(pipeX, pipeWidth) {
    // Score when bird passes pipe
    if (pipeX + pipeWidth < this.bird.x) {
      return 1;
    }
    return 0;
  }
}

describe('Core Algorithm Tests', () => {
  describe('Sensor Processing', () => {
    let processor;

    beforeEach(() => {
      processor = new SensorProcessor();
    });

    it('should calculate normalized position correctly', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      
      const result = processor.processReading(5.0, calibrationData);
      
      expect(result.normalizedPosition).toBe(0.5);
      expect(result.range).toBe(6.0);
    });

    it('should clamp values to 0-1 range', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      
      let result = processor.processReading(0.0, calibrationData);
      expect(result.normalizedPosition).toBe(0);
      
      result = processor.processReading(10.0, calibrationData);
      expect(result.normalizedPosition).toBe(1);
    });

    it('should smooth sensor readings', () => {
      const calibrationData = { minY: 0.0, maxY: 10.0, threshold: 0.3 };
      
      processor.processReading(4.0, calibrationData);
      processor.processReading(5.0, calibrationData);
      const result = processor.processReading(6.0, calibrationData);
      
      expect(result.smoothedY).toBe(5.0);
    });

    it('should validate calibration data', () => {
      const validData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      const result = processor.validateCalibration(validData);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid calibration', () => {
      const invalidData = { minY: null, maxY: 8.0, threshold: 0.3 };
      const result = processor.validateCalibration(invalidData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Calibration data incomplete');
    });
  });

  describe('Motion Detection', () => {
    let detector;

    beforeEach(() => {
      detector = new MotionDetector();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should detect down state', () => {
      const result = detector.detectMotion(0.2, 0.3); // Below threshold
      
      expect(result.isDown).toBe(true);
      expect(detector.isInDownState).toBe(true);
    });

    it('should trigger flap on up transition', () => {
      // Go down first
      detector.detectMotion(0.2, 0.3);
      expect(detector.isInDownState).toBe(true);
      
      // Then go up
      const result = detector.detectMotion(0.8, 0.3);
      
      expect(result.shouldFlap).toBe(true);
      expect(detector.isInDownState).toBe(false);
    });

    it('should respect flap cooldown', () => {
      // First flap
      detector.detectMotion(0.2, 0.3);
      let result = detector.detectMotion(0.8, 0.3);
      expect(result.shouldFlap).toBe(true);
      
      // Immediate second attempt
      detector.detectMotion(0.2, 0.3);
      result = detector.detectMotion(0.8, 0.3);
      expect(result.shouldFlap).toBe(false);
      
      // After cooldown
      vi.advanceTimersByTime(250);
      detector.detectMotion(0.2, 0.3);
      result = detector.detectMotion(0.8, 0.3);
      expect(result.shouldFlap).toBe(true);
    });
  });

  describe('Game Physics', () => {
    let physics;

    beforeEach(() => {
      physics = new GamePhysics();
    });

    it('should apply gravity to bird', () => {
      const initialVelocity = physics.bird.velocity;
      physics.updateBird(false);
      
      expect(physics.bird.velocity).toBe(initialVelocity + physics.bird.gravity);
    });

    it('should apply flap force', () => {
      physics.updateBird(true);
      
      expect(physics.bird.velocity).toBe(physics.bird.flapStrength);
    });

    it('should update bird position', () => {
      const initialY = physics.bird.y;
      physics.bird.velocity = 5;
      physics.updateBird(false);
      
      expect(physics.bird.y).toBe(initialY + 5 + physics.bird.gravity);
    });

    it('should detect pipe collision', () => {
      physics.bird.y = 200;
      
      // Collision with top pipe
      const collision = physics.checkCollision(90, 250, 450, 80);
      expect(collision).toBe(true);
    });

    it('should not detect collision in gap', () => {
      physics.bird.y = 350; // In the gap
      
      const collision = physics.checkCollision(90, 250, 450, 80);
      expect(collision).toBe(false);
    });

    it('should calculate score correctly', () => {
      physics.bird.x = 100;
      
      // Pipe behind bird should score
      const score = physics.calculateScore(10, 80); // Pipe at x=10, width=80, so right edge at 90
      expect(score).toBe(1);
      
      // Pipe ahead of bird should not score
      const noScore = physics.calculateScore(200, 80);
      expect(noScore).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    let processor, detector, physics;

    beforeEach(() => {
      processor = new SensorProcessor();
      detector = new MotionDetector();
      physics = new GamePhysics();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should process complete sensor-to-game flow', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      
      // Simulate situp motion
      const motionSequence = [
        3.0, // Down
        7.0, // Up (should flap)
        3.0, // Down again
        7.0  // Up again (should flap after cooldown)
      ];
      
      let flapCount = 0;
      
      motionSequence.forEach((yValue, index) => {
        // Process sensor reading
        const sensorResult = processor.processReading(yValue, calibrationData);
        
        // Detect motion
        const motionResult = detector.detectMotion(sensorResult.normalizedPosition);
        
        // Update game physics
        physics.updateBird(motionResult.shouldFlap);
        
        if (motionResult.shouldFlap) {
          flapCount++;
        }
        
        // Advance time between readings
        vi.advanceTimersByTime(300);
      });
      
      expect(flapCount).toBeGreaterThan(0);
      expect(physics.bird.velocity).toBeLessThan(0); // Should have negative velocity from last flap
    });

    it('should handle various device orientations', () => {
      const orientations = [
        { minY: -8, maxY: -2, name: 'portrait' },
        { minY: -4, maxY: 4, name: 'landscape' },
        { minY: 2, maxY: 8, name: 'inverted' }
      ];
      
      orientations.forEach(orientation => {
        const calibrationData = { 
          minY: orientation.minY, 
          maxY: orientation.maxY, 
          threshold: 0.3 
        };
        
        const validation = processor.validateCalibration(calibrationData);
        expect(validation.valid).toBe(true);
        
        // Test middle position
        const midPoint = (orientation.minY + orientation.maxY) / 2;
        const result = processor.processReading(midPoint, calibrationData);
        expect(result.normalizedPosition).toBeCloseTo(0.5, 1);
      });
    });

    it('should maintain performance with high-frequency updates', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      const startTime = performance.now();
      
      // Process 100 readings
      for (let i = 0; i < 100; i++) {
        const yValue = 2 + Math.sin(i * 0.1) * 6; // Oscillating motion
        const sensorResult = processor.processReading(yValue, calibrationData);
        const motionResult = detector.detectMotion(sensorResult.normalizedPosition);
        physics.updateBird(motionResult.shouldFlap);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should process quickly (less than 50ms for 100 readings)
      expect(duration).toBeLessThan(50);
    });
  });
});