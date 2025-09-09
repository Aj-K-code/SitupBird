# Situp Bird - Complete Setup Guide

## Quick Start

### For Players
1. **Game Device**: Visit the game URL on any device with a web browser
2. **Controller Device**: Visit the same URL on a mobile device with motion sensors
3. **Connect**: Use the 4-digit room code to pair devices
4. **Calibrate**: Follow the motion calibration instructions
5. **Play**: Perform situp motions to control the bird!

### For Developers
1. **Clone**: `git clone <repository-url>`
2. **Install**: `npm install`
3. **Develop**: `npm run dev` (starts local server on port 8080)
4. **Test**: `npm test`
5. **Deploy**: Follow deployment instructions below

## Detailed Setup Instructions

### Local Development

#### Prerequisites
- Node.js 16+ and npm 8+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Mobile device with motion sensors for testing

#### Setup Steps
1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd situp-bird-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Game: `http://localhost:8080`
   - Health check: `http://localhost:8080/health`

5. **Test with two devices**
   - Open the game URL on your computer (game display)
   - Open the same URL on your phone (controller)
   - Use the room code to connect devices

### Production Deployment

#### Backend (Render)
1. **Create Render account** at [render.com](https://render.com)

2. **Connect your repository**
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

3. **Configure the service**
   - **Name**: `situp-bird-server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade as needed)

4. **Set environment variables**
   - `NODE_ENV`: `production`
   - `PORT`: (automatically set by Render)

5. **Deploy**
   - Click "Create Web Service"
   - Note your deployment URL (e.g., `https://situp-bird-server.onrender.com`)

#### Frontend (GitHub Pages)
1. **Update WebSocket URL**
   - Edit `app.js`
   - Find the `renderUrl` variable
   - Replace with your actual Render URL:
   ```javascript
   const renderUrl = 'your-app-name.onrender.com';
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` (or create `gh-pages` branch)

3. **Access your game**
   - Frontend: `https://yourusername.github.io/situp-bird-game`
   - Backend: `https://your-app-name.onrender.com`

### Configuration Options

#### Motion Sensitivity
Adjust in `app.js` around line 910:
```javascript
// Fine-tune these values for different sensitivity levels
const downThreshold = 0.25 + (threshold * 0.05); // Lower = more sensitive
const upThreshold = 0.75 - (threshold * 0.05);   // Higher = more sensitive  
const motionThreshold = 0.2; // Lower = more responsive
```

#### Game Balance
Adjust in `app.js` GameEngine constructor:
```javascript
this.bird = {
    gravity: 0.4,        // Higher = falls faster
    flapStrength: -4.5,  // More negative = stronger flap
    maxVelocity: 10      // Higher = faster movement
};

this.pipeSpeed = 2;      // Higher = faster pipes
this.pipeGap = 200;      // Higher = easier gaps
```

#### Server Settings
Adjust in `config.js`:
```javascript
module.exports = {
    roomMaxAge: 60 * 60 * 1000,     // 1 hour room timeout
    roomCleanupInterval: 5 * 60 * 1000, // 5 minute cleanup
    corsOrigin: ['*'],               // Allowed origins
    enableStats: true,               // Performance monitoring
    statsInterval: 60 * 1000         // 1 minute stats logging
};
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npx vitest tests/unit --run

# Integration tests only  
npx vitest tests/integration --run

# End-to-end tests only
npx vitest tests/e2e --run
```

### Manual Testing Checklist
- [ ] Room creation and joining
- [ ] Motion sensor calibration
- [ ] Real-time motion detection
- [ ] Game physics and scoring
- [ ] Audio feedback
- [ ] Error handling and reconnection
- [ ] Cross-device compatibility
- [ ] Performance under load

## Troubleshooting

### Common Issues

#### "Cannot connect to server"
- **Local**: Ensure server is running on port 8080
- **Production**: Check Render service status
- **Mixed content**: Ensure HTTPS/WSS for production

#### "Motion sensors not working"
- **Permissions**: Enable motion sensors in browser settings
- **Device**: Use a mobile device with accelerometer
- **Browser**: Try Chrome or Safari on mobile

#### "Room not found"
- **Code**: Verify 4-digit room code is correct
- **Timeout**: Rooms expire after 1 hour of inactivity
- **Server**: Check if server is running

#### "Poor motion detection"
- **Calibration**: Recalibrate motion range
- **Position**: Ensure phone is held firmly
- **Range**: Perform full situp motion during calibration

### Performance Optimization

#### For Free Tier Hosting
- Render free tier sleeps after 15 minutes
- First connection may take 30+ seconds
- Consider upgrading for production use

#### For High Traffic
- Enable CDN for frontend assets
- Use paid Render plan for better performance
- Implement rate limiting
- Add database for persistent rooms

### Browser Compatibility

#### Supported Browsers
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 13+)
- **Edge**: Full support

#### Required Features
- WebSocket connections
- Canvas 2D rendering
- Device Motion API (mobile only)
- Web Audio API
- ES6 features

## Security Considerations

### Production Checklist
- [ ] HTTPS/WSS connections only
- [ ] CORS properly configured
- [ ] Input validation enabled
- [ ] Error messages don't expose internals
- [ ] Rate limiting implemented (optional)
- [ ] Dependencies updated regularly

### Privacy
- No personal data is collected
- Room codes are temporary (1 hour max)
- No persistent storage of user data
- Motion data is not logged or stored

## Support and Contributing

### Getting Help
1. Check this setup guide
2. Review troubleshooting section
3. Check GitHub issues
4. Create new issue with details

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test on multiple devices
- Consider accessibility

## License

This project is licensed under the MIT License. See LICENSE file for details.