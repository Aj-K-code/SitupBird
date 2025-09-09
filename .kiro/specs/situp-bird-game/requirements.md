# Requirements Document

## Introduction

Situp Bird is a web-based motion-controlled game that transforms the classic Flappy Bird experience into a fitness challenge. The system consists of two main components: a lightweight signaling server for device pairing and real-time communication, and a unified frontend application that can function as either the game display or motion controller. Players use their phone's accelerometer to control the bird by performing situp motions, creating an engaging fitness gaming experience that requires no app installations or complex network configuration.

## Requirements

### Requirement 1

**User Story:** As a player, I want to start a game session on any web-capable device, so that I can play without installing native applications.

#### Acceptance Criteria

1. WHEN a user visits the game URL THEN the system SHALL display a selection screen with "START GAME" and "USE AS CONTROLLER" options
2. WHEN a user clicks "START GAME" THEN the system SHALL create a new game session with a unique 4-digit room code
3. WHEN a game session is created THEN the system SHALL display the game canvas with the room code prominently shown
4. WHEN the game is waiting for a controller THEN the system SHALL display "CONNECTING..." status

### Requirement 2

**User Story:** As a player, I want to connect my phone as a motion controller using a simple code, so that I can control the game without complex network setup.

#### Acceptance Criteria

1. WHEN a user selects "USE AS CONTROLLER" THEN the system SHALL display a code input interface
2. WHEN a user enters a valid 4-digit code THEN the system SHALL attempt to join the corresponding game room
3. WHEN the controller successfully connects THEN both devices SHALL display "CONNECTED!" status
4. WHEN an invalid code is entered THEN the system SHALL display an appropriate error message
5. WHEN a room is full or doesn't exist THEN the system SHALL display "Room not found or is full" error

### Requirement 3

**User Story:** As a player, I want to control the bird using situp motions detected by my phone, so that I can play the game as a fitness activity.

#### Acceptance Criteria

1. WHEN the controller connects THEN the system SHALL request permission to access device motion sensors
2. WHEN permission is granted THEN the system SHALL activate the accelerometer at 60Hz frequency
3. WHEN the phone's Z-axis acceleration drops below the calibrated down threshold THEN the system SHALL register the down state
4. WHEN the Z-axis acceleration rises above the calibrated up threshold while in down state THEN the system SHALL trigger a bird flap action
5. WHEN a flap is triggered THEN the system SHALL send sensor data to the game in real-time
6. WHEN sensor access is denied or unavailable THEN the system SHALL display an appropriate error message

### Requirement 4

**User Story:** As a player, I want to calibrate my motion range before playing, so that the game adapts to my sitting position and movement capabilities.

#### Acceptance Criteria

1. WHEN "START GAME" is selected THEN the system SHALL display a calibration screen before the game begins
2. WHEN calibration starts THEN the system SHALL instruct the user to perform their full situp range (down to up position)
3. WHEN the user performs calibration motions THEN the system SHALL record the minimum and maximum Z-axis values
4. WHEN calibration is complete THEN the system SHALL display the detected range and allow manual adjustment
5. WHEN the user confirms calibration THEN the system SHALL use these values to set pipe gap positioning
6. WHEN the user is at maximum situp position THEN pipe gaps SHALL appear at their highest point
7. WHEN the user is at minimum situp position THEN pipe gaps SHALL appear at their lowest point
8. WHEN calibration values are set THEN the system SHALL proceed to create the game room

### Requirement 5

**User Story:** As a player, I want to play a Flappy Bird-style game with responsive controls, so that I have an engaging gaming experience.

#### Acceptance Criteria

1. WHEN the game starts THEN the system SHALL display a bird character at the starting position
2. WHEN a flap command is received THEN the bird SHALL move upward with appropriate velocity
3. WHEN no flap command is active THEN the bird SHALL fall due to gravity simulation
4. WHEN the game is active THEN pipes SHALL spawn with gap positions based on calibrated motion range
5. WHEN the bird collides with pipes or ground THEN the game SHALL end and display "GAME OVER"
6. WHEN the bird successfully passes through a pipe THEN the score SHALL increment by one
7. WHEN score changes THEN the system SHALL play appropriate sound effects

### Requirement 6

**User Story:** As a player, I want real-time communication between my controller and game devices, so that my motions are immediately reflected in the game.

#### Acceptance Criteria

1. WHEN devices connect THEN the system SHALL establish WebSocket connections through the signaling server
2. WHEN sensor data is generated THEN the system SHALL transmit it with minimal latency (target <100ms)
3. WHEN the controller disconnects THEN the game SHALL display "CONTROLLER DC" and pause/end the game
4. WHEN the game disconnects THEN the controller SHALL display "Disconnected" status
5. WHEN connection is lost THEN both devices SHALL handle reconnection gracefully

### Requirement 7

**User Story:** As a player, I want the game to work on any modern web browser and device combination, so that I have maximum flexibility in how I play.

#### Acceptance Criteria

1. WHEN accessed on mobile devices THEN the system SHALL be responsive and touch-friendly
2. WHEN accessed on desktop browsers THEN the system SHALL scale appropriately to screen size
3. WHEN using different device combinations THEN the system SHALL maintain consistent functionality
4. WHEN the browser supports Generic Sensor API THEN motion controls SHALL be available
5. WHEN the browser lacks sensor support THEN the system SHALL display appropriate fallback messaging

### Requirement 8

**User Story:** As a player, I want an engaging visual and audio experience, so that the game feels polished and fun to play.

#### Acceptance Criteria

1. WHEN the game loads THEN the system SHALL display retro-styled graphics with pixel art aesthetics
2. WHEN game events occur THEN the system SHALL play appropriate sound effects (flap, score, collision)
3. WHEN the bird flaps THEN the system SHALL provide visual feedback with smooth animations
4. WHEN displaying text THEN the system SHALL use a retro gaming font (Press Start 2P)
5. WHEN showing the title screen THEN the system SHALL include animated elements and visual polish

### Requirement 9

**User Story:** As a developer, I want the system to be deployable on free hosting platforms, so that it's accessible without ongoing costs.

#### Acceptance Criteria

1. WHEN deploying the backend THEN the system SHALL work on Render's free tier
2. WHEN deploying the frontend THEN the system SHALL work on GitHub Pages
3. WHEN the server starts THEN it SHALL use environment-provided ports or default to 8080
4. WHEN deployed THEN the system SHALL handle WebSocket connections over WSS (secure WebSockets)
5. WHEN rooms are created THEN the server SHALL manage memory efficiently for the free tier constraints