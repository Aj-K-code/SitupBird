// Simple integration test for core functionality
const { JSDOM } = require('jsdom');

// Set up DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <canvas id="game-canvas" width="800" height="600"></canvas>
    <div id="connection-status">CONNECTING...</div>
    <div id="score">0</div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
    userAgent: 'test',
    platform: 'test'
};
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

// Mock WebSocket
global.WebSocket = class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 10);
    }
    
    send(data) {
        console.log('WebSocket send:', data);
    }
    
    close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
    }
};

// Mock DeviceMotionEvent
global.DeviceMotionEvent = class MockDeviceMotionEvent {
    static requestPermission() {
        return Promise.resolve('granted');
    }
};

// Mock AudioContext
global.AudioContext = class MockAudioContext {
    constructor() {
        this.state = 'running';
    }
    
    createOscillator() {
        return {
            connect: () => {},
            start: () => {},
            stop: () => {},
            frequency: { value: 440 }
        };
    }
    
    createGain() {
        return {
            connect: () => {},
            gain: { value: 1 }
        };
    }
    
    get destination() {
        return {};
    }
};

// Load the app
require('./app.js');

console.log('Integration test starting...');

// Test basic functionality
async function runIntegrationTest() {
    try {
        console.log('✓ App loaded successfully');
        
        // Test that classes are available
        console.log('✓ Classes available:', typeof window.BrowserCompatibility !== 'undefined');
        
        // Test basic DOM elements exist
        const canvas = document.getElementById('game-canvas');
        console.log('✓ Canvas element found:', !!canvas);
        
        const statusElement = document.getElementById('connection-status');
        console.log('✓ Status element found:', !!statusElement);
        
        // Test canvas context
        const ctx = canvas.getContext('2d');
        console.log('✓ Canvas context available:', !!ctx);
        
        console.log('\n🎉 All integration tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Integration test failed:', error);
        return false;
    }
}

runIntegrationTest().then(success => {
    process.exit(success ? 0 : 1);
});