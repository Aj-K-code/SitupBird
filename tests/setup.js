// Test setup file for Situp Bird Game
import { vi } from 'vitest';

// Mock WebSocket for testing
global.WebSocket = vi.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null
}));

// Mock DeviceMotionEvent for sensor testing
global.DeviceMotionEvent = {
  requestPermission: vi.fn().mockResolvedValue('granted')
};

// Mock navigator for mobile device simulation
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// Mock canvas context for game rendering tests
const mockContext = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 100 })
};

global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);

// Mock AudioContext for sound testing
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 0 }
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { value: 0 }
  }),
  destination: {},
  currentTime: 0
}));

// Mock window.location for URL testing
delete window.location;
window.location = {
  protocol: 'https:',
  hostname: 'localhost',
  port: '3000',
  href: 'https://localhost:3000'
};

// Mock performance.now for timing tests
global.performance = {
  now: vi.fn(() => Date.now())
};

// Setup DOM elements that tests might need
beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});