# Situp Bird Game - Test Suite

This comprehensive test suite validates all aspects of the Situp Bird game, from core algorithms to complete gameplay flows.

## Test Structure

### Unit Tests (`tests/unit/`)

#### `core-algorithms.test.js`
Tests the fundamental algorithms that power the game:

- **Sensor Processing**: Validates sensor data normalization, smoothing, and calibration validation
- **Motion Detection**: Tests situp motion detection, flap triggering, and cooldown mechanisms  
- **Game Physics**: Verifies bird physics, collision detection, and scoring logic
- **Integration**: Tests complete sensor-to-game data flow

#### `sensor-manager.test.js` (Legacy)
Original comprehensive sensor manager tests covering:
- Calibration algorithms with various motion ranges
- Device orientation handling
- Edge cases and error conditions

#### `game-engine.test.js` (Legacy)
Original game engine tests covering:
- Bird physics simulation
- Pipe generation and movement
- Collision detection
- Game state management

### Integration Tests (`tests/integration/`)

#### `room-management.test.js`
Tests WebSocket room management and real-time communication:

- **Room Creation**: Unique code generation and room lifecycle
- **Participant Management**: Joining, leaving, and connection handling
- **Message Routing**: Real-time message passing between devices
- **Statistics**: Server monitoring and performance metrics
- **Error Handling**: Connection failures and edge cases

#### `websocket-communication.test.js` (Legacy)
Original WebSocket integration tests

#### `calibration-workflow.test.js` (Legacy)
Original calibration workflow tests

### End-to-End Tests (`tests/e2e/`)

#### `gameplay-flow.test.js`
Tests complete gameplay scenarios:

- **Game Setup**: Full calibration and room creation flow
- **Controller Setup**: Device pairing and sensor initialization
- **Sensor Processing**: Motion detection and game control
- **Game Sessions**: Complete gameplay from start to finish
- **Error Handling**: Disconnections and failure recovery
- **Performance**: High-frequency updates and stress testing
- **Compatibility**: Different device orientations and motion ranges

#### `complete-gameplay.test.js` (Legacy)
Original comprehensive E2E tests

## Test Categories

### 1. Sensor Data Processing and Calibration Algorithms
- ✅ Calibration data collection and validation
- ✅ Motion range detection (minimum 1.0, maximum 20.0)
- ✅ Sensor reading smoothing and noise reduction
- ✅ Normalized position calculation (0-1 range)
- ✅ Device orientation adaptation
- ✅ Edge case handling (extreme values, insufficient data)

### 2. Motion Detection and Flap Triggering
- ✅ Down state detection (below threshold)
- ✅ Up transition detection (flap trigger)
- ✅ Flap cooldown mechanism (200ms minimum)
- ✅ Rapid motion handling
- ✅ Motion pattern validation

### 3. Game Physics and Mechanics
- ✅ Bird gravity simulation
- ✅ Flap force application
- ✅ Velocity limiting and position updates
- ✅ Collision detection with pipes and boundaries
- ✅ Scoring system (pipe passage detection)
- ✅ Game state transitions

### 4. WebSocket Communication and Room Management
- ✅ Room creation with unique 4-digit codes
- ✅ Participant joining (maximum 2 per room)
- ✅ Real-time message routing between devices
- ✅ Connection state management
- ✅ Disconnection handling and cleanup
- ✅ High-frequency message performance

### 5. Complete Gameplay Flow
- ✅ Game setup and calibration workflow
- ✅ Controller pairing and sensor initialization
- ✅ Real-time gameplay with motion control
- ✅ Score tracking and session statistics
- ✅ Error recovery and reconnection
- ✅ Multi-session gameplay

### 6. Cross-Device Compatibility
- ✅ Various device orientations (portrait, landscape, inverted)
- ✅ Different motion ranges and calibration scenarios
- ✅ Mobile device simulation
- ✅ Browser compatibility considerations

### 7. Performance and Stress Testing
- ✅ High-frequency sensor updates (60Hz simulation)
- ✅ Multiple concurrent rooms and participants
- ✅ Extended gameplay sessions
- ✅ Memory usage and cleanup validation
- ✅ Response time measurements

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Test UI (interactive)
```bash
npm run test:ui
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test Categories
```bash
# Unit tests only
npx vitest tests/unit/

# Integration tests only  
npx vitest tests/integration/

# E2E tests only
npx vitest tests/e2e/
```

## Test Configuration

The test suite uses:
- **Vitest** as the test runner
- **jsdom** for browser environment simulation
- **Mock implementations** for WebSocket, sensors, and canvas
- **Fake timers** for time-dependent tests
- **Performance measurements** for optimization validation

## Coverage Requirements

The test suite validates all requirements from the specification:

### Requirement Coverage Matrix

| Requirement | Test Coverage | Status |
|-------------|---------------|--------|
| 1.1-1.4 (Game Interface) | ✅ E2E gameplay flow | Complete |
| 2.1-2.5 (Device Pairing) | ✅ Room management | Complete |
| 3.1-3.6 (Motion Control) | ✅ Sensor processing | Complete |
| 4.1-4.8 (Calibration) | ✅ Calibration workflow | Complete |
| 5.1-5.7 (Game Mechanics) | ✅ Game physics | Complete |
| 6.1-6.4 (Communication) | ✅ WebSocket integration | Complete |
| 7.1-7.5 (Compatibility) | ✅ Cross-device testing | Complete |
| 8.1-8.5 (User Experience) | ✅ Integration tests | Complete |
| 9.1-9.4 (Deployment) | ✅ Configuration tests | Complete |

## Mock Implementations

The test suite includes comprehensive mocks for:

- **WebSocket connections** with realistic behavior
- **Device motion sensors** with configurable responses
- **Canvas rendering** for game graphics testing
- **Audio context** for sound effect validation
- **Local storage** for settings persistence
- **Performance timing** for optimization testing

## Continuous Integration

Tests are designed to run reliably in CI environments:
- No external dependencies
- Deterministic timing with fake timers
- Comprehensive error handling
- Performance benchmarks with reasonable thresholds

## Test Data and Scenarios

The test suite includes realistic test data for:
- Various device orientations and motion patterns
- Different user physical capabilities and ranges
- Network conditions and connection scenarios
- Error conditions and edge cases
- Performance stress scenarios

This ensures the game works reliably across diverse real-world conditions.