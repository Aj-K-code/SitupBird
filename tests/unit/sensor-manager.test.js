import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SensorManager class since it's part of app.js
// We'll extract the key functions for testing
class MockSensorManager {
  constructor() {
    this.calibrationData = {
      minY: null,
      maxY: null,
      threshold: 0.5,
      smoothing: 0.3
    };
    this.sensorReadings = [];
    this.maxReadings = 5;
    this.isInDownState = false;
    this.lastFlapTime = 0;
    this.flapCooldown = 200;
  }

  // Core calibration algorithm
  updateCalibration(yValue) {
    if (this.calibrationData.minY === null || yValue < this.calibrationData.minY) {
      this.calibrationData.minY = yValue;
    }
    if (this.calibrationData.maxY === null || yValue > this.calibrationData.maxY) {
      this.calibrationData.maxY = yValue;
    }
  }

  // Sensor data processing algorithm
  processSensorData(rawY, calibrationData) {
    // Smooth the sensor reading
    this.sensorReadings.push(rawY);
    if (this.sensorReadings.length > this.maxReadings) {
      this.sensorReadings.shift();
    }
    
    const smoothedY = this.sensorReadings.reduce((sum, val) => sum + val, 0) / this.sensorReadings.length;
    
    // Calculate normalized position (0 = down, 1 = up)
    const range = calibrationData.maxY - calibrationData.minY;
    let normalizedPosition = 0.5; // Default middle position
    
    if (range > 0) {
      normalizedPosition = Math.max(0, Math.min(1, 
        (smoothedY - calibrationData.minY) / range
      ));
    }
    
    // Determine motion state
    const downThreshold = calibrationData.threshold;
    const upThreshold = 1 - calibrationData.threshold;
    
    let shouldFlap = false;
    const currentTime = Date.now();
    
    // Check for situp motion (down -> up transition)
    if (normalizedPosition < downThreshold && !this.isInDownState) {
      this.isInDownState = true;
    } else if (normalizedPosition > upThreshold && this.isInDownState) {
      // Flap on up transition if cooldown has passed
      if (currentTime - this.lastFlapTime > this.flapCooldown) {
        shouldFlap = true;
        this.lastFlapTime = currentTime;
      }
      this.isInDownState = false;
    }
    
    return {
      rawY: rawY,
      smoothedY: smoothedY,
      normalizedPosition: normalizedPosition,
      isDown: this.isInDownState,
      shouldFlap: shouldFlap,
      gapPosition: normalizedPosition
    };
  }

  // Calibration validation
  validateCalibration(calibrationData) {
    const { minY, maxY, threshold } = calibrationData;
    
    const errors = [];
    
    if (minY === null || maxY === null) {
      errors.push('Calibration data incomplete');
    }
    
    if (minY !== null && maxY !== null) {
      const range = maxY - minY;
      if (range < 1.0) {
        errors.push('Motion range too small (minimum 1.0)');
      }
      if (range > 20.0) {
        errors.push('Motion range too large (maximum 20.0)');
      }
    }
    
    if (threshold < 0.1 || threshold > 0.9) {
      errors.push('Threshold must be between 0.1 and 0.9');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      range: maxY !== null && minY !== null ? maxY - minY : null
    };
  }
}

