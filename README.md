# Situp Bird - Motion-Controlled Fitness Gaming

A web-based fitness game that transforms the classic Flappy Bird experience into a situp workout. Players use their phone's motion sensors to control the bird by performing situp motions, creating an engaging fitness gaming experience.

## 🎮 How to Play

1. **Game Device**: Open the game URL on any device (computer, tablet, TV)
2. **Controller Device**: Open the same URL on a mobile phone
3. **Connect**: Use the 4-digit room code to pair devices
4. **Calibrate**: Follow the motion calibration instructions
5. **Play**: Perform situp motions to make the bird flap and navigate through pipes!

## 🌟 Features

### Game Features
- Motion-controlled gameplay using phone accelerometer
- Personalized calibration system for different fitness levels
- Real-time cross-device communication
- Retro pixel art aesthetics with smooth animations
- Audio feedback and sound effects
- Progressive difficulty and scoring system

### Technical Features
- No app installation required - runs in web browsers
- WebSocket-based real-time communication
- Automatic device pairing with simple room codes
- Cross-platform compatibility (iOS, Android, Desktop)
- Responsive design for various screen sizes
- Browser compatibility detection and graceful fallbacks

### Accessibility Features
- Adjustable motion sensitivity
- Visual and audio feedback
- Large touch targets for mobile devices
- Clear error messages and instructions
- Support for various device orientations

## Features

- Room-based device pairing with 4-digit codes
- Real-time message routing between paired devices
- Automatic room cleanup and memory management
- Environment-based port configuration for deployment
- Graceful connection handling and error management

## 🚀 Quick Start

### For Players
- **Live Demo**: [Play Situp Bird](https://yourusername.github.io/situp-bird-game) *(Update with your URL)*
- **Requirements**: Modern web browser + mobile device with motion sensors

### For Developers

#### Local Development
```bash
# Clone the repository
git clone <your-repository-url>
cd situp-bird-game

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

#### Production Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

**Quick Deploy:**
1. **Backend**: Deploy to [Render](https://render.com) (free tier available)
2. **Frontend**: Deploy to GitHub Pages
3. **Configure**: Update WebSocket URL in `app.js`

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Backend**: Node.js, WebSocket (ws library)
- **Sensors**: Generic Sensor API (DeviceMotionEvent)
- **Deployment**: Render (backend) + GitHub Pages (frontend)
- **Testing**: Vitest with comprehensive test suite

## 📱 Device Compatibility

### Supported Browsers
- **Chrome**: Full support (recommended)
- **Firefox**: Full support  
- **Safari**: Full support (iOS 13+)
- **Edge**: Full support

### Motion Sensor Requirements
- **iOS**: iPhone/iPad with iOS 13+ (requires permission)
- **Android**: Most modern Android devices
- **Desktop**: No motion sensors (use as game display only)

## 🎯 Game Mechanics

### Motion Detection
- **Down State**: Phone tilted back (lying down position)
- **Flap Trigger**: Quick motion from down to up (situp completion)
- **Calibration**: Personalized to your motion range and device orientation
- **Sensitivity**: Adjustable thresholds for different fitness levels

### Scoring System
- **Points**: Earned by successfully passing through pipe gaps
- **Difficulty**: Pipes spawn at intervals based on your calibrated motion range
- **Challenge**: Gap positions adapt to your movement patterns

## 🔧 Configuration

### Motion Sensitivity (app.js)
```javascript
// Adjust these values for different sensitivity levels
const downThreshold = 0.25; // Lower = more sensitive down detection
const upThreshold = 0.75;   // Higher = more sensitive up detection  
const motionThreshold = 0.2; // Lower = more responsive flap detection
```

### Game Balance (app.js)
```javascript
this.bird = {
    gravity: 0.4,        // Higher = falls faster
    flapStrength: -4.5,  // More negative = stronger flap
    maxVelocity: 10      // Higher = faster movement
};

this.pipeGap = 220;      // Higher = easier gaps
this.pipeSpeed = 1.8;    // Higher = faster pipes
```

## 📚 Documentation

- **[Setup Guide](SETUP_GUIDE.md)**: Complete setup and configuration instructions
- **[Deployment Guide](DEPLOYMENT.md)**: Production deployment instructions  
- **[Production Checklist](PRODUCTION_CHECKLIST.md)**: Pre-deployment verification

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npx vitest tests/unit --run      # Unit tests
npx vitest tests/integration --run # Integration tests
npx vitest tests/e2e --run      # End-to-end tests

# Verify integration
node verify-integration.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the classic Flappy Bird game
- Built for fitness enthusiasts and gamers
- Designed for accessibility and cross-platform compatibility

---

**Ready to turn your workout into a game? Start playing Situp Bird today!** 🏃‍♂️🎮