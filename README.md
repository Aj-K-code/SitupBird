# Situp Bird Signaling Server

A lightweight WebSocket signaling server for the Situp Bird game that enables real-time communication between game display and controller devices.

## Features

- Room-based device pairing with 4-digit codes
- Real-time message routing between paired devices
- Automatic room cleanup and memory management
- Environment-based port configuration for deployment
- Graceful connection handling and error management

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The server will start on port 8080 by default, or use the PORT environment variable if set.

## Deployment

### Render Deployment

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Render will automatically set the PORT environment variable

### Environment Variables

- `PORT`: Server port (defaults to 8080)

## API Messages

### Client to Server

- `CREATE_ROOM`: Create a new game room
- `JOIN_ROOM`: Join an existing room with code
- `SENSOR_DATA`: Route sensor data to paired device
- `CALIBRATION_DATA`: Route calibration data to paired device

### Server to Client

- `ROOM_CREATED`: Room creation success with code
- `CONNECTION_SUCCESS`: Successfully joined room
- `ROOM_FULL`: Both devices connected
- `PARTNER_DISCONNECTED`: Other device disconnected
- `ERROR`: Error message with details

## Room Management

- Rooms are automatically created with unique 4-digit codes
- Maximum 2 participants per room
- Rooms are cleaned up after 1 hour of inactivity
- Automatic participant removal on disconnection