describe('SensorManager - Calibration Algorithms', () => {
  let sensorManager;

  beforeEach(() => {
    sensorManager = new MockSensorManager();
  });

  describe('updateCalibration', () => {
    it('should initialize min and max values on first reading', () => {
      sensorManager.updateCalibration(5.0);
      
      expect(sensorManager.calibrationData.minY).toBe(5.0);
      expect(sensorManager.calibrationData.maxY).toBe(5.0);
    });

    it('should update minimum value when lower reading is received', () => {
      sensorManager.updateCalibration(5.0);
      sensorManager.updateCalibration(3.0);
      
      expect(sensorManager.calibrationData.minY).toBe(3.0);
      expect(sensorManager.calibrationData.maxY).toBe(5.0);
    });

    it('should update maximum value when higher reading is received', () => {
      sensorManager.updateCalibration(5.0);
      sensorManager.updateCalibration(8.0);
      
      expect(sensorManager.calibrationData.minY).toBe(5.0);
      expect(sensorManager.calibrationData.maxY).toBe(8.0);
    });

    it('should handle negative values correctly', () => {
      sensorManager.updateCalibration(-2.0);
      sensorManager.updateCalibration(-5.0);
      sensorManager.updateCalibration(1.0);
      
      expect(sensorManager.calibrationData.minY).toBe(-5.0);
      expect(sensorManager.calibrationData.maxY).toBe(1.0);
    });
  });

  describe('processSensorData', () => {
    beforeEach(() => {
      // Set up calibration data for testing
      sensorManager.calibrationData = {
        minY: 2.0,
        maxY: 8.0,
        threshold: 0.3,
        smoothing: 0.3
      };
    });

    it('should calculate normalized position correctly', () => {
      const result = sensorManager.processSensorData(5.0, sensorManager.calibrationData);
      
      // (5.0 - 2.0) / (8.0 - 2.0) = 3.0 / 6.0 = 0.5
      expect(result.normalizedPosition).toBe(0.5);
    });

    it('should clamp normalized position between 0 and 1', () => {
      let result = sensorManager.processSensorData(0.0, sensorManager.calibrationData);
      expect(result.normalizedPosition).toBe(0);
      
      result = sensorManager.processSensorData(10.0, sensorManager.calibrationData);
      expect(result.normalizedPosition).toBe(1);
    });

    it('should smooth sensor readings over multiple samples', () => {
      // Add several readings
      sensorManager.processSensorData(4.0, sensorManager.calibrationData);
      sensorManager.processSensorData(5.0, sensorManager.calibrationData);
      const result = sensorManager.processSensorData(6.0, sensorManager.calibrationData);
      
      // Smoothed value should be average: (4.0 + 5.0 + 6.0) / 3 = 5.0
      expect(result.smoothedY).toBe(5.0);
    });

    it('should detect down state when below threshold', () => {
      // Position 0.2 is below threshold of 0.3
      const result = sensorManager.processSensorData(3.2, sensorManager.calibrationData);
      
      expect(result.isDown).toBe(true);
      expect(sensorManager.isInDownState).toBe(true);
    });

    it('should trigger flap on up transition from down state', () => {
      // First go down
      sensorManager.processSensorData(3.0, sensorManager.calibrationData); // Below threshold
      expect(sensorManager.isInDownState).toBe(true);
      
      // Then go up
      const result = sensorManager.processSensorData(7.0, sensorManager.calibrationData); // Above up threshold
      
      expect(result.shouldFlap).toBe(true);
      expect(sensorManager.isInDownState).toBe(false);
    });

    it('should respect flap cooldown period', () => {
      vi.useFakeTimers();
      
      // First flap
      sensorManager.processSensorData(3.0, sensorManager.calibrationData);
      let result = sensorManager.processSensorData(7.0, sensorManager.calibrationData);
      expect(result.shouldFlap).toBe(true);
      
      // Immediate second attempt (within cooldown)
      sensorManager.processSensorData(3.0, sensorManager.calibrationData);
      result = sensorManager.processSensorData(7.0, sensorManager.calibrationData);
      expect(result.shouldFlap).toBe(false);
      
      // After cooldown period
      vi.advanceTimersByTime(250);
      sensorManager.processSensorData(3.0, sensorManager.calibrationData);
      result = sensorManager.processSensorData(7.0, sensorManager.calibrationData);
      expect(result.shouldFlap).toBe(true);
      
      vi.useRealTimers();
    });

    it('should limit sensor readings array to maxReadings', () => {
      // Add more readings than maxReadings
      for (let i = 0; i < 10; i++) {
        sensorManager.processSensorData(i, sensorManager.calibrationData);
      }
      
      expect(sensorManager.sensorReadings.length).toBe(sensorManager.maxReadings);
      expect(sensorManager.sensorReadings[0]).toBe(5); // Should have removed earlier readings
    });
  });

  describe('validateCalibration', () => {
    it('should validate complete calibration data', () => {
      const calibrationData = {
        minY: 2.0,
        maxY: 8.0,
        threshold: 0.3
      };
      
      const result = sensorManager.validateCalibration(calibrationData);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.range).toBe(6.0);
    });

    it('should reject incomplete calibration data', () => {
      const calibrationData = {
        minY: null,
        maxY: 8.0,
        threshold: 0.3
      };
      
      const result = sensorManager.validateCalibration(calibrationData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Calibration data incomplete');
    });

    it('should reject motion range that is too small', () => {
      const calibrationData = {
        minY: 5.0,
        maxY: 5.5, // Range of 0.5 is too small
        threshold: 0.3
      };
      
      const result = sensorManager.validateCalibration(calibrationData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Motion range too small (minimum 1.0)');
    });

    it('should reject motion range that is too large', () => {
      const calibrationData = {
        minY: 0.0,
        maxY: 25.0, // Range of 25.0 is too large
        threshold: 0.3
      };
      
      const result = sensorManager.validateCalibration(calibrationData);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Motion range too large (maximum 20.0)');
    });

    it('should reject invalid threshold values', () => {
      let calibrationData = {
        minY: 2.0,
        maxY: 8.0,
        threshold: 0.05 // Too low
      };
      
      let result = sensorManager.validateCalibration(calibrationData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold must be between 0.1 and 0.9');
      
      calibrationData.threshold = 0.95; // Too high
      result = sensorManager.validateCalibration(calibrationData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold must be between 0.1 and 0.9');
    });
  });

  describe('Edge Cases and Device Orientations', () => {
    it('should handle various device orientations', () => {
      const orientationTests = [
        { minY: -8.0, maxY: -2.0, name: 'Portrait (lying down negative)' },
        { minY: 2.0, maxY: 8.0, name: 'Portrait (sitting up positive)' },
        { minY: -4.0, maxY: 4.0, name: 'Landscape (crossing zero)' },
        { minY: 0.5, maxY: 9.5, name: 'Tilted device' }
      ];
      
      orientationTests.forEach(({ minY, maxY, name }) => {
        const calibrationData = { minY, maxY, threshold: 0.3 };
        const midPoint = (minY + maxY) / 2;
        
        const result = sensorManager.processSensorData(midPoint, calibrationData);
        
        expect(result.normalizedPosition).toBeCloseTo(0.5, 2);
        expect(sensorManager.validateCalibration(calibrationData).valid).toBe(true);
      });
    });

    it('should handle rapid motion changes', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      
      // Simulate rapid up-down-up motion
      const motionSequence = [3.0, 7.0, 3.0, 7.0, 3.0, 7.0];
      const results = [];
      
      motionSequence.forEach(yValue => {
        results.push(sensorManager.processSensorData(yValue, calibrationData));
      });
      
      // Should detect multiple flaps but respect cooldown
      const flapCount = results.filter(r => r.shouldFlap).length;
      expect(flapCount).toBeGreaterThan(0);
      expect(flapCount).toBeLessThan(motionSequence.length / 2); // Due to cooldown
    });

    it('should handle sensor noise and jitter', () => {
      const calibrationData = { minY: 2.0, maxY: 8.0, threshold: 0.3 };
      
      // Add noisy readings around a base value
      const baseValue = 5.0;
      const noisyReadings = [
        baseValue + 0.1,
        baseValue - 0.05,
        baseValue + 0.08,
        baseValue - 0.03,
        baseValue + 0.02
      ];
      
      let lastSmoothed = null;
      noisyReadings.forEach(reading => {
        const result = sensorManager.processSensorData(reading, calibrationData);
        if (lastSmoothed !== null) {
          // Smoothed value should be more stable than raw readings
          const smoothedChange = Math.abs(result.smoothedY - lastSmoothed);
          const rawChange = Math.abs(reading - noisyReadings[noisyReadings.indexOf(reading) - 1]);
          expect(smoothedChange).toBeLessThanOrEqual(rawChange);
        }
        lastSmoothed = result.smoothedY;
      });
    });
  });
});