import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CalibrationManager for testing calibration workflows
class MockCalibrationManager {
  constructor() {
    this.isCalibrating = false;
    this.calibrationStep = 0;
    this.calibrationReadings = [];
    this.calibrationData = {
      minY: null,
      maxY: null,
      threshold: 0.3,
      smoothing: 0.3
    };
    this.onCalibrationUpdate = null;
    this.onCalibrationComplete = null;
    this.onCalibrationError = null;
    
    // Calibration parameters
    this.minReadingsRequired = 10;
    this.calibrationTimeout = 30000; // 30 seconds
    this.minMotionRange = 1.0;
    this.maxMotionRange = 20.0;
    this.stabilityThreshold = 0.5; // Maximum variance for stability
    this.calibrationSteps = [
      'preparation',
      'recording',
      'validation',
      'adjustment',
      'completion'
    ];
  }

  startCalibration() {
    if (this.isCalibrating) {
      throw new Error('Calibration already in progress');
    }
    
    this.isCalibrating = true;
    this.calibrationStep = 0;
    this.calibrationReadings = [];
    this.calibrationData = {
      minY: null,
      maxY: null,
      threshold: 0.3,
      smoothing: 0.3
    };
    
    this.notifyUpdate('Calibration started. Please prepare for motion recording.');
    
    // Start timeout
    setTimeout(() => {
      if (this.isCalibrating) {
        this.handleCalibrationTimeout();
      }
    }, this.calibrationTimeout);
    
    return { success: true, step: this.calibrationSteps[0] };
  }

  addCalibrationReading(yValue, timestamp = Date.now()) {
    if (!this.isCalibrating) {
      throw new Error('Calibration not active');
    }
    
    if (typeof yValue !== 'number' || isNaN(yValue)) {
      throw new Error('Invalid sensor reading');
    }
    
    const reading = { y: yValue, timestamp: timestamp };
    this.calibrationReadings.push(reading);
    
    // Update min/max values
    if (this.calibrationData.minY === null || yValue < this.calibrationData.minY) {
      this.calibrationData.minY = yValue;
    }
    if (this.calibrationData.maxY === null || yValue > this.calibrationData.maxY) {
      this.calibrationData.maxY = yValue;
    }
    
    // Check if we have enough readings
    if (this.calibrationReadings.length >= this.minReadingsRequired) {
      this.advanceCalibrationStep();
    }
    
    this.notifyUpdate(`Reading ${this.calibrationReadings.length}: Y=${yValue.toFixed(2)}`);
    
    return {
      readingCount: this.calibrationReadings.length,
      currentRange: this.getCurrentRange(),
      minY: this.calibrationData.minY,
      maxY: this.calibrationData.maxY
    };
  }

  advanceCalibrationStep() {
    if (this.calibrationStep < this.calibrationSteps.length - 1) {
      this.calibrationStep++;
      const currentStep = this.calibrationSteps[this.calibrationStep];
      
      switch (currentStep) {
        case 'validation':
          return this.validateCalibrationData();
        case 'adjustment':
          return this.prepareAdjustment();
        case 'completion':
          return this.completeCalibration();
        default:
          this.notifyUpdate(`Advanced to step: ${currentStep}`);
          return { success: true, step: currentStep };
      }
    }
    
    return this.completeCalibration();
  }

  validateCalibrationData() {
    const validation = this.performValidation();
    
    if (validation.valid) {
      this.notifyUpdate('Calibration data validated successfully');
      return this.advanceCalibrationStep();
    } else {
      this.notifyError(`Validation failed: ${validation.errors.join(', ')}`);
      return { success: false, errors: validation.errors };
    }
  }

  performValidation() {
    const errors = [];
    const range = this.getCurrentRange();
    
    // Check if we have enough readings
    if (this.calibrationReadings.length < this.minReadingsRequired) {
      errors.push(`Insufficient readings (${this.calibrationReadings.length}/${this.minReadingsRequired})`);
    }
    
    // Check motion range
    if (range === null) {
      errors.push('No motion range detected');
    } else if (range < this.minMotionRange) {
      errors.push(`Motion range too small (${range.toFixed(2)} < ${this.minMotionRange})`);
    } else if (range > this.maxMotionRange) {
      errors.push(`Motion range too large (${range.toFixed(2)} > ${this.maxMotionRange})`);
    }
    
    // Check data stability
    const stability = this.calculateStability();
    if (stability.variance > this.stabilityThreshold) {
      errors.push(`Motion too unstable (variance: ${stability.variance.toFixed(2)})`);
    }
    
    // Check for outliers
    const outliers = this.detectOutliers();
    if (outliers.length > this.calibrationReadings.length * 0.2) {
      errors.push(`Too many outlier readings (${outliers.length})`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      range: range,
      stability: stability,
      outliers: outliers
    };
  }

  calculateStability() {
    if (this.calibrationReadings.length < 2) {
      return { variance: 0, standardDeviation: 0 };
    }
    
    const values = this.calibrationReadings.map(r => r.y);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return {
      mean: mean,
      variance: variance,
      standardDeviation: Math.sqrt(variance)
    };
  }

  detectOutliers() {
    if (this.calibrationReadings.length < 3) {
      return [];
    }
    
    const values = this.calibrationReadings.map(r => r.y);
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return this.calibrationReadings.filter(reading => 
      reading.y < lowerBound || reading.y > upperBound
    );
  }

  prepareAdjustment() {
    const adjustmentData = {
      currentMin: this.calibrationData.minY,
      currentMax: this.calibrationData.maxY,
      suggestedMin: this.calibrationData.minY,
      suggestedMax: this.calibrationData.maxY,
      allowManualAdjustment: true
    };
    
    this.notifyUpdate('Calibration ready for manual adjustment');
    return { success: true, step: 'adjustment', data: adjustmentData };
  }

  adjustCalibrationValues(minY, maxY, threshold = null) {
    if (!this.isCalibrating) {
      throw new Error('Calibration not active');
    }
    
    if (typeof minY !== 'number' || typeof maxY !== 'number') {
      throw new Error('Invalid adjustment values');
    }
    
    if (minY >= maxY) {
      throw new Error('Minimum value must be less than maximum value');
    }
    
    const range = maxY - minY;
    if (range < this.minMotionRange || range > this.maxMotionRange) {
      throw new Error(`Adjusted range (${range.toFixed(2)}) is outside valid bounds`);
    }
    
    this.calibrationData.minY = minY;
    this.calibrationData.maxY = maxY;
    
    if (threshold !== null) {
      if (threshold < 0.1 || threshold > 0.9) {
        throw new Error('Threshold must be between 0.1 and 0.9');
      }
      this.calibrationData.threshold = threshold;
    }
    
    this.notifyUpdate(`Calibration adjusted: Min=${minY.toFixed(2)}, Max=${maxY.toFixed(2)}`);
    
    return {
      success: true,
      calibrationData: { ...this.calibrationData },
      range: range
    };
  }

  completeCalibration() {
    if (!this.isCalibrating) {
      throw new Error('Calibration not active');
    }
    
    const finalValidation = this.performValidation();
    if (!finalValidation.valid) {
      this.notifyError(`Cannot complete calibration: ${finalValidation.errors.join(', ')}`);
      return { success: false, errors: finalValidation.errors };
    }
    
    this.isCalibrating = false;
    this.calibrationStep = this.calibrationSteps.length - 1;
    
    const result = {
      success: true,
      calibrationData: { ...this.calibrationData },
      statistics: {
        readingCount: this.calibrationReadings.length,
        range: this.getCurrentRange(),
        stability: this.calculateStability(),
        outliers: this.detectOutliers().length,
        duration: this.getCalibrationDuration()
      }
    };
    
    this.notifyComplete(result);
    return result;
  }

  cancelCalibration() {
    if (!this.isCalibrating) {
      return { success: false, error: 'No calibration in progress' };
    }
    
    this.isCalibrating = false;
    this.calibrationStep = 0;
    this.calibrationReadings = [];
    
    this.notifyUpdate('Calibration cancelled');
    return { success: true };
  }

  handleCalibrationTimeout() {
    if (this.isCalibrating) {
      this.notifyError('Calibration timed out');
      this.cancelCalibration();
    }
  }

  getCurrentRange() {
    if (this.calibrationData.minY === null || this.calibrationData.maxY === null) {
      return null;
    }
    return this.calibrationData.maxY - this.calibrationData.minY;
  }

  getCalibrationDuration() {
    if (this.calibrationReadings.length < 2) {
      return 0;
    }
    
    const firstReading = this.calibrationReadings[0];
    const lastReading = this.calibrationReadings[this.calibrationReadings.length - 1];
    
    return lastReading.timestamp - firstReading.timestamp;
  }

  getCalibrationProgress() {
    return {
      isActive: this.isCalibrating,
      currentStep: this.calibrationSteps[this.calibrationStep],
      stepIndex: this.calibrationStep,
      totalSteps: this.calibrationSteps.length,
      readingCount: this.calibrationReadings.length,
      minReadingsRequired: this.minReadingsRequired,
      currentRange: this.getCurrentRange(),
      calibrationData: { ...this.calibrationData }
    };
  }

  // Device orientation simulation
  simulateDeviceOrientation(orientation) {
    const orientations = {
      'portrait': { gravityY: 9.8, baseOffset: 0 },
      'landscape-left': { gravityY: 0, baseOffset: 9.8 },
      'landscape-right': { gravityY: 0, baseOffset: -9.8 },
      'portrait-inverted': { gravityY: -9.8, baseOffset: 0 }
    };
    
    return orientations[orientation] || orientations['portrait'];
  }

  // Motion pattern simulation
  generateMotionPattern(pattern, orientation = 'portrait') {
    const orientationData = this.simulateDeviceOrientation(orientation);
    const baseY = orientationData.baseOffset;
    
    const patterns = {
      'situp': this.generateSitupPattern(baseY),
      'small-range': this.generateSmallRangePattern(baseY),
      'large-range': this.generateLargeRangePattern(baseY),
      'noisy': this.generateNoisyPattern(baseY),
      'unstable': this.generateUnstablePattern(baseY),
      'minimal': this.generateMinimalPattern(baseY)
    };
    
    return patterns[pattern] || patterns['situp'];
  }

  generateSitupPattern(baseY = 0) {
    const readings = [];
    const duration = 5000; // 5 seconds
    const frequency = 60; // 60 Hz
    const totalReadings = (duration / 1000) * frequency;
    
    for (let i = 0; i < totalReadings; i++) {
      const time = (i / frequency) * 1000;
      const situpCycle = Math.sin((i / frequency) * Math.PI * 0.5); // Slow situp motion
      const yValue = baseY + 2 + (situpCycle * 6); // Range from 2 to 8
      
      readings.push({
        y: yValue + (Math.random() - 0.5) * 0.2, // Small noise
        timestamp: Date.now() + time
      });
    }
    
    return readings;
  }

  generateSmallRangePattern(baseY = 0) {
    const readings = [];
    for (let i = 0; i < 50; i++) {
      readings.push({
        y: baseY + 5 + (Math.random() - 0.5) * 0.8, // Very small range
        timestamp: Date.now() + i * 100
      });
    }
    return readings;
  }

  generateLargeRangePattern(baseY = 0) {
    const readings = [];
    for (let i = 0; i < 50; i++) {
      readings.push({
        y: baseY + (Math.random() * 25), // Very large range
        timestamp: Date.now() + i * 100
      });
    }
    return readings;
  }

  generateNoisyPattern(baseY = 0) {
    const readings = [];
    for (let i = 0; i < 50; i++) {
      const baseValue = baseY + 2 + (i / 50) * 6; // Gradual change
      const noise = (Math.random() - 0.5) * 4; // High noise
      readings.push({
        y: baseValue + noise,
        timestamp: Date.now() + i * 100
      });
    }
    return readings;
  }

  generateUnstablePattern(baseY = 0) {
    const readings = [];
    for (let i = 0; i < 50; i++) {
      const randomJump = Math.random() > 0.8 ? (Math.random() - 0.5) * 10 : 0;
      readings.push({
        y: baseY + 2 + (i % 10) + randomJump, // Unstable with jumps
        timestamp: Date.now() + i * 100
      });
    }
    return readings;
  }

  generateMinimalPattern(baseY = 0) {
    return [
      { y: baseY + 5, timestamp: Date.now() },
      { y: baseY + 5.1, timestamp: Date.now() + 1000 }
    ]; // Minimal readings
  }

  // Notification methods
  notifyUpdate(message) {
    if (this.onCalibrationUpdate) {
      this.onCalibrationUpdate(message);
    }
  }

  notifyComplete(result) {
    if (this.onCalibrationComplete) {
      this.onCalibrationComplete(result);
    }
  }

  notifyError(error) {
    if (this.onCalibrationError) {
      this.onCalibrationError(error);
    }
  }
}

describe('Calibration Workflow Integration Tests', () => {
  let calibrationManager;

  beforeEach(() => {
    calibrationManager = new MockCalibrationManager();
  });

  describe('Basic Calibration Workflow', () => {
    it('should complete successful calibration workflow', async () => {
      const result = calibrationManager.startCalibration();
      expect(result.success).toBe(true);
      expect(calibrationManager.isCalibrating).toBe(true);
      
      // Add sufficient readings
      const readings = calibrationManager.generateMotionPattern('situp');
      readings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      // Should auto-advance through steps
      expect(calibrationManager.calibrationStep).toBeGreaterThan(0);
      
      const completion = calibrationManager.completeCalibration();
      expect(completion.success).toBe(true);
      expect(calibrationManager.isCalibrating).toBe(false);
    });

    it('should track calibration progress correctly', () => {
      calibrationManager.startCalibration();
      
      const initialProgress = calibrationManager.getCalibrationProgress();
      expect(initialProgress.isActive).toBe(true);
      expect(initialProgress.currentStep).toBe('preparation');
      expect(initialProgress.readingCount).toBe(0);
      
      // Add some readings
      for (let i = 0; i < 5; i++) {
        calibrationManager.addCalibrationReading(2 + i, Date.now() + i * 100);
      }
      
      const updatedProgress = calibrationManager.getCalibrationProgress();
      expect(updatedProgress.readingCount).toBe(5);
      expect(updatedProgress.currentRange).toBeGreaterThan(0);
    });

    it('should handle calibration cancellation', () => {
      calibrationManager.startCalibration();
      calibrationManager.addCalibrationReading(5.0);
      
      const cancelResult = calibrationManager.cancelCalibration();
      expect(cancelResult.success).toBe(true);
      expect(calibrationManager.isCalibrating).toBe(false);
      expect(calibrationManager.calibrationReadings).toHaveLength(0);
    });

    it('should timeout long calibrations', () => {
      vi.useFakeTimers();
      
      calibrationManager.startCalibration();
      
      // Advance time past timeout
      vi.advanceTimersByTime(35000);
      
      expect(calibrationManager.isCalibrating).toBe(false);
      
      vi.useRealTimers();
    });
  });

  describe('Motion Range Validation', () => {
    it('should accept valid motion ranges', () => {
      calibrationManager.startCalibration();
      
      const validReadings = [
        { y: 2.0 }, { y: 2.5 }, { y: 3.0 }, { y: 4.0 }, { y: 5.0 },
        { y: 6.0 }, { y: 7.0 }, { y: 7.5 }, { y: 8.0 }, { y: 7.8 },
        { y: 3.2 }, { y: 2.1 }, { y: 6.5 }
      ];
      
      validReadings.forEach((reading, i) => {
        calibrationManager.addCalibrationReading(reading.y, Date.now() + i * 100);
      });
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(true);
      expect(validation.range).toBeGreaterThan(calibrationManager.minMotionRange);
    });

    it('should reject motion range that is too small', () => {
      calibrationManager.startCalibration();
      
      const smallRangeReadings = calibrationManager.generateMotionPattern('small-range');
      smallRangeReadings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('too small'))).toBe(true);
    });

    it('should reject motion range that is too large', () => {
      calibrationManager.startCalibration();
      
      const largeRangeReadings = calibrationManager.generateMotionPattern('large-range');
      largeRangeReadings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('too large'))).toBe(true);
    });

    it('should detect insufficient readings', () => {
      calibrationManager.startCalibration();
      
      // Add only a few readings
      for (let i = 0; i < 3; i++) {
        calibrationManager.addCalibrationReading(2 + i * 2, Date.now() + i * 100);
      }
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Insufficient readings'))).toBe(true);
    });
  });

  describe('Device Orientation Handling', () => {
    const orientations = ['portrait', 'landscape-left', 'landscape-right', 'portrait-inverted'];
    
    orientations.forEach(orientation => {
      it(`should handle ${orientation} orientation`, () => {
        calibrationManager.startCalibration();
        
        const readings = calibrationManager.generateMotionPattern('situp', orientation);
        readings.slice(0, 15).forEach(reading => {
          calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
        });
        
        const validation = calibrationManager.performValidation();
        expect(validation.valid).toBe(true);
        
        const completion = calibrationManager.completeCalibration();
        expect(completion.success).toBe(true);
        expect(completion.calibrationData.minY).toBeLessThan(completion.calibrationData.maxY);
      });
    });

    it('should adapt to different gravity orientations', () => {
      const orientationResults = {};
      
      orientations.forEach(orientation => {
        const manager = new MockCalibrationManager();
        manager.startCalibration();
        
        const readings = manager.generateMotionPattern('situp', orientation);
        readings.slice(0, 15).forEach(reading => {
          manager.addCalibrationReading(reading.y, reading.timestamp);
        });
        
        const result = manager.completeCalibration();
        orientationResults[orientation] = result.calibrationData;
      });
      
      // All orientations should produce valid calibration data
      Object.values(orientationResults).forEach(data => {
        expect(data.minY).toBeLessThan(data.maxY);
        expect(data.maxY - data.minY).toBeGreaterThan(1.0);
      });
    });
  });

  describe('Data Quality and Stability', () => {
    it('should detect unstable motion patterns', () => {
      calibrationManager.startCalibration();
      
      const unstableReadings = calibrationManager.generateMotionPattern('unstable');
      unstableReadings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('unstable'))).toBe(true);
    });

    it('should handle noisy sensor data', () => {
      calibrationManager.startCalibration();
      
      const noisyReadings = calibrationManager.generateMotionPattern('noisy');
      noisyReadings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const stability = calibrationManager.calculateStability();
      expect(stability.variance).toBeGreaterThan(0);
      expect(stability.standardDeviation).toBeGreaterThan(0);
    });

    it('should detect and report outliers', () => {
      calibrationManager.startCalibration();
      
      // Add normal readings
      for (let i = 0; i < 10; i++) {
        calibrationManager.addCalibrationReading(5 + Math.random(), Date.now() + i * 100);
      }
      
      // Add outliers
      calibrationManager.addCalibrationReading(50, Date.now() + 1100); // Extreme outlier
      calibrationManager.addCalibrationReading(-20, Date.now() + 1200); // Extreme outlier
      
      const outliers = calibrationManager.detectOutliers();
      expect(outliers.length).toBeGreaterThan(0);
    });

    it('should calculate motion stability metrics', () => {
      calibrationManager.startCalibration();
      
      // Add consistent readings
      const consistentValues = [5.0, 5.1, 4.9, 5.2, 4.8, 5.0, 5.1];
      consistentValues.forEach((value, i) => {
        calibrationManager.addCalibrationReading(value, Date.now() + i * 100);
      });
      
      const stability = calibrationManager.calculateStability();
      expect(stability.variance).toBeLessThan(0.1); // Low variance for consistent data
      expect(stability.mean).toBeCloseTo(5.0, 1);
    });
  });

  describe('Manual Calibration Adjustment', () => {
    beforeEach(() => {
      calibrationManager.startCalibration();
      
      // Add sufficient readings to reach adjustment phase
      const readings = calibrationManager.generateMotionPattern('situp');
      readings.slice(0, 15).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
    });

    it('should allow manual adjustment of calibration values', () => {
      const adjustResult = calibrationManager.adjustCalibrationValues(1.5, 9.5, 0.4);
      
      expect(adjustResult.success).toBe(true);
      expect(calibrationManager.calibrationData.minY).toBe(1.5);
      expect(calibrationManager.calibrationData.maxY).toBe(9.5);
      expect(calibrationManager.calibrationData.threshold).toBe(0.4);
    });

    it('should validate manual adjustments', () => {
      // Invalid: min >= max
      expect(() => {
        calibrationManager.adjustCalibrationValues(8.0, 7.0);
      }).toThrow('Minimum value must be less than maximum value');
      
      // Invalid: range too small
      expect(() => {
        calibrationManager.adjustCalibrationValues(5.0, 5.5);
      }).toThrow('outside valid bounds');
      
      // Invalid: threshold out of range
      expect(() => {
        calibrationManager.adjustCalibrationValues(2.0, 8.0, 1.5);
      }).toThrow('Threshold must be between 0.1 and 0.9');
    });

    it('should preserve adjusted values through completion', () => {
      calibrationManager.adjustCalibrationValues(2.5, 7.5, 0.35);
      
      const completion = calibrationManager.completeCalibration();
      
      expect(completion.success).toBe(true);
      expect(completion.calibrationData.minY).toBe(2.5);
      expect(completion.calibrationData.maxY).toBe(7.5);
      expect(completion.calibrationData.threshold).toBe(0.35);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid sensor readings', () => {
      calibrationManager.startCalibration();
      
      const invalidInputs = [NaN, null, undefined, 'invalid', Infinity, -Infinity];
      
      invalidInputs.forEach(input => {
        expect(() => {
          calibrationManager.addCalibrationReading(input);
        }).toThrow('Invalid sensor reading');
      });
    });

    it('should prevent operations when calibration is not active', () => {
      expect(() => {
        calibrationManager.addCalibrationReading(5.0);
      }).toThrow('Calibration not active');
      
      expect(() => {
        calibrationManager.adjustCalibrationValues(2.0, 8.0);
      }).toThrow('Calibration not active');
    });

    it('should prevent starting calibration when already active', () => {
      calibrationManager.startCalibration();
      
      expect(() => {
        calibrationManager.startCalibration();
      }).toThrow('Calibration already in progress');
    });

    it('should handle minimal data gracefully', () => {
      calibrationManager.startCalibration();
      
      const minimalReadings = calibrationManager.generateMotionPattern('minimal');
      minimalReadings.forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const validation = calibrationManager.performValidation();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Calibration Statistics and Reporting', () => {
    it('should provide comprehensive calibration statistics', () => {
      calibrationManager.startCalibration();
      
      const readings = calibrationManager.generateMotionPattern('situp');
      readings.slice(0, 20).forEach(reading => {
        calibrationManager.addCalibrationReading(reading.y, reading.timestamp);
      });
      
      const completion = calibrationManager.completeCalibration();
      
      expect(completion.statistics).toBeDefined();
      expect(completion.statistics.readingCount).toBe(20);
      expect(completion.statistics.range).toBeGreaterThan(0);
      expect(completion.statistics.stability).toBeDefined();
      expect(completion.statistics.duration).toBeGreaterThan(0);
    });

    it('should track calibration duration accurately', () => {
      calibrationManager.startCalibration();
      
      const startTime = Date.now();
      calibrationManager.addCalibrationReading(2.0, startTime);
      calibrationManager.addCalibrationReading(8.0, startTime + 5000);
      
      const duration = calibrationManager.getCalibrationDuration();
      expect(duration).toBe(5000);
    });

    it('should provide real-time calibration feedback', () => {
      const updates = [];
      calibrationManager.onCalibrationUpdate = (message) => updates.push(message);
      
      calibrationManager.startCalibration();
      calibrationManager.addCalibrationReading(5.0);
      
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0]).toContain('Calibration started');
    });
  });
});