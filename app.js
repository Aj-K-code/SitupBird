// Browser Compatibility Detection
class BrowserCompatibility {
    static checkSupport() {
        const support = {
            webSocket: !!window.WebSocket,
            deviceMotion: !!window.DeviceMotionEvent,
            canvas: !!document.createElement('canvas').getContext,
            webAudio: !!(window.AudioContext || window.webkitAudioContext),
            localStorage: !!window.localStorage,
            es6: (function() {
                try {
                    new Function("(a = 0) => a");
                    return true;
                } catch (err) {
                    return false;
                }
            })(),
            touchEvents: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            pointerEvents: !!window.PointerEvent,
            orientation: !!window.DeviceOrientationEvent,
            fullscreen: !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled),
            vibration: !!navigator.vibrate,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            isAndroid: /Android/.test(navigator.userAgent),
            isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
            isChrome: /Chrome/.test(navigator.userAgent),
            isFirefox: /Firefox/.test(navigator.userAgent),
            isEdge: /Edge/.test(navigator.userAgent)
        };
        
        return support;
    }
    
    static getUnsupportedFeatures() {
        const support = this.checkSupport();
        const unsupported = [];
        
        if (!support.webSocket) unsupported.push('WebSocket connections');
        if (!support.deviceMotion) unsupported.push('Motion sensors');
        if (!support.canvas) unsupported.push('Canvas graphics');
        if (!support.webAudio) unsupported.push('Audio playback');
        if (!support.es6) unsupported.push('Modern JavaScript features');
        
        return unsupported;
    }
    
    static getCompatibilityMessage() {
        const unsupported = this.getUnsupportedFeatures();
        const support = this.checkSupport();
        
        if (unsupported.length === 0) {
            return { compatible: true, message: 'Your browser supports all required features!' };
        }
        
        let message = 'Some features may not work properly:\n\n';
        message += unsupported.map(feature => `• ${feature}`).join('\n');
        message += '\n\nFor the best experience, please use:\n';
        
        if (support.isMobile) {
            message += '• Chrome for Android (latest version)\n';
            message += '• Safari for iOS (iOS 13+)\n';
            message += '• Firefox Mobile (latest version)';
        } else {
            message += '• Chrome (latest version)\n';
            message += '• Firefox (latest version)\n';
            message += '• Safari (latest version)\n';
            message += '• Edge (latest version)';
        }
        
        return { compatible: false, message: message, unsupported: unsupported };
    }
    
    static showCompatibilityWarning() {
        const compatibility = this.getCompatibilityMessage();
        
        if (!compatibility.compatible) {
            console.warn('Browser compatibility issues detected:', compatibility.unsupported);
            
            // Show compatibility banner instead of modal for better UX
            const banner = document.getElementById('compatibility-banner');
            const dismissBtn = document.getElementById('compatibility-dismiss');
            
            if (banner) {
                banner.classList.remove('hidden');
                
                // Set up dismiss functionality
                if (dismissBtn) {
                    dismissBtn.addEventListener('click', () => {
                        banner.classList.add('hidden');
                        localStorage.setItem('compatibility-warning-dismissed', 'true');
                    });
                }
                
                // Auto-dismiss after 10 seconds
                setTimeout(() => {
                    if (!banner.classList.contains('hidden')) {
                        banner.classList.add('hidden');
                    }
                }, 10000);
            }
        }
        
        return compatibility;
    }
    
    static shouldShowCompatibilityWarning() {
        // Don't show if user has already dismissed it
        if (localStorage.getItem('compatibility-warning-dismissed') === 'true') {
            return false;
        }
        
        const unsupported = this.getUnsupportedFeatures();
        return unsupported.length > 0;
    }
}

// WebSocket Client Base Class
class WebSocketClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl || this.getServerUrl();
        this.socket = null;
        this.connectionStatus = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageHandlers = new Map();
        this.onConnectionChange = null;
        this.onError = null;
        
        // Enhanced error tracking
        this.lastError = null;
        this.errorHistory = [];
        this.maxErrorHistory = 10;
        this.connectionTimeouts = [];
        
        // Check WebSocket support
        if (!window.WebSocket) {
            throw new Error('WebSocket is not supported in this browser');
        }
    }

    getServerUrl() {
        // Determine WebSocket server URL based on environment
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        // For local development - always use port 8080 for WebSocket server
        if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
            return `${protocol}//${host}:8080`;
        }
        
        // For GitHub Pages deployment - connect to Render backend
        if (host.includes('github.io') || host.includes('pages.dev')) {
            // Replace with your actual Render deployment URL
            const renderUrl = 'situpbirdserver.onrender.com'; // Your actual Render URL
            return `wss://${renderUrl}`;
        }
        
        // For production deployment on same domain (Render full-stack)
        const port = window.location.port ? `:${window.location.port}` : '';
        return `${protocol}//${host}${port}`;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.serverUrl);
                
                // Set connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.socket.readyState === WebSocket.CONNECTING) {
                        this.socket.close();
                        const error = new Error('Connection timeout - Unable to connect to server');
                        this.recordError(error, 'CONNECTION_TIMEOUT');
                        reject(error);
                    }
                }, 10000); // 10 second timeout
                
                this.connectionTimeouts.push(connectionTimeout);

                this.socket.onopen = () => {
                    this.clearConnectionTimeouts();
                    console.log('WebSocket connected to:', this.serverUrl);
                    this.connectionStatus = 'connected';
                    this.reconnectAttempts = 0;
                    this.lastError = null; // Clear last error on successful connection
                    this.notifyConnectionChange();
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                        this.recordError(error, 'MESSAGE_PARSE_ERROR');
                        this.handleError('Failed to parse server message', 'MESSAGE_PARSE_ERROR');
                    }
                };

                this.socket.onclose = (event) => {
                    this.clearConnectionTimeouts();
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    
                    const wasConnected = this.connectionStatus === 'connected';
                    this.connectionStatus = 'disconnected';
                    this.notifyConnectionChange();
                    
                    // Handle different close codes
                    if (event.code === 1000) {
                        // Clean close - no reconnection needed
                        console.log('Clean disconnect');
                    } else if (event.code === 1006) {
                        // Abnormal closure
                        const error = new Error('Connection lost unexpectedly');
                        this.recordError(error, 'ABNORMAL_CLOSURE');
                        if (wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                            this.attemptReconnect();
                        } else if (!wasConnected) {
                            reject(error);
                        }
                    } else {
                        // Other error codes
                        const error = new Error(`Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`);
                        this.recordError(error, 'CONNECTION_CLOSED');
                        if (wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                            this.attemptReconnect();
                        } else if (!wasConnected) {
                            reject(error);
                        }
                    }
                };

                this.socket.onerror = (error) => {
                    this.clearConnectionTimeouts();
                    console.error('WebSocket error:', error);
                    this.connectionStatus = 'error';
                    this.recordError(error, 'WEBSOCKET_ERROR');
                    this.notifyConnectionChange();
                    
                    // Provide more specific error message
                    const errorMessage = this.getConnectionErrorMessage();
                    this.handleError(errorMessage, 'WEBSOCKET_ERROR');
                    reject(new Error(errorMessage));
                };

            } catch (error) {
                this.recordError(error, 'CONNECTION_SETUP_ERROR');
                reject(error);
            }
        });
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Cap at 30 seconds
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        this.connectionStatus = 'reconnecting';
        this.notifyConnectionChange();
        
        setTimeout(() => {
            this.connect().catch((error) => {
                console.error('Reconnection attempt failed:', error);
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('Max reconnection attempts reached');
                    this.connectionStatus = 'failed';
                    this.handleError('Unable to reconnect to server. Please check your connection and try again.', 'MAX_RECONNECT_ATTEMPTS');
                    this.notifyConnectionChange();
                } else {
                    // Continue trying to reconnect
                    this.attemptReconnect();
                }
            });
        }, delay);
    }

    sendMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
        }
        console.warn('Cannot send message: WebSocket not connected');
        return false;
    }

    handleMessage(message) {
        console.log('Received message:', message.type);
        
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            handler(message);
        } else {
            console.warn('No handler for message type:', message.type);
        }
    }

    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    notifyConnectionChange() {
        if (this.onConnectionChange) {
            this.onConnectionChange(this.connectionStatus);
        }
    }

    disconnect() {
        this.clearConnectionTimeouts();
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.connectionStatus = 'disconnected';
        this.notifyConnectionChange();
    }
    
    // Enhanced error handling methods
    recordError(error, errorType) {
        const errorRecord = {
            error: error,
            type: errorType,
            timestamp: Date.now(),
            reconnectAttempt: this.reconnectAttempts
        };
        
        this.lastError = errorRecord;
        this.errorHistory.push(errorRecord);
        
        // Keep error history manageable
        if (this.errorHistory.length > this.maxErrorHistory) {
            this.errorHistory.shift();
        }
    }
    
    handleError(message, errorType) {
        console.error(`WebSocket Error [${errorType}]:`, message);
        
        if (this.onError) {
            this.onError({
                message: message,
                type: errorType,
                canRetry: this.canRetry(errorType),
                reconnectAttempts: this.reconnectAttempts,
                maxReconnectAttempts: this.maxReconnectAttempts
            });
        }
    }
    
    canRetry(errorType) {
        const nonRetryableErrors = ['WEBSOCKET_NOT_SUPPORTED', 'INVALID_URL'];
        return !nonRetryableErrors.includes(errorType) && this.reconnectAttempts < this.maxReconnectAttempts;
    }
    
    getConnectionErrorMessage() {
        // Provide user-friendly error messages based on common scenarios
        if (this.serverUrl.includes('localhost') || this.serverUrl.includes('127.0.0.1')) {
            return 'Cannot connect to local server. Make sure the server is running on port 8080.';
        } else if (this.serverUrl.includes('ws://') && window.location.protocol === 'https:') {
            return 'Cannot connect to insecure WebSocket from secure page. Server must support WSS.';
        } else if (this.serverUrl.includes('onrender.com')) {
            return 'Cannot connect to server. The server may be starting up (this can take up to 30 seconds on free hosting). Please wait and try again.';
        } else {
            return 'Cannot connect to server. Please check your internet connection and try again.';
        }
    }
    
    clearConnectionTimeouts() {
        this.connectionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.connectionTimeouts = [];
    }
    
    getErrorHistory() {
        return [...this.errorHistory];
    }
    
    getLastError() {
        return this.lastError;
    }
}

// Game WebSocket Client
class GameClient extends WebSocketClient {
    constructor(serverUrl) {
        super(serverUrl);
        this.roomCode = null;
        this.calibrationData = null;
        this.onRoomCreated = null;
        this.onControllerConnected = null;
        this.onControllerDisconnected = null;
        this.onSensorData = null;
        this.onCalibrationReceived = null;
        
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        this.onMessage('ROOM_CREATED', (message) => {
            this.roomCode = message.code;
            console.log('Room created:', this.roomCode);
            if (this.onRoomCreated) {
                this.onRoomCreated(this.roomCode);
            }
        });

        this.onMessage('ROOM_FULL', (message) => {
            console.log('Controller connected to room');
            if (this.onControllerConnected) {
                this.onControllerConnected();
            }
        });

        this.onMessage('PARTNER_DISCONNECTED', (message) => {
            console.log('Controller disconnected');
            if (this.onControllerDisconnected) {
                this.onControllerDisconnected();
            }
        });

        this.onMessage('SENSOR_DATA', (message) => {
            if (this.onSensorData) {
                this.onSensorData(message.payload);
            }
        });

        this.onMessage('CALIBRATION_DATA', (message) => {
            this.calibrationData = message.payload;
            console.log('Received calibration data:', this.calibrationData);
            if (this.onCalibrationReceived) {
                this.onCalibrationReceived(this.calibrationData);
            }
        });

        this.onMessage('ERROR', (message) => {
            console.error('Server error:', message.message);
            this.handleServerError(message);
        });
    }
    
    handleServerError(message) {
        const errorType = this.getErrorType(message.message);
        const userFriendlyMessage = this.getUserFriendlyErrorMessage(message.message);
        
        if (this.onError) {
            this.onError({
                message: userFriendlyMessage,
                originalMessage: message.message,
                type: errorType,
                canRetry: this.canRetryServerError(errorType)
            });
        }
    }
    
    getErrorType(errorMessage) {
        if (errorMessage.includes('Room not found') || errorMessage.includes('is full')) {
            return 'ROOM_NOT_FOUND_OR_FULL';
        } else if (errorMessage.includes('Invalid room code')) {
            return 'INVALID_ROOM_CODE';
        } else if (errorMessage.includes('Failed to create room')) {
            return 'ROOM_CREATION_FAILED';
        }
        return 'UNKNOWN_SERVER_ERROR';
    }
    
    getUserFriendlyErrorMessage(errorMessage) {
        if (errorMessage.includes('Room not found') || errorMessage.includes('is full')) {
            return 'Room not found or is full. Please check the room code or create a new game.';
        } else if (errorMessage.includes('Invalid room code')) {
            return 'Invalid room code. Please enter a 4-digit code.';
        } else if (errorMessage.includes('Failed to create room')) {
            return 'Unable to create game room. Please try again.';
        }
        return 'Server error occurred. Please try again.';
    }
    
    canRetryServerError(errorType) {
        const retryableErrors = ['ROOM_CREATION_FAILED', 'UNKNOWN_SERVER_ERROR'];
        return retryableErrors.includes(errorType);
    }

    async createRoom() {
        try {
            await this.connect();
            this.sendMessage({ type: 'CREATE_ROOM' });
            return true;
        } catch (error) {
            console.error('Failed to create room:', error);
            return false;
        }
    }
}

// Controller WebSocket Client
class ControllerClient extends WebSocketClient {
    constructor(serverUrl) {
        super(serverUrl);
        this.roomCode = null;
        this.onConnectionSuccess = null;
        this.onGameDisconnected = null;
        this.onCalibrationReceived = null;
        
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        this.onMessage('CONNECTION_SUCCESS', (message) => {
            console.log('Successfully joined room');
            if (this.onConnectionSuccess) {
                this.onConnectionSuccess();
            }
        });

        this.onMessage('ROOM_FULL', (message) => {
            console.log('Room is now full, ready to play');
        });

        this.onMessage('PARTNER_DISCONNECTED', (message) => {
            console.log('Game disconnected');
            if (this.onGameDisconnected) {
                this.onGameDisconnected();
            }
        });

        this.onMessage('CALIBRATION_DATA', (message) => {
            console.log('Received calibration data from game:', message.payload);
            if (this.onCalibrationReceived) {
                this.onCalibrationReceived(message.payload);
            }
        });

        this.onMessage('ERROR', (message) => {
            console.error('Server error:', message.message);
            this.handleServerError(message);
        });
    }
    
    handleServerError(message) {
        const errorType = this.getErrorType(message.message);
        const userFriendlyMessage = this.getUserFriendlyErrorMessage(message.message);
        
        if (this.onError) {
            this.onError({
                message: userFriendlyMessage,
                originalMessage: message.message,
                type: errorType,
                canRetry: this.canRetryServerError(errorType)
            });
        }
    }
    
    getErrorType(errorMessage) {
        if (errorMessage.includes('Room not found') || errorMessage.includes('is full')) {
            return 'ROOM_NOT_FOUND_OR_FULL';
        } else if (errorMessage.includes('Invalid room code')) {
            return 'INVALID_ROOM_CODE';
        }
        return 'UNKNOWN_SERVER_ERROR';
    }
    
    getUserFriendlyErrorMessage(errorMessage) {
        if (errorMessage.includes('Room not found') || errorMessage.includes('is full')) {
            return 'Room not found or is full. Please check the room code and try again.';
        } else if (errorMessage.includes('Invalid room code')) {
            return 'Please enter a valid 4-digit room code.';
        }
        return 'Unable to join room. Please try again.';
    }
    
    canRetryServerError(errorType) {
        const retryableErrors = ['UNKNOWN_SERVER_ERROR'];
        return retryableErrors.includes(errorType);
    }

    async joinRoom(code) {
        try {
            await this.connect();
            this.roomCode = code;
            this.sendMessage({ 
                type: 'JOIN_ROOM', 
                code: code 
            });
            return true;
        } catch (error) {
            console.error('Failed to join room:', error);
            return false;
        }
    }

    sendSensorData(sensorData) {
        if (this.roomCode) {
            return this.sendMessage({
                type: 'SENSOR_DATA',
                code: this.roomCode,
                payload: sensorData
            });
        }
        return false;
    }

    sendCalibrationData(calibrationData) {
        if (this.roomCode) {
            return this.sendMessage({
                type: 'CALIBRATION_DATA',
                code: this.roomCode,
                payload: calibrationData
            });
        }
        return false;
    }
}

// Sensor Manager for Motion Detection and Calibration
class SensorManager {
    constructor() {
        this.sensor = null;
        this.isCalibrating = false;
        this.calibrationData = {
            minY: null,
            maxY: null,
            threshold: 0.5,
            smoothing: 0.3
        };
        this.currentY = 0;
        this.onSensorData = null;
        this.onCalibrationUpdate = null;
        this.onSensorError = null;
        this.sensorSupported = false;
        this.permissionGranted = false;
        this.lastPosition = 0.5;
        
        // Motion detection state
        this.isInDownState = false;
        this.lastFlapTime = 0;
        this.flapCooldown = 200; // Minimum time between flaps in ms
        this.sensorReadings = [];
        this.maxReadings = 5; // For smoothing
        
        // Real-time transmission
        this.lastTransmissionTime = 0;
        this.transmissionInterval = 16; // ~60Hz (1000ms / 60fps)
        this.isTransmitting = false;
        
        // Error handling
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 5;
        this.sensorActive = false;
        
        // Check for Generic Sensor API support
        this.checkSensorSupport();
    }

    checkSensorSupport() {
        const compatibility = BrowserCompatibility.checkSupport();
        
        // Enhanced sensor support detection
        this.sensorSupported = compatibility.deviceMotion;
        this.isIOS = compatibility.isIOS;
        this.isAndroid = compatibility.isAndroid;
        this.isMobile = compatibility.isMobile;
        this.requiresPermission = compatibility.isIOS && parseFloat(navigator.userAgent.match(/OS (\d+)_/)?.[1] || '0') >= 13;
        
        console.log('Sensor support check:', {
            deviceMotion: compatibility.deviceMotion,
            isIOS: this.isIOS,
            isAndroid: this.isAndroid,
            isMobile: this.isMobile,
            requiresPermission: this.requiresPermission,
            userAgent: compatibility.userAgent
        });
        
        // Provide specific guidance based on device/browser
        if (!this.sensorSupported) {
            let message = 'Motion sensors are not supported. ';
            if (!this.isMobile) {
                message += 'Please use a mobile device (phone or tablet) to control the game.';
            } else if (compatibility.isFirefox) {
                message += 'Firefox mobile may have limited sensor support. Try Chrome or Safari.';
            } else {
                message += 'Please update your browser to the latest version.';
            }
            
            this.handleSensorError({
                type: 'not_supported',
                message: 'Device motion not supported',
                userMessage: message,
                error: new Error('DeviceMotionEvent not available')
            });
        }
    }

    async requestPermissions() {
        try {
            // Handle iOS 13+ permission request for DeviceMotion
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                console.log('Requesting iOS DeviceMotion permission...');
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.permissionGranted = true;
                    return { success: true };
                } else {
                    const error = new Error('Motion sensor permission denied. Please enable motion sensors in your browser settings.');
                    this.handleSensorError({
                        type: 'permission_denied',
                        message: 'Motion sensor access denied by user',
                        userMessage: 'Please enable motion sensors in your browser settings and try again.',
                        error: error
                    });
                    return { success: false, error: error };
                }
            }
            
            // For Android and other platforms, assume permission is granted
            // The actual sensor availability will be tested when we try to use it
            this.permissionGranted = true;
            return { success: true };
            
        } catch (error) {
            console.error('Permission request failed:', error);
            
            // Provide specific error messages based on the error
            let userMessage = 'Unable to access motion sensors. ';
            if (error.name === 'NotAllowedError') {
                userMessage += 'Please enable motion sensors in your browser settings.';
            } else if (error.name === 'NotSupportedError') {
                userMessage += 'Motion sensors are not supported on this device.';
            } else {
                userMessage += 'Please make sure you\'re using a mobile device with motion sensors.';
            }
            
            this.handleSensorError({
                type: 'permission_error',
                message: 'Failed to request sensor permissions',
                userMessage: userMessage,
                error: error
            });
            
            return { success: false, error: error };
        }
    }

    async startSensorReading() {
        if (!this.permissionGranted) {
            const permissionResult = await this.requestPermissions();
            if (!permissionResult.success) {
                return permissionResult;
            }
        }

        // Just use DeviceMotion API directly - it's the most compatible
        console.log('Starting DeviceMotion API...');
        try {
            const result = await this.setupDeviceMotion();
            return { success: true, result: result };
        } catch (error) {
            return { success: false, error: error };
        }
    }
    
    setupDeviceMotion() {
        return new Promise((resolve, reject) => {
            console.log('Checking DeviceMotionEvent:', typeof window.DeviceMotionEvent);
            console.log('DeviceMotionEvent exists:', !!window.DeviceMotionEvent);
            console.log('Window object keys containing "device":', Object.keys(window).filter(k => k.toLowerCase().includes('device')));
            
            if (!window.DeviceMotionEvent) {
                const error = new Error('Motion sensors not supported on this device or browser');
                this.handleSensorError({
                    type: 'not_supported',
                    message: 'DeviceMotion API not available',
                    userMessage: 'Motion sensors are not supported on this device. Please use a mobile device with motion sensors.',
                    error: error
                });
                reject(error);
                return;
            }
            
            let hasReceivedData = false;
            let motionHandler = null;
            
            const timeout = setTimeout(() => {
                if (!hasReceivedData) {
                    if (motionHandler) {
                        window.removeEventListener('devicemotion', motionHandler);
                    }
                    const error = new Error('No motion data received - sensors may not be available');
                    this.handleSensorError({
                        type: 'no_data',
                        message: 'No sensor data received after timeout',
                        userMessage: 'No motion data detected. Please make sure you\'re on a mobile device with motion sensors enabled, and try moving the device.',
                        error: error
                    });
                    reject(error);
                }
            }, 5000); // 5 second timeout
            
            motionHandler = (event) => {
                const acceleration = event.accelerationIncludingGravity;
                console.log('Motion event received:', acceleration);
                
                if (acceleration && (acceleration.y !== null && acceleration.y !== undefined)) {
                    if (!hasReceivedData) {
                        hasReceivedData = true;
                        clearTimeout(timeout);
                        console.log('✅ DeviceMotion API working - received data:', acceleration.y);
                        resolve(true);
                    }
                    
                    this.currentY = acceleration.y;
                    this.processSensorData();
                } else {
                    console.log('Motion event received but no Y acceleration data');
                }
            };
            
            window.addEventListener('devicemotion', motionHandler);
            console.log('DeviceMotion event listener added, waiting for data...');
            
            // Also try to trigger a motion event by logging device info
            console.log('Device info:', {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                deviceMemory: navigator.deviceMemory,
                hardwareConcurrency: navigator.hardwareConcurrency
            });
        });
    }



    processSensorData() {
        try {
            // Reset consecutive errors on successful reading
            this.consecutiveErrors = 0;
            this.sensorActive = true;
            
            // Add current reading to smoothing buffer
            this.addSensorReading(this.currentY);
            
            // Update calibration data if calibrating
            if (this.isCalibrating) {
                if (this.calibrationData.minY === null || this.currentY < this.calibrationData.minY) {
                    this.calibrationData.minY = this.currentY;
                }
                if (this.calibrationData.maxY === null || this.currentY > this.calibrationData.maxY) {
                    this.calibrationData.maxY = this.currentY;
                }
                
                // Auto-complete calibration when we have enough range
                const range = this.calibrationData.maxY - this.calibrationData.minY;
                console.log('📏 Calibration range check:', { minY: this.calibrationData.minY, maxY: this.calibrationData.maxY, range });
                
                if (range > 1.0) { // Reduced minimum range for easier calibration
                    console.log('🎯 Auto-completing calibration with range:', range);
                    this.isCalibrating = false;
                    
                    // Send calibration data to game (laptop)
                    if (window.screenManager && window.screenManager.gameClient) {
                        window.screenManager.gameClient.sendMessage({
                            type: 'CALIBRATION_DATA',
                            code: window.screenManager.gameClient.roomCode,
                            payload: this.calibrationData
                        });
                    }
                    
                    // Update status
                    const sensorStatus = document.getElementById('sensor-status');
                    if (sensorStatus) {
                        sensorStatus.textContent = 'CALIBRATED & ACTIVE';
                    }
                    
                    console.log('✅ Calibration complete:', this.calibrationData);
                }
                
                if (this.onCalibrationUpdate) {
                    this.onCalibrationUpdate(this.currentY, this.calibrationData);
                }
            }

            // Process sensor data for game logic with real-time throttling
            const now = Date.now();
            if (now - this.lastTransmissionTime >= this.transmissionInterval) {
                const processedData = this.processMotionData();
                
                if (this.onSensorData) {
                    this.onSensorData(processedData);
                }
                
                this.lastTransmissionTime = now;
            }
            
        } catch (error) {
            this.handleSensorError(error);
        }
    }

    processMotionData() {
        const { minY, maxY, threshold, smoothing } = this.calibrationData;
        
        console.log('🔍 Calibration data check:', { minY, maxY, threshold, smoothing });
        console.log('🔍 Current Y:', this.currentY, 'Smoothed Y:', this.getSmoothedReading());
        
        if (minY === null || maxY === null) {
            console.log('❌ Calibration incomplete - minY or maxY is null');
            return {
                y: this.currentY,
                timestamp: Date.now(),
                processed: {
                    isDown: false,
                    shouldFlap: false,
                    gapPosition: 0.5,
                    normalizedPosition: 0.5,
                    motionIntensity: 0,
                    calibrated: false
                }
            };
        }

        // Use smoothed Y value for more stable motion detection
        const smoothedY = this.getSmoothedReading();
        
        // Normalize position to 0-1 range using smoothed value with proper clamping
        const range = maxY - minY;
        let normalizedPosition = 0.5; // Default middle position
        
        console.log('📊 Position calculation:', { smoothedY, minY, maxY, range });
        
        if (range > 0) {
            // Ensure proper clamping between 0 and 1
            const rawPosition = (smoothedY - minY) / range;
            normalizedPosition = Math.max(0, Math.min(1, rawPosition));
            console.log('📍 Normalized position:', { rawPosition, normalizedPosition });
        } else {
            console.log('⚠️ Invalid range for position calculation');
        }
        
        // Calculate motion intensity (rate of change)
        const motionIntensity = this.calculateMotionIntensity();
        
        // Enhanced situp motion detection with calibrated thresholds
        // Fine-tuned for better responsiveness and accuracy
        const downThreshold = 0.25 + (threshold * 0.05); // More sensitive down detection
        const upThreshold = 0.75 - (threshold * 0.05);   // More sensitive up detection  
        const motionThreshold = 0.2; // Lower threshold for better responsiveness
        
        const isCurrentlyDown = normalizedPosition < downThreshold;
        const isCurrentlyUp = normalizedPosition > upThreshold;
        
        // Enhanced flap detection with state tracking and cooldown
        let shouldFlap = false;
        const now = Date.now();
        
        // Track down state with motion intensity requirement
        if (isCurrentlyDown && motionIntensity > motionThreshold) {
            this.isInDownState = true;
        }
        
        // Detect flap: transition from down state to up position with sufficient motion
        if (this.isInDownState && isCurrentlyUp && motionIntensity > motionThreshold) {
            // Check cooldown to prevent multiple flaps from single motion
            if (now - this.lastFlapTime > this.flapCooldown) {
                shouldFlap = true;
                this.lastFlapTime = now;
                this.isInDownState = false; // Reset down state after successful flap
            }
        }
        
        // Reset down state if user moves to middle position without completing flap
        if (!isCurrentlyDown && !isCurrentlyUp) {
            // Only reset if we've been in a stable middle position
            if (Math.abs(normalizedPosition - 0.5) < 0.1) {
                this.isInDownState = false;
            }
        }

        return {
            y: this.currentY,
            smoothedY: smoothedY,
            timestamp: now,
            processed: {
                isDown: isCurrentlyDown,
                shouldFlap: shouldFlap,
                gapPosition: normalizedPosition,
                normalizedPosition: normalizedPosition,
                motionIntensity: motionIntensity,
                calibrated: true,
                downState: this.isInDownState,
                thresholds: {
                    down: downThreshold,
                    up: upThreshold,
                    motion: motionThreshold
                }
            }
        };
    }

    startCalibration() {
        this.isCalibrating = true;
        this.calibrationData.minY = null;
        this.calibrationData.maxY = null;
        console.log('Calibration started');
    }

    stopCalibration() {
        this.isCalibrating = false;
        console.log('Calibration stopped');
    }

    getCalibrationData() {
        return { ...this.calibrationData };
    }

    setCalibrationData(data) {
        this.calibrationData = { ...this.calibrationData, ...data };
    }

    addSensorReading(yValue) {
        // Add reading with timestamp for motion intensity calculation
        this.sensorReadings.push({
            y: yValue,
            timestamp: Date.now()
        });
        
        // Keep only recent readings for smoothing
        if (this.sensorReadings.length > this.maxReadings) {
            this.sensorReadings.shift();
        }
    }
    
    getSmoothedReading() {
        if (this.sensorReadings.length === 0) {
            return this.currentY;
        }
        
        // Simple moving average
        const sum = this.sensorReadings.reduce((acc, reading) => acc + reading.y, 0);
        return sum / this.sensorReadings.length;
    }
    
    calculateMotionIntensity() {
        if (this.sensorReadings.length < 2) {
            return 0;
        }
        
        // Calculate rate of change over recent readings
        const recent = this.sensorReadings.slice(-3); // Use last 3 readings
        let totalChange = 0;
        
        for (let i = 1; i < recent.length; i++) {
            const timeDiff = recent[i].timestamp - recent[i-1].timestamp;
            const valueDiff = Math.abs(recent[i].y - recent[i-1].y);
            
            if (timeDiff > 0) {
                totalChange += valueDiff / (timeDiff / 1000); // Change per second
            }
        }
        
        return totalChange / (recent.length - 1);
    }
    
    handleSensorError(errorInfo) {
        // Handle both old format (just error object) and new format (error info object)
        if (errorInfo.type) {
            // New enhanced format
            console.error(`Sensor Error [${errorInfo.type}]:`, errorInfo.message, errorInfo.error);
            
            if (this.onSensorError) {
                this.onSensorError({
                    type: errorInfo.type,
                    message: errorInfo.userMessage || errorInfo.message,
                    technicalMessage: errorInfo.message,
                    error: errorInfo.error,
                    canRetry: this.canRetrySensorError(errorInfo.type),
                    consecutiveErrors: this.consecutiveErrors
                });
            }
        } else {
            // Legacy format - treat as generic sensor error
            this.consecutiveErrors++;
            this.sensorActive = false;
            
            console.error('Sensor error:', errorInfo);
            
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                // Too many consecutive errors, notify application
                if (this.onSensorError) {
                    this.onSensorError({
                        type: 'consecutive_errors',
                        message: 'Multiple sensor errors detected. Motion detection may be unreliable.',
                        error: errorInfo,
                        canRetry: false,
                        consecutiveErrors: this.consecutiveErrors
                    });
                }
            } else if (this.consecutiveErrors === 1) {
                // First error, just log it
                if (this.onSensorError) {
                    this.onSensorError({
                        type: 'sensor_error',
                        message: 'Sensor reading error occurred.',
                        error: errorInfo,
                        canRetry: true,
                        consecutiveErrors: this.consecutiveErrors
                    });
                }
            }
        }
    }
    
    canRetrySensorError(errorType) {
        const nonRetryableErrors = ['not_supported', 'permission_denied'];
        return !nonRetryableErrors.includes(errorType);
    }
    
    getSensorStatus() {
        return {
            active: this.sensorActive,
            supported: this.sensorSupported,
            permissionGranted: this.permissionGranted,
            consecutiveErrors: this.consecutiveErrors,
            isTransmitting: this.isTransmitting,
            calibrated: this.calibrationData.minY !== null && this.calibrationData.maxY !== null
        };
    }
    
    startRealTimeTransmission() {
        this.isTransmitting = true;
        this.lastTransmissionTime = 0; // Reset to ensure immediate first transmission
    }
    
    stopRealTimeTransmission() {
        this.isTransmitting = false;
    }

    stopSensor() {
        if (this.sensor && this.sensor.stop) {
            this.sensor.stop();
            this.sensor = null;
        }
        
        // DeviceMotion events can't be stopped, but we can ignore them
        this.onSensorData = null;
        this.onCalibrationUpdate = null;
        this.onSensorError = null;
        
        // Reset state
        this.sensorActive = false;
        this.isTransmitting = false;
        this.sensorReadings = [];
        this.consecutiveErrors = 0;
    }
}

// Performance Monitor for Device Optimization
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastFPSCheck = 0;
        this.currentFPS = 60;
        this.targetFPS = 60;
        this.performanceLevel = 'high'; // high, medium, low
        this.adaptiveQuality = true;
        
        // Performance metrics
        this.frameTimeHistory = [];
        this.maxFrameTimeHistory = 60;
        this.lagThreshold = 16.67; // 60fps threshold in ms
        this.consecutiveLagFrames = 0;
        this.maxConsecutiveLag = 10;
        
        // Device capabilities
        this.deviceCapabilities = this.detectDeviceCapabilities();
        this.setInitialPerformanceLevel();
    }
    
    detectDeviceCapabilities() {
        const capabilities = {
            cores: navigator.hardwareConcurrency || 2,
            memory: navigator.deviceMemory || 2,
            connection: navigator.connection?.effectiveType || '4g',
            pixelRatio: window.devicePixelRatio || 1,
            screenSize: window.screen.width * window.screen.height,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isLowEnd: false
        };
        
        // Detect low-end devices
        capabilities.isLowEnd = (
            capabilities.cores <= 2 ||
            capabilities.memory <= 2 ||
            capabilities.connection === 'slow-2g' ||
            capabilities.connection === '2g' ||
            (capabilities.isMobile && capabilities.screenSize < 1000000)
        );
        
        console.log('Device capabilities detected:', capabilities);
        return capabilities;
    }
    
    setInitialPerformanceLevel() {
        if (this.deviceCapabilities.isLowEnd) {
            this.performanceLevel = 'low';
            this.targetFPS = 30;
        } else if (this.deviceCapabilities.cores <= 4 || this.deviceCapabilities.memory <= 4) {
            this.performanceLevel = 'medium';
            this.targetFPS = 45;
        } else {
            this.performanceLevel = 'high';
            this.targetFPS = 60;
        }
        
        console.log(`Initial performance level: ${this.performanceLevel} (target: ${this.targetFPS}fps)`);
    }
    
    measureFrame(deltaTime) {
        this.frameCount++;
        this.frameTimeHistory.push(deltaTime);
        
        if (this.frameTimeHistory.length > this.maxFrameTimeHistory) {
            this.frameTimeHistory.shift();
        }
        
        // Check for lag
        if (deltaTime > this.lagThreshold) {
            this.consecutiveLagFrames++;
        } else {
            this.consecutiveLagFrames = 0;
        }
        
        // Adaptive quality adjustment
        if (this.adaptiveQuality && this.consecutiveLagFrames > this.maxConsecutiveLag) {
            this.downgradePerformance();
            this.consecutiveLagFrames = 0;
        }
        
        // Calculate FPS every second
        const now = performance.now();
        if (now - this.lastFPSCheck > 1000) {
            this.currentFPS = Math.round(1000 / this.getAverageFrameTime());
            this.lastFPSCheck = now;
        }
    }
    
    getAverageFrameTime() {
        if (this.frameTimeHistory.length === 0) return 16.67;
        return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    }
    
    downgradePerformance() {
        if (this.performanceLevel === 'high') {
            this.performanceLevel = 'medium';
            this.targetFPS = 45;
            console.log('Performance downgraded to medium');
        } else if (this.performanceLevel === 'medium') {
            this.performanceLevel = 'low';
            this.targetFPS = 30;
            console.log('Performance downgraded to low');
        }
    }
    
    getQualitySettings() {
        switch (this.performanceLevel) {
            case 'low':
                return {
                    particleCount: 5,
                    shadowQuality: false,
                    animationSmoothing: false,
                    maxPipes: 3,
                    renderScale: 0.8
                };
            case 'medium':
                return {
                    particleCount: 10,
                    shadowQuality: true,
                    animationSmoothing: true,
                    maxPipes: 4,
                    renderScale: 0.9
                };
            case 'high':
            default:
                return {
                    particleCount: 20,
                    shadowQuality: true,
                    animationSmoothing: true,
                    maxPipes: 6,
                    renderScale: 1.0
                };
        }
    }
}

// Game Engine for Core Game Logic and Physics
class GameEngine {
    constructor(canvas) {
        // Browser compatibility check
        if (!canvas || !canvas.getContext) {
            throw new Error('Canvas not supported');
        }
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        if (!this.ctx) {
            throw new Error('2D context not supported');
        }
        
        // Test basic canvas functionality
        try {
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, 1, 1);
        } catch (error) {
            throw new Error('Canvas rendering not supported: ' + error.message);
        }
        
        this.gameState = 'start'; // 'start', 'playing', 'paused', 'over'
        this.score = 0;
        this.frame = 0;
        this.animationId = null;
        this.lastTime = window.performance ? 
            (performance.now || performance.webkitNow || performance.mozNow || performance.msNow).call(performance) : 
            Date.now();
        
        // Performance monitoring
        this.performanceMonitor = new PerformanceMonitor();
        this.qualitySettings = this.performanceMonitor.getQualitySettings();
        
        // Bird physics properties - Made larger and more visible
        this.bird = {
            x: 100,
            y: canvas.height / 2,
            width: 60,  // Increased size
            height: 50, // Increased size
            velocity: 0,
            gravity: 0.3,  // Reduced gravity for easier control
            flapStrength: -6,  // Stronger flap
            maxVelocity: 8,    // Reduced max velocity
            rotation: 0
        };
        
        // Pipes array and configuration - Balanced for fitness gaming
        this.pipes = [];
        this.pipeWidth = 80;
        this.pipeGap = 165; // Reduced gap size by 25% (from 220 to 165)
        this.pipeSpeed = 1.2; // Slower pipe speed for easier motion tracking
        this.pipeSpawnInterval = 420; // Increased frames between pipe spawns (1.75x spacing)
        this.lastPipeFrame = 0;
        
        // Calibration-based pipe positioning
        this.calibrationData = null;
        this.defaultGapRange = {
            min: 0.2, // 20% from top
            max: 0.8  // 80% from top
        };
        
        // Enhanced pipe generation settings - Fine-tuned for better gameplay
        this.pipeVariation = {
            minInterval: 262,  // 1.75x minimum spacing (150 * 1.75 = 262.5)
            maxInterval: 350,  // 1.75x maximum spacing (200 * 1.75 = 350)
            gapSizeVariation: 0.15, // Reduced variation for more predictable gaps
            positionSmoothing: 0.4 // Increased smoothing for smoother gap transitions
        };
        
        // Track last pipe gap position to prevent consecutive similar openings
        this.lastGapPosition = 0.5; // Default to middle
        this.minGapDifference = 0.3; // Minimum difference between consecutive gaps
        
        // Game boundaries
        this.groundHeight = 50;
        this.ceilingHeight = 0;
        
        // Controller connection state
        this.controllerConnected = false;
        
        // Latest sensor data for physics updates
        this.latestSensorData = {};
        
        // Audio system for sound effects
        this.audioContext = null;
        this.audioEnabled = false;
        
        // Callbacks
        this.onScoreUpdate = null;
        this.onGameOver = null;
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        
        // Initialize audio system
        this.initializeAudio();
        
        // Initialize game
        this.reset();
    }
    
    updateCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Adjust bird position if canvas size changed
        if (this.bird.y > canvas.height - this.groundHeight) {
            this.bird.y = canvas.height / 2;
        }
    }
    
    initializeAudio() {
        try {
            // Create AudioContext for sound generation
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioEnabled = true;
            console.log('Audio system initialized successfully');
            console.log('Audio context state:', this.audioContext.state);
        } catch (error) {
            console.warn('Audio not supported:', error);
            this.audioEnabled = false;
        }
    }
    
    resumeAudioContext() {
        // Resume audio context if suspended (required by browsers for user interaction)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('Audio context resumed');
            }).catch(error => {
                console.warn('Failed to resume audio context:', error);
            });
        }
    }
    
    resumeAudioContextOnUserInteraction() {
        // Resume audio context on user interaction to comply with browser autoplay policies
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('Audio context resumed on user interaction');
            }).catch(error => {
                console.warn('Failed to resume audio context on user interaction:', error);
            });
        }
    }
    
    playFlapSound() {
        if (!this.audioEnabled || !this.audioContext) {
            console.log('Audio not available for flap sound');
            return;
        }
        
        try {
            console.log('Playing flap sound');
            this.resumeAudioContext();
            
            // Create oscillator for flap sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Configure flap sound - quick upward sweep with more character
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(350, this.audioContext.currentTime + 0.08);
            oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.12);
            
            // Configure volume envelope with quick attack and decay
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.12);
            
            // Play sound
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.12);
            
        } catch (error) {
            console.warn('Failed to play flap sound:', error);
        }
    }
    
    playScoreSound() {
        if (!this.audioEnabled || !this.audioContext) {
            console.log('Audio not available for score sound');
            return;
        }
        
        try {
            console.log('Playing score sound');
            this.resumeAudioContext();
            
            // Create a pleasant ascending chime sound
            const frequencies = [523, 659, 784]; // C5, E5, G5 - major chord
            const noteDuration = 0.15;
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                // Connect nodes
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Configure each note
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                
                // Configure volume envelope for each note
                const startTime = this.audioContext.currentTime + (index * 0.08);
                const endTime = startTime + noteDuration;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
                
                // Play each note
                oscillator.start(startTime);
                oscillator.stop(endTime);
            });
            
        } catch (error) {
            console.warn('Failed to play score sound:', error);
        }
    }
    
    playCollisionSound() {
        if (!this.audioEnabled || !this.audioContext) {
            console.log('Audio not available for collision sound');
            return;
        }
        
        try {
            console.log('Playing collision sound');
            this.resumeAudioContext();
            
            // Create a more dramatic collision sound with multiple components
            // Main crash sound
            const oscillator1 = this.audioContext.createOscillator();
            const gainNode1 = this.audioContext.createGain();
            
            oscillator1.connect(gainNode1);
            gainNode1.connect(this.audioContext.destination);
            
            oscillator1.type = 'sawtooth';
            oscillator1.frequency.setValueAtTime(400, this.audioContext.currentTime);
            oscillator1.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.4);
            
            gainNode1.gain.setValueAtTime(0.6, this.audioContext.currentTime);
            gainNode1.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
            
            // Secondary noise component for more impact
            const oscillator2 = this.audioContext.createOscillator();
            const gainNode2 = this.audioContext.createGain();
            
            oscillator2.connect(gainNode2);
            gainNode2.connect(this.audioContext.destination);
            
            oscillator2.type = 'square';
            oscillator2.frequency.setValueAtTime(150, this.audioContext.currentTime);
            oscillator2.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.2);
            
            gainNode2.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            // Play both components
            oscillator1.start(this.audioContext.currentTime);
            oscillator1.stop(this.audioContext.currentTime + 0.4);
            
            oscillator2.start(this.audioContext.currentTime);
            oscillator2.stop(this.audioContext.currentTime + 0.2);
            
        } catch (error) {
            console.warn('Failed to play collision sound:', error);
        }
    }
    
    setCalibrationData(calibrationData) {
        this.calibrationData = calibrationData;
        console.log('🎮 GameEngine: Calibration data set:', calibrationData);
        console.log('📏 Calibrated range: minY=', calibrationData.minY, 'maxY=', calibrationData.maxY, 'range=', (calibrationData.maxY - calibrationData.minY));
    }
    
    updateSensorData(sensorData) {
        // Store current sensor data for dynamic pipe gap positioning
        this.currentSensorData = sensorData;
        
        // Store latest sensor data for bird physics updates
        this.latestSensorData = sensorData;
        
        // Use sensor data to influence future pipe spawning
        if (sensorData && sensorData.processed && sensorData.processed.calibrated) {
            // Update pipe generation parameters based on current user position
            const normalizedPosition = sensorData.processed.normalizedPosition;
            
            // Influence next pipe gap position based on user's current position
            // This creates a more responsive and personalized experience
            this.nextGapBias = normalizedPosition;
        }
    }
    
    start() {
        if (this.gameState === 'start') {
            this.gameState = 'playing';
            
            // Reset game over particles and high score flag
            this.gameOverParticles = null;
            this.isNewHighScore = false;
            
            // Visual feedback for game start
            console.log('🎮 Game Started! State:', this.gameState);
            console.log('🐦 Bird position:', this.bird.y, 'Canvas height:', this.canvas.height);
        }
        
        if (!this.animationId) {
            console.log('🔄 Starting game loop...');
            // Add periodic debug logging to help identify if the game loop is running
            this.debugFrameCount = 0;
            // Initialize lastTime for the game loop
            this.lastTime = window.performance ? 
                (performance.now || performance.webkitNow || performance.mozNow || performance.msNow).call(performance) : 
                Date.now();
            this.gameLoop(this.lastTime);
        }
    }
    
    stop() {
        if (this.animationId) {
            // Use vendor-prefixed versions for better Safari compatibility
            if (window.cancelAnimationFrame) {
                cancelAnimationFrame(this.animationId);
            } else if (window.webkitCancelAnimationFrame) {
                webkitCancelAnimationFrame(this.animationId);
            } else {
                clearTimeout(this.animationId);
            }
            this.animationId = null;
        }
    }
    
    reset() {
        console.log('🔄 Resetting game engine');
        this.gameState = 'start';
        this.score = 0;
        this.frame = 0;
        this.bird.y = this.canvas.height / 2;
        this.bird.velocity = 0;
        this.bird.rotation = 0;
        this.pipes = [];
        this.lastPipeFrame = 0;
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score);
        }
        
        console.log('✅ Game engine reset complete');
    }
    
    flap() {
        if (this.gameState === 'playing') {
            this.bird.velocity = this.bird.flapStrength;
            this.playFlapSound();
        } else if (this.gameState === 'start') {
            // Start game with click/tap (works with or without controller)
            this.start();
            this.bird.velocity = this.bird.flapStrength;
            this.playFlapSound();
        } else if (this.gameState === 'paused') {
            // Resume game with click/tap (works with or without controller)
            this.gameState = 'playing';
            this.bird.velocity = this.bird.flapStrength;
            this.playFlapSound();
        } else if (this.gameState === 'over') {
            console.log('🔄 Restarting game from game over screen');
            this.reset();
            this.start();
        }
    }
    
    gameLoop(currentTime) {
        // Fallback for performance.now() in older browsers
        if (currentTime === undefined) {
            currentTime = window.performance ? 
                (performance.now || performance.webkitNow || performance.mozNow || performance.msNow).call(performance) : 
                Date.now();
        }
        
        // If we still don't have a time value, use Date.now()
        if (currentTime === undefined) {
            currentTime = Date.now();
        }
        
        // Performance monitoring
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Measure frame performance
        this.performanceMonitor.measureFrame(deltaTime);
        
        // Update quality settings if performance changed
        const newQualitySettings = this.performanceMonitor.getQualitySettings();
        if (JSON.stringify(newQualitySettings) !== JSON.stringify(this.qualitySettings)) {
            this.qualitySettings = newQualitySettings;
            console.log('Quality settings updated:', this.qualitySettings);
        }
        
        // Enhanced debugging for Safari
        if (this.frame % 60 === 0) { // Every second
            console.log('📊 Game loop running - Frame:', this.frame, 'State:', this.gameState, 'Delta time:', deltaTime);
        }
        
        // Adaptive frame rate limiting
        const targetFrameTime = 1000 / this.performanceMonitor.targetFPS;
        if (deltaTime < targetFrameTime - 1) {
            // Skip frame if running too fast
            if (this.gameState !== 'over') {
                // Use vendor-prefixed versions for better Safari compatibility
                if (window.requestAnimationFrame) {
                    this.animationId = requestAnimationFrame(this.gameLoop);
                } else if (window.webkitRequestAnimationFrame) {
                    this.animationId = webkitRequestAnimationFrame(this.gameLoop);
                } else {
                    // Fallback for older browsers
                    this.animationId = setTimeout(() => this.gameLoop(), 16);
                }
            }
            return;
        }
        
        // Additional debugging to check if update and render are being called
        if (this.frame % 60 === 0) {
            console.log('🔄 Calling update() and render()');
        }
        
        this.update(deltaTime);
        this.render();
        
        if (this.gameState !== 'over') {
            // Use requestAnimationFrame with fallback for older browsers
            // Include vendor-prefixed versions for better Safari compatibility
            if (window.requestAnimationFrame) {
                this.animationId = requestAnimationFrame(this.gameLoop);
            } else if (window.webkitRequestAnimationFrame) {
                this.animationId = webkitRequestAnimationFrame(this.gameLoop);
            } else {
                // Fallback for older browsers
                this.animationId = setTimeout(() => this.gameLoop(), 16);
            }
        }
    }
    
    update(deltaTime = 16.67) {
        if (this.gameState !== 'playing') {
            return;
        }
        
        this.frame++;
        
        // Debug logging every 2 seconds
        if (this.frame % 120 === 0) {
            console.log('🎮 Game update - Frame:', this.frame, 'State:', this.gameState, 'Pipes:', this.pipes.length);
        }
        
        // Add Safari-specific debug logging
        if (typeof this.debugFrameCount === 'number') {
            this.debugFrameCount++;
            if (this.debugFrameCount % 60 === 0) { // Every second
                console.log('⏱️ Game loop running - Frame count:', this.debugFrameCount);
            }
        }
        
        // Frame rate independent physics
        const frameMultiplier = deltaTime / 16.67; // Normalize to 60fps
        
        // Update bird physics with latest sensor data
        this.updateBird(this.latestSensorData);
        
        // Clear sensor data after processing to prevent repeated flaps
        this.latestSensorData = {};
        
        // Spawn pipes
        this.spawnPipes();
        
        // Update pipes
        this.updatePipes();
        
        // Check collisions
        this.checkCollisions();
        
        // Update score
        this.updateScore();
    }
    
    updateBird(sensorData = {}) {
        // NEW: Position-based control instead of flap-based
        // Bird position directly follows your body position - perfect for core exercise!
        
        if (this.gameState === 'over') {
            // When game is over, let bird fall naturally with gravity
            this.bird.velocity += this.bird.gravity;
            this.bird.velocity = Math.min(this.bird.velocity, this.bird.maxVelocity);
            this.bird.y += this.bird.velocity;
            
            // Update rotation for falling effect
            this.bird.rotation += 0.05;
            
            // Keep bird within canvas bounds for rendering
            if (this.bird.y > this.canvas.height + 100) {
                // Bird is well off screen, no need to update further
                return;
            }
        } else if (sensorData.processed && sensorData.processed.calibrated) {
            // Map normalized position (0-1) to bird Y position
            // 0 = lying down = bottom of screen, 1 = sitting up = top of screen
            const screenHeight = this.canvas.height - this.groundHeight - this.bird.height;
            const targetY = (1 - sensorData.processed.normalizedPosition) * screenHeight;
            
            // Smooth movement to target position for natural feel
            const smoothing = 0.2; // Adjust for responsiveness (0.1 = smooth, 0.5 = snappy)
            this.bird.y += (targetY - this.bird.y) * smoothing;
            
            // Update velocity for visual effects (rotation, etc.)
            this.bird.velocity = (targetY - this.bird.y) * 0.1;
            
            console.log('🐦 Position control:', {
                sensorPos: sensorData.processed.normalizedPosition.toFixed(2),
                targetY: targetY.toFixed(0),
                birdY: this.bird.y.toFixed(0)
            });
        } else {
            // Fallback: traditional flappy bird physics when no sensor data
            this.bird.velocity += this.bird.gravity;
            this.bird.velocity = Math.max(-this.bird.maxVelocity, Math.min(this.bird.maxVelocity, this.bird.velocity));
            this.bird.y += this.bird.velocity;
            
            // Log fallback mode occasionally for debugging
            if (this.frame % 120 === 0) { // Every 2 seconds
                console.log('🎮 Using click/tap controls (no sensor data)');
            }
        }
        
        // Update rotation based on movement direction
        this.bird.rotation = Math.max(-0.3, Math.min(0.3, this.bird.velocity * 0.03));
        
        // Keep bird within bounds (no death, just boundaries) - only for non-game-over states
        if (this.gameState !== 'over') {
            if (this.bird.y < this.ceilingHeight) {
                this.bird.y = this.ceilingHeight;
            }
            
            if (this.bird.y + this.bird.height > this.canvas.height - this.groundHeight) {
                this.bird.y = this.canvas.height - this.groundHeight - this.bird.height;
            }
        }
    }
    
    spawnPipes() {
        // Calculate dynamic spawn interval with variation
        const currentInterval = this.pipeVariation.minInterval + 
            Math.random() * (this.pipeVariation.maxInterval - this.pipeVariation.minInterval);
        
        // Spawn new pipe if enough time has passed
        if (this.frame - this.lastPipeFrame >= currentInterval) {
            // Calculate gap position based on calibration data or use default range
            let gapPosition;
            
            if (this.calibrationData && (this.calibrationData.currentPosition !== undefined || (this.calibrationData.minY !== null && this.calibrationData.maxY !== null))) {
                // Support for test interface with currentPosition
                if (this.calibrationData.currentPosition !== undefined) {
                    gapPosition = Math.max(0.15, Math.min(0.85, this.calibrationData.currentPosition));
                } else {
                    // Use calibration-based positioning with real-time sensor influence
                    // Calculate the actual calibrated range
                    const minY = this.calibrationData.minY;
                    const maxY = this.calibrationData.maxY;
                    const range = maxY - minY;
                    
                    // Enhanced varied positioning even with calibration
                    const rand = Math.random();
                    let basePosition;
                    
                    if (rand < 0.25) {
                        // 25% chance: Force high position (challenge sitting up)
                        // Use the top 25% of the calibrated range
                        const topRangeMin = minY + range * 0.75;
                        const topRangeMax = maxY;
                        basePosition = topRangeMin + Math.random() * (topRangeMax - topRangeMin);
                        // Normalize to 0-1 range for gap positioning
                        basePosition = (basePosition - minY) / range;
                    } else if (rand < 0.5) {
                        // 25% chance: Force low position (challenge lying down)
                        // Use the bottom 25% of the calibrated range
                        const bottomRangeMin = minY;
                        const bottomRangeMax = minY + range * 0.25;
                        basePosition = bottomRangeMin + Math.random() * (bottomRangeMax - bottomRangeMin);
                        // Normalize to 0-1 range for gap positioning
                        basePosition = (basePosition - minY) / range;
                    } else {
                        // 50% chance: Use sensor-influenced positioning
                        // Distribute across the full calibrated range
                        basePosition = Math.random();
                    }
                    
                    // Influence gap position based on user's recent motion (if available)
                    if (this.nextGapBias !== undefined) {
                        // Blend random positioning with user's motion pattern
                        // This makes gaps appear in areas the user can more easily reach
                        const motionInfluence = 0.3; // 30% influence from user motion
                        basePosition = (basePosition * (1 - motionInfluence)) + (this.nextGapBias * motionInfluence);
                        
                        // Add some smoothing to prevent erratic gap positioning
                        if (this.lastGapPosition !== undefined) {
                            basePosition = (basePosition * 0.7) + (this.lastGapPosition * 0.3);
                        }
                    }
                    
                    // Clamp to reasonable range (15-85% of screen)
                    gapPosition = Math.max(0.15, Math.min(0.85, basePosition));
                }
                this.lastGapPosition = gapPosition;
            } else {
                // Enhanced varied positioning - force movement to different heights
                // Ensure consecutive pipes have significantly different positions
                let candidatePosition;
                let attempts = 0;
                const maxAttempts = 10;
                
                do {
                    const rand = Math.random();
                    
                    if (rand < 0.3) {
                        // 30% chance: High gaps (force sitting up)
                        candidatePosition = 0.15 + Math.random() * 0.25; // 15-40% from top
                    } else if (rand < 0.6) {
                        // 30% chance: Low gaps (force lying down) 
                        candidatePosition = 0.60 + Math.random() * 0.25; // 60-85% from top
                    } else {
                        // 40% chance: Middle gaps (normal range)
                        candidatePosition = 0.35 + Math.random() * 0.30; // 35-65% from top
                    }
                    
                    attempts++;
                    // Check if this position is different enough from the last one
                    const positionDifference = Math.abs(candidatePosition - this.lastGapPosition);
                    if (positionDifference >= this.minGapDifference || attempts >= maxAttempts) {
                        gapPosition = candidatePosition;
                        break;
                    }
                } while (attempts < maxAttempts);
                
                // Update last gap position
                this.lastGapPosition = gapPosition;
                
                // Gap challenge created
            }
            
            // Calculate gap size with variation
            const gapSizeMultiplier = 1.0 + (Math.random() - 0.5) * this.pipeVariation.gapSizeVariation;
            const currentGapSize = this.pipeGap * gapSizeMultiplier;
            
            // Calculate actual Y position for gap
            const availableHeight = this.canvas.height - this.groundHeight - currentGapSize - 40; // 40px buffer
            const gapY = 20 + (gapPosition * availableHeight); // 20px top buffer
            
            // Create pipe object with enhanced properties
            const pipe = {
                x: this.canvas.width,
                gapY: gapY,
                width: this.pipeWidth,
                gap: currentGapSize,
                scored: false,
                // Additional properties for enhanced rendering
                topHeight: gapY,
                bottomY: gapY + currentGapSize,
                bottomHeight: this.canvas.height - gapY - currentGapSize - this.groundHeight,
                // Calibration context for debugging
                calibrationBased: !!this.calibrationData,
                gapPosition: gapPosition
            };
            
            this.pipes.push(pipe);
            this.lastPipeFrame = this.frame;
            
            // Pipe spawned successfully
        }
    }
    
    updatePipes() {
        // Move pipes left and remove off-screen pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            
            // Check for scoring before moving pipe
            if (!pipe.scored && pipe.x + pipe.width < this.bird.x) {
                pipe.scored = true;
                this.score++;
                
                // Play score sound effect
                this.playScoreSound();
                
                // Update score display
                if (this.onScoreUpdate) {
                    this.onScoreUpdate(this.score);
                }
                
                console.log(`Score! New score: ${this.score}`);
            }
            
            // Move pipe left at current speed (slower for better gameplay)
            pipe.x -= this.pipeSpeed;
            
            // Remove pipes that are completely off-screen (with buffer for cleanup)
            if (pipe.x + pipe.width < -50) {
                // Removing off-screen pipe
                this.pipes.splice(i, 1);
                continue;
            }
            
            // Update pipe properties for smooth rendering
            pipe.topHeight = pipe.gapY;
            pipe.bottomY = pipe.gapY + pipe.gap;
            pipe.bottomHeight = this.canvas.height - pipe.gapY - pipe.gap - this.groundHeight;
        }
        
        // Pipe management active
    }
    
    updateScore() {
        // Scoring is now handled in updatePipes() to avoid duplication
        // This method is kept for compatibility but doesn't do scoring anymore
    }
    
    checkCollisions() {
        const birdLeft = this.bird.x;
        const birdRight = this.bird.x + this.bird.width;
        const birdTop = this.bird.y;
        const birdBottom = this.bird.y + this.bird.height;
        
        // Check ground collision (bird dies when hitting ground)
        if (birdBottom >= this.canvas.height - this.groundHeight) {
            this.gameOver();
            return true;
        }
        
        // Check ceiling collision (bird dies when hitting ceiling)
        if (birdTop <= this.ceilingHeight) {
            this.gameOver();
            return true;
        }
        
        // Check pipe collisions (bird dies when hitting pipes)
        for (const pipe of this.pipes) {
            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + pipe.width;
            
            // Check if bird is horizontally aligned with pipe
            if (birdRight > pipeLeft && birdLeft < pipeRight) {
                const topPipeBottom = pipe.gapY;
                const bottomPipeTop = pipe.gapY + pipe.gap;
                
                // Check collision with top or bottom pipe
                if (birdTop < topPipeBottom || birdBottom > bottomPipeTop) {
                    console.log('💥 PIPE COLLISION DETECTED!', {
                        birdTop: birdTop.toFixed(1),
                        birdBottom: birdBottom.toFixed(1),
                        topPipeBottom: topPipeBottom.toFixed(1),
                        bottomPipeTop: bottomPipeTop.toFixed(1),
                        score: this.score
                    });
                    this.gameOver();
                    return true;
                }
            }
        }
        
        return false;
    }
    
    gameOver() {
        // Only trigger game over once
        if (this.gameState === 'over') return;
        
        this.gameState = 'over';
        
        // Make the bird fall to death with increased gravity
        this.bird.velocity = 0; // Reset velocity
        this.bird.gravity = 0.8; // Increase gravity for dramatic fall
        this.bird.maxVelocity = 15; // Allow faster falling
        
        // Log final score
        console.log(`Game Over! Final Score: ${this.score}`);
        
        // Trigger game over callback
        if (this.onGameOver) {
            this.onGameOver(this.score);
        }
        
        // Render game over screen
        this.renderGameOverScreen();
        
        // Ensure event listeners are still active for restart
        // Re-attach event listeners to ensure restart functionality works
        if (this.canvas) {
            this.reattachCanvasEventListeners();
        }
    }
    
    // Method to re-attach canvas event listeners for game over screen
    reattachCanvasEventListeners() {
        console.log('🔄 Re-attaching canvas event listeners for game over screen');
        
        // Get the canvas element
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('❌ Canvas element not found for re-attaching event listeners');
            return;
        }
        
        // Remove any existing listeners to avoid duplicates
        const events = ['click', 'touchend', 'touchstart', 'mousedown', 'pointerdown'];
        events.forEach(eventType => {
            try {
                // We can't remove anonymous functions, so we'll just add new ones
                // The browser will handle duplicates appropriately
            } catch (e) {
                // Ignore errors
            }
        });
        
        // Re-add the event listeners for restart functionality
        const restartHandler = (e) => {
            try {
                console.log('🔄 Restart handler triggered from game over screen');
                e.preventDefault();
                e.stopPropagation();
                
                // Make sure we're in the game over state
                if (this.gameState === 'over') {
                    console.log('🔁 Restarting game from game over screen');
                    this.reset();
                    this.start();
                    
                    // Visual feedback for restart
                    if (canvas) {
                        canvas.style.filter = 'brightness(1.2)';
                        setTimeout(() => {
                            canvas.style.filter = 'brightness(1)';
                        }, 100);
                    }
                }
            } catch (error) {
                console.error('Canvas restart handler error:', error);
            }
            
            return false;
        };
        
        // Add event listeners specifically for restart
        canvas.addEventListener('click', restartHandler, false);
        canvas.addEventListener('touchend', restartHandler, false);
        
        console.log('✅ Canvas event listeners re-attached for restart functionality');
    }
    
    fallToDeath() {
        // Animation loop for the bird falling to death
        const fallLoop = () => {
            if (this.gameState === 'over') {
                // Apply gravity
                this.bird.velocity += this.bird.gravity;
                this.bird.velocity = Math.min(this.bird.velocity, this.bird.maxVelocity);
                this.bird.y += this.bird.velocity;
                
                // Update rotation for falling effect
                this.bird.rotation += 0.1;
                
                // Continue falling until bird is off screen
                if (this.bird.y < this.canvas.height + 100) {
                    this.render();
                    // Use vendor-prefixed versions for better Safari compatibility
                    if (window.requestAnimationFrame) {
                        requestAnimationFrame(fallLoop);
                    } else if (window.webkitRequestAnimationFrame) {
                        webkitRequestAnimationFrame(fallLoop);
                    } else {
                        setTimeout(fallLoop, 16);
                    }
                } else {
                    // Bird is off screen, stop rendering
                    console.log('Bird has fallen off screen');
                    // Still keep the game over screen active for restart
                    this.renderGameOverScreen();
                }
            }
        };
        
        fallLoop();
    }
    
    handleHighScore() {
        const currentHighScore = parseInt(localStorage.getItem('situpbird-highscore') || '0');
        if (this.score > currentHighScore) {
            localStorage.setItem('situpbird-highscore', this.score.toString());
            this.isNewHighScore = true;
            console.log(`New high score: ${this.score}!`);
        } else {
            this.isNewHighScore = false;
        }
    }
    
    renderGameOverScreen() {
        console.log('🎨 Rendering game over screen');
        
        // Render one final frame with game over state
        this.render();
        
        // Continue rendering the game over screen
        const gameOverLoop = () => {
            if (this.gameState === 'over') {
                this.render();
                // Use vendor-prefixed versions for better Safari compatibility
                if (window.requestAnimationFrame) {
                    requestAnimationFrame(gameOverLoop);
                } else if (window.webkitRequestAnimationFrame) {
                    webkitRequestAnimationFrame(gameOverLoop);
                } else {
                    setTimeout(gameOverLoop, 16);
                }
            } else {
                console.log('🎮 Game state changed, stopping game over loop');
            }
        };
        
        // Use vendor-prefixed versions for better Safari compatibility
        if (window.requestAnimationFrame) {
            requestAnimationFrame(gameOverLoop);
        } else if (window.webkitRequestAnimationFrame) {
            webkitRequestAnimationFrame(gameOverLoop);
        } else {
            setTimeout(gameOverLoop, 16);
        }
        
        console.log('✅ Game over screen rendering loop started');
    }
    
    setControllerConnected(connected) {
        this.controllerConnected = connected;
        
        if (!connected && this.gameState === 'playing') {
            // Pause the game when controller disconnects
            this.gameState = 'paused';
        }
    }
    
    render() {
        // Debugging to verify render is being called
        if (this.frame % 60 === 0) { // Every second
            console.log('🎨 Render called - Frame:', this.frame);
        }
        
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB'; // Sky blue background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render pipes
        this.renderPipes();
        
        // Render ground
        this.renderGround();
        
        // Render bird
        this.renderBird();
        
        // Render UI based on game state
        this.renderUI();
    }
    
    renderBird() {
        this.ctx.save();
        
        // Move to bird center for rotation
        this.ctx.translate(this.bird.x + this.bird.width / 2, this.bird.y + this.bird.height / 2);
        this.ctx.rotate(this.bird.rotation);
        
        // Enhanced bird animation with flapping effects
        const flapCycle = Math.sin(this.frame * 0.3) * 0.5 + 0.5; // 0 to 1 oscillation
        const isFlapping = this.bird.velocity < 0; // Bird is moving up
        const wingOffset = isFlapping ? flapCycle * 8 : 4;
        
        // Bird body with gradient effect
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.bird.width / 2);
        gradient.addColorStop(0, '#FFE55C'); // Bright yellow center
        gradient.addColorStop(0.7, '#FFD700'); // Gold
        gradient.addColorStop(1, '#DAA520'); // Dark gold edge
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, this.bird.width / 2, this.bird.height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Wing animation with flapping motion
        this.ctx.fillStyle = '#FF8C00'; // Dark orange wing
        this.ctx.beginPath();
        
        if (isFlapping) {
            // Flapping wing - more vertical
            this.ctx.ellipse(-this.bird.width / 6, -wingOffset, 
                this.bird.width / 3, this.bird.height / 3, -0.3, 0, Math.PI * 2);
        } else {
            // Gliding wing - more horizontal
            this.ctx.ellipse(-this.bird.width / 6, -4, 
                this.bird.width / 2.5, this.bird.height / 4, -0.1, 0, Math.PI * 2);
        }
        this.ctx.fill();
        
        // Wing highlight
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        if (isFlapping) {
            this.ctx.ellipse(-this.bird.width / 6, -wingOffset + 2, 
                this.bird.width / 4, this.bird.height / 5, -0.3, 0, Math.PI * 2);
        } else {
            this.ctx.ellipse(-this.bird.width / 6, -2, 
                this.bird.width / 3.5, this.bird.height / 6, -0.1, 0, Math.PI * 2);
        }
        this.ctx.fill();
        
        // Beak
        this.ctx.fillStyle = '#FF6347'; // Tomato red
        this.ctx.beginPath();
        this.ctx.moveTo(this.bird.width / 2 - 5, 0);
        this.ctx.lineTo(this.bird.width / 2 + 8, -2);
        this.ctx.lineTo(this.bird.width / 2 + 8, 2);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Eye with animation
        const eyeSize = 6 + Math.sin(this.frame * 0.1) * 1; // Subtle size variation
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.ellipse(this.bird.width / 6, -this.bird.height / 6, eyeSize, eyeSize, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye pupil
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.ellipse(this.bird.width / 6 + 1, -this.bird.height / 6, eyeSize / 2, eyeSize / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eye shine
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.ellipse(this.bird.width / 6 + 2, -this.bird.height / 6 - 1, 2, 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Motion trail effect when flapping
        if (isFlapping && this.gameState === 'playing') {
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = '#FFD700';
            for (let i = 1; i <= 3; i++) {
                this.ctx.beginPath();
                this.ctx.ellipse(-i * 8, i * 2, this.bird.width / 3, this.bird.height / 3, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.globalAlpha = 1.0;
        }
        
        this.ctx.restore();
    }
    
    renderPipes() {
        for (const pipe of this.pipes) {
            // Enhanced pipe rendering with better visual styling
            
            // Main pipe body - darker green
            this.ctx.fillStyle = '#1a5f1a'; // Dark forest green
            
            // Top pipe
            if (pipe.topHeight > 0) {
                this.ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
            }
            
            // Bottom pipe
            if (pipe.bottomHeight > 0) {
                this.ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, pipe.bottomHeight);
            }
            
            // Pipe caps with enhanced styling
            const capHeight = 25;
            const capOverhang = 8;
            
            // Top pipe cap
            if (pipe.topHeight > 0) {
                // Cap shadow
                this.ctx.fillStyle = '#0d2f0d'; // Very dark green shadow
                this.ctx.fillRect(pipe.x - capOverhang + 2, pipe.gapY - capHeight + 2, 
                    pipe.width + (capOverhang * 2), capHeight);
                
                // Main cap
                this.ctx.fillStyle = '#32CD32'; // Bright lime green
                this.ctx.fillRect(pipe.x - capOverhang, pipe.gapY - capHeight, 
                    pipe.width + (capOverhang * 2), capHeight);
                
                // Cap highlight
                this.ctx.fillStyle = '#90EE90'; // Light green highlight
                this.ctx.fillRect(pipe.x - capOverhang, pipe.gapY - capHeight, 
                    pipe.width + (capOverhang * 2), 4);
            }
            
            // Bottom pipe cap
            if (pipe.bottomHeight > 0) {
                // Cap shadow
                this.ctx.fillStyle = '#0d2f0d'; // Very dark green shadow
                this.ctx.fillRect(pipe.x - capOverhang + 2, pipe.bottomY + 2, 
                    pipe.width + (capOverhang * 2), capHeight);
                
                // Main cap
                this.ctx.fillStyle = '#32CD32'; // Bright lime green
                this.ctx.fillRect(pipe.x - capOverhang, pipe.bottomY, 
                    pipe.width + (capOverhang * 2), capHeight);
                
                // Cap highlight
                this.ctx.fillStyle = '#90EE90'; // Light green highlight
                this.ctx.fillRect(pipe.x - capOverhang, pipe.bottomY, 
                    pipe.width + (capOverhang * 2), 4);
            }
            
            // Pipe body highlights for 3D effect
            this.ctx.fillStyle = '#228B22'; // Medium green highlight
            
            // Top pipe highlight
            if (pipe.topHeight > 0) {
                this.ctx.fillRect(pipe.x, 0, 6, pipe.topHeight);
            }
            
            // Bottom pipe highlight
            if (pipe.bottomHeight > 0) {
                this.ctx.fillRect(pipe.x, pipe.bottomY, 6, pipe.bottomHeight);
            }
            
            // Debug visualization for calibration-based pipes (optional)
            if (pipe.calibrationBased && this.gameState === 'start') {
                this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'; // Cyan overlay for calibrated pipes
                this.ctx.fillRect(pipe.x, pipe.gapY, pipe.width, pipe.gap);
                
                // Show gap position indicator
                this.ctx.fillStyle = '#00FFFF';
                this.ctx.font = '12px monospace';
                this.ctx.fillText(`${(pipe.gapPosition * 100).toFixed(0)}%`, pipe.x + 5, pipe.gapY + pipe.gap/2);
            }
        }
    }
    
    renderGround() {
        this.ctx.fillStyle = '#8B4513'; // Saddle brown
        this.ctx.fillRect(0, this.canvas.height - this.groundHeight, this.canvas.width, this.groundHeight);
        
        // Add grass texture
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.canvas.height - this.groundHeight, this.canvas.width, 10);
    }
    
    renderGameOverParticles() {
        // Create floating particles effect for game over screen
        if (!this.gameOverParticles) {
            this.gameOverParticles = [];
            for (let i = 0; i < 20; i++) {
                this.gameOverParticles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 3 + 1,
                    alpha: Math.random() * 0.5 + 0.2,
                    color: ['#FFD700', '#FF6347', '#32CD32', '#00BFFF'][Math.floor(Math.random() * 4)]
                });
            }
        }
        
        // Update and render particles
        this.gameOverParticles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around screen
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            // Render particle
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;
    }
    
    renderRestartIndicator() {
        // Simple restart indicator - main button is now in game over screen
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2 + 120;
        
        // Small pulsing indicator
        const alpha = 0.5 + Math.sin(this.frame * 0.1) * 0.3;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.font = '8px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('↑ TAP ANYWHERE ↑', centerX, centerY);
    }

    renderUI() {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px "Press Start 2P"';
        this.ctx.textAlign = 'center';
        
        if (this.gameState === 'start') {
            if (this.controllerConnected) {
                this.ctx.fillText('READY TO PLAY', this.canvas.width / 2, this.canvas.height / 2);
                this.ctx.font = '12px "Press Start 2P"';
                this.ctx.fillText('Perform situp motion to start!', this.canvas.width / 2, this.canvas.height / 2 + 30);
            } else {
                this.ctx.fillText('WAITING FOR CONTROLLER...', this.canvas.width / 2, this.canvas.height / 2);
                this.ctx.font = '12px "Press Start 2P"';
                this.ctx.fillText('Connect your phone as controller', this.canvas.width / 2, this.canvas.height / 2 + 30);
            }
        } else if (this.gameState === 'paused') {
            this.ctx.fillText('CONTROLLER DISCONNECTED', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = '12px "Press Start 2P"';
            this.ctx.fillText('Reconnect controller to continue', this.canvas.width / 2, this.canvas.height / 2 + 30);
        } else if (this.gameState === 'over') {
            // Clean game over screen - click anywhere to retry
            
            // Semi-transparent overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Reset text properties
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Game Over title
            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = 'bold 28px Arial, sans-serif';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 80);
            
            // Final Score - single display only
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.font = 'bold 24px Arial, sans-serif';
            this.ctx.fillText('SCORE: ' + this.score, this.canvas.width / 2, this.canvas.height / 2 - 30);
            
            // Click instruction with pulsing effect
            const alpha = 0.6 + Math.sin(this.frame * 0.15) * 0.4;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.font = 'bold 20px Arial, sans-serif';
            this.ctx.fillText('CLICK TO RETRY', this.canvas.width / 2, this.canvas.height / 2 + 30);
            
            // Smaller instruction
            this.ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
            this.ctx.font = '16px Arial, sans-serif';
            this.ctx.fillText('Tap anywhere', this.canvas.width / 2, this.canvas.height / 2 + 70);
            
            // Game over screen complete - restart button included above
        } else if (this.gameState === 'playing') {
            // Show current score during gameplay in top-left corner
            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px "Press Start 2P"';
            this.ctx.fillText(`Score: ${this.score}`, 20, 40);
            
            // Reset text alignment for other UI elements
            this.ctx.textAlign = 'center';
        }
    }
}

// Screen Navigation System
class ScreenManager {
    constructor() {
        this.currentScreen = 'selection-screen';
        this.screens = {
            'selection-screen': document.getElementById('selection-screen'),
            'calibration-screen': document.getElementById('calibration-screen'),
            'game-screen': document.getElementById('game-screen'),
            'controller-screen': document.getElementById('controller-screen')
        };
        this.gameClient = null;
        this.controllerClient = null;
        this.sensorManager = null;
        this.calibrationStep = 0;
        this.calibrationComplete = false;
        this.shouldResumeAudio = false;
        
        // Initialize error handling and status management
        this.errorHandler = new ErrorHandler();
        this.connectionStatusManager = new ConnectionStatusManager();
        
        this.initializeEventListeners();
    }

    showScreen(screenId) {
        // Hide all screens using Tailwind's hidden class
        Object.values(this.screens).forEach(screen => {
            screen.classList.add('hidden');
            screen.classList.remove('active');
        });
        
        // Show target screen
        if (this.screens[screenId]) {
            this.screens[screenId].classList.remove('hidden');
            this.screens[screenId].classList.add('active');
            this.currentScreen = screenId;
        }
    }

    initializeEventListeners() {
        console.log('🎯 Setting up event listeners...');
        
        // Helper function to add both click and touch events for mobile compatibility
        const addMobileClickHandler = (elementId, handler) => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`❌ Element not found: ${elementId}`);
                return;
            }
            
            // Add both click and touchend events for better mobile support
            element.addEventListener('click', handler);
            element.addEventListener('touchend', (e) => {
                e.preventDefault(); // Prevent double-firing
                handler(e);
            });
            
            console.log(`✅ Event listeners added for: ${elementId}`);
        };
        
        // Selection screen buttons
        addMobileClickHandler('start-game-btn', async (e) => {
            console.log('🎮 Start Game button clicked');
            // Resume audio context on first user interaction
            this.resumeAudioContextOnUserInteraction();
            this.showScreen('calibration-screen');
            await this.initializeCalibrationScreen();
        });

        addMobileClickHandler('use-controller-btn', (e) => {
            console.log('📱 Use Controller button clicked');
            // Resume audio context on first user interaction
            this.resumeAudioContextOnUserInteraction();
            this.showScreen('controller-screen');
            this.initializeControllerScreen();
        });

        // Back to menu buttons
        addMobileClickHandler('back-to-menu-btn', () => {
            console.log('🔙 Back to menu from game');
            this.cleanupGameClient();
            this.showScreen('selection-screen');
        });

        addMobileClickHandler('controller-back-btn', () => {
            console.log('🔙 Back to menu from controller');
            this.cleanupControllerClient();
            this.showScreen('selection-screen');
        });

        addMobileClickHandler('calibration-back-btn', () => {
            console.log('🔙 Back to menu from calibration');
            this.cleanupCalibration();
            this.showScreen('selection-screen');
        });

        // Controller screen functionality
        // Enhanced mobile debugging for join room button
        const joinRoomBtn = document.getElementById('join-room-btn');
        if (joinRoomBtn) {
            // Multiple event types for maximum mobile compatibility
            const joinRoomHandler = (e) => {
                try {
                    console.log('🔗 Join Room button clicked - Event type:', e.type);
                    console.log('📱 User agent:', navigator.userAgent);
                    console.log('📍 Room code input value:', document.getElementById('room-code-input')?.value);
                    
                    // Prevent default and stop propagation
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Visual feedback
                    joinRoomBtn.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        joinRoomBtn.style.transform = '';
                    }, 150);
                    
                    this.resumeAudioContextOnUserInteraction();
                    this.handleJoinRoom();
                    
                } catch (error) {
                    console.error('❌ Error in join room handler:', error);
                    alert('Error: ' + error.message); // Fallback error display
                }
            };
            
            // Add multiple event listeners for maximum compatibility
            joinRoomBtn.addEventListener('click', joinRoomHandler);
            joinRoomBtn.addEventListener('touchend', joinRoomHandler);
            joinRoomBtn.addEventListener('touchstart', (e) => {
                console.log('👆 Join button touch started');
            });
            
            console.log('✅ Join room button events added');
        } else {
            console.error('❌ Join room button not found!');
        }

        // Room code input validation
        const roomCodeInput = document.getElementById('room-code-input');
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 4);
            });
            console.log('✅ Room code input validation added');
        }

        // Calibration screen functionality
        addMobileClickHandler('start-calibration-btn', () => {
            console.log('🎯 Start Calibration button clicked');
            this.resumeAudioContextOnUserInteraction();
            this.startCalibrationProcess();
        });

        addMobileClickHandler('next-calibration-btn', () => {
            console.log('➡️ Next Calibration button clicked');
            this.resumeAudioContextOnUserInteraction();
            this.nextCalibrationStep();
        });

        addMobileClickHandler('finish-calibration-btn', () => {
            console.log('✅ Finish Calibration button clicked');
            this.resumeAudioContextOnUserInteraction();
            this.finishCalibration();
        });

        addMobileClickHandler('recalibrate-btn', () => {
            console.log('🔄 Recalibrate button clicked');
            this.resumeAudioContextOnUserInteraction();
            this.restartCalibration();
        });

        // Manual adjustment sliders (these work fine with regular input events)
        const minAdjustment = document.getElementById('min-adjustment');
        const maxAdjustment = document.getElementById('max-adjustment');
        
        if (minAdjustment) {
            minAdjustment.addEventListener('input', (e) => {
                this.updateManualAdjustment('min', parseFloat(e.target.value));
            });
        }
        
        if (maxAdjustment) {
            maxAdjustment.addEventListener('input', (e) => {
                this.updateManualAdjustment('max', parseFloat(e.target.value));
            });
        }

        // Direct sensor test button
        addMobileClickHandler('test-sensors-btn', () => {
            console.log('🧪 Test Sensors button clicked');
            this.testSensorsDirectly();
        });

        // Error modal
        addMobileClickHandler('error-ok-btn', () => {
            console.log('✅ Error OK button clicked');
            this.hideModal('error-modal');
        });
    }

    resumeAudioContextOnUserInteraction() {
        // Resume audio context on user interaction to comply with browser autoplay policies
        // This method is called from the ScreenManager, so we need to access the game engine's audio context
        if (this.gameEngine && this.gameEngine.audioContext && this.gameEngine.audioContext.state === 'suspended') {
            this.gameEngine.audioContext.resume().then(() => {
                console.log('Audio context resumed on user interaction');
            }).catch(error => {
                console.warn('Failed to resume audio context on user interaction:', error);
            });
        } else if (!this.gameEngine) {
            // If game engine doesn't exist yet, mark that we should resume audio when it's created
            this.shouldResumeAudio = true;
        }
    }

    async initializeGameScreen() {
        // Reset score
        document.getElementById('score').textContent = '0';
        
        // Display high score if available
        this.displayHighScore();
        
        // Initialize game canvas
        this.initializeGameCanvas();
        
        // Only create game client if we don't have one (direct game start without calibration)
        if (!this.gameClient) {
            // Update connection status
            document.getElementById('connection-status').textContent = 'CONNECTING...';
            document.getElementById('room-code').textContent = '----';
            
            // Create and setup game client
            this.gameClient = new GameClient();
            this.setupGameClientHandlers();
            
            // Show loading while creating room
            this.showLoading();
            
            try {
                const success = await this.gameClient.createRoom();
                this.hideLoading();
                
                if (!success) {
                    this.showError('Failed to create game room. Please try again.');
                    this.showScreen('selection-screen');
                }
            } catch (error) {
                this.hideLoading();
                console.error('Game client error:', error);
                
                if (error.message.includes('WebSocket is not supported')) {
                    this.showError('WebSocket is not supported in this browser. Please use a modern browser.');
                } else if (error.message.includes('timeout')) {
                    this.showError('Connection timeout. Please check your internet connection and try again.');
                } else {
                    this.showError('Connection failed. Please check your internet connection and try again.');
                }
                this.showScreen('selection-screen');
            }
        } else {
            // Game client already exists (came from calibration)
            // Room code should already be displayed
            if (this.gameClient.roomCode) {
                document.getElementById('room-code').textContent = this.gameClient.roomCode;
                document.getElementById('connection-status').textContent = 'WAITING FOR CONTROLLER...';
            }
        }
    }

    setupGameClientHandlers() {
        // Connection status handling
        this.gameClient.onConnectionChange = (status) => {
            this.connectionStatusManager.updateGameConnectionStatus(status, this.gameClient.roomCode);
        };
        
        // Error handling
        this.gameClient.onError = (errorInfo) => {
            this.errorHandler.handleWebSocketError(errorInfo);
        };
        
        this.gameClient.onRoomCreated = (roomCode) => {
            // Update room code in both calibration and game screens
            document.getElementById('room-code').textContent = roomCode;
            this.connectionStatusManager.updateGameConnectionStatus('waiting', roomCode);
            
            // Show room code in calibration screen if we're calibrating
            if (this.currentScreen === 'calibration-screen') {
                document.getElementById('calibration-room-code-value').textContent = roomCode;
                document.getElementById('calibration-room-code').style.display = 'flex';
            }
        };

        this.gameClient.onControllerConnected = () => {
            this.connectionStatusManager.updateGameConnectionStatus('ready');
            this.errorHandler.showSuccess('Controller connected! Ready to play.');
            
            // Send calibration data to controller if available
            if (this.sensorManager && this.calibrationComplete) {
                const calibrationData = this.sensorManager.getCalibrationData();
                this.gameClient.sendMessage({
                    type: 'CALIBRATION_DATA',
                    code: this.gameClient.roomCode,
                    payload: calibrationData
                });
                console.log('Sent calibration data to controller:', calibrationData);
            }
            
            // Game engine is ready to receive input
            if (this.gameEngine) {
                this.gameEngine.setControllerConnected(true);
            }
        };

        this.gameClient.onControllerDisconnected = () => {
            this.connectionStatusManager.updateGameConnectionStatus('disconnected');
            this.errorHandler.handlePartnerDisconnection(false);
            
            // Pause game when controller disconnects
            if (this.gameEngine) {
                this.gameEngine.setControllerConnected(false);
            }
        };

        this.gameClient.onSensorData = (sensorData) => {
            // Handle enhanced sensor data for game logic
            this.handleGameSensorData(sensorData);
        };

        this.gameClient.onCalibrationReceived = (calibrationData) => {
            console.log('Received calibration data:', calibrationData);
            
            // Pass calibration data to game engine for pipe generation
            if (this.gameEngine) {
                this.gameEngine.setCalibrationData(calibrationData);
                this.showSuccess('Calibration data received! Pipe gaps will now match your motion range.');
            }
        };

        this.gameClient.onConnectionChange = (status) => {
            this.updateGameConnectionStatus(status);
        };

        this.gameClient.onError = (message) => {
            this.showError(message);
        };
    }

    handleGameSensorData(sensorData) {
        // Enhanced debugging for sensor data reception
        console.log('🎮 Game received sensor data:', sensorData);
        
        // Log enhanced sensor data for debugging
        if (sensorData.processed && sensorData.processed.calibrated) {
            console.log('✅ Game received calibrated sensor data:', {
                position: sensorData.processed.normalizedPosition.toFixed(2),
                shouldFlap: sensorData.processed.shouldFlap,
                isDown: sensorData.processed.isDown,
                downState: sensorData.processed.downState,
                motionIntensity: sensorData.processed.motionIntensity.toFixed(2)
            });
            
            // Update connection status to show data reception
            const connectionStatus = document.getElementById('connection-status');
            if (connectionStatus) {
                if (sensorData.processed.shouldFlap) {
                    connectionStatus.textContent = 'FLAP!';
                    connectionStatus.style.color = '#00ff00';
                    setTimeout(() => {
                        connectionStatus.textContent = 'MOTION ACTIVE';
                        connectionStatus.style.color = '#00ffff';
                    }, 200);
                } else {
                    // Show motion activity
                    connectionStatus.textContent = `MOTION: ${(sensorData.processed.normalizedPosition * 100).toFixed(0)}%`;
                    connectionStatus.style.color = '#00ffff';
                }
            }
        } else {
            console.log('❌ Game received uncalibrated sensor data:', sensorData.y);
            console.log('🔍 Processed data:', sensorData.processed);
            console.log('🔍 Calibrated flag:', sensorData.processed?.calibrated);
        }
        
        // Update calibration display if we're on the calibration screen
        if (this.currentScreen === 'calibration-screen') {
            // Update calibration tracking if we're in the calibration step
            if (this.sensorManager && this.calibrationStep === 2 && this.sensorManager.isCalibrating) {
                // Update min/max values as we receive data
                if (this.sensorManager.calibrationData.minY === null || sensorData.y < this.sensorManager.calibrationData.minY) {
                    this.sensorManager.calibrationData.minY = sensorData.y;
                }
                if (this.sensorManager.calibrationData.maxY === null || sensorData.y > this.sensorManager.calibrationData.maxY) {
                    this.sensorManager.calibrationData.maxY = sensorData.y;
                }
                
                // Update the calibration display with the current sensor data
                this.updateCalibrationDisplay(sensorData.y, this.sensorManager.calibrationData);
            } else if (sensorData.processed) {
                // Even if not actively calibrating, show the position indicator
                const calibrationData = this.sensorManager ? this.sensorManager.getCalibrationData() : { minY: null, maxY: null };
                this.updateCalibrationDisplay(sensorData.y, calibrationData);
            }
        }
        
        // Send sensor data to game engine
        console.log('🔍 Game engine check:', {
            hasGameEngine: !!this.gameEngine,
            gameState: this.gameEngine?.gameState,
            currentScreen: this.currentScreen,
            hasProcessed: !!sensorData.processed,
            isCalibrated: sensorData.processed?.calibrated
        });
        
        if (this.gameEngine && sensorData.processed && sensorData.processed.calibrated) {
            console.log('🎮 Sending sensor data to game engine:', {
                shouldFlap: sensorData.processed.shouldFlap,
                position: sensorData.processed.normalizedPosition,
                isDown: sensorData.processed.isDown
            });
            
            // Update game engine with sensor data for dynamic pipe positioning and physics
            this.gameEngine.updateSensorData(sensorData);
            
            // Position-based control - no flapping needed!
            // Bird position is controlled directly by sensor position
        } else {
            console.log('⚠️ Not sending to game engine - missing requirements');
        }
    }

    updateGameConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        
        // Remove existing animations
        statusElement.style.animation = '';
        statusElement.style.color = '';
        statusElement.style.textShadow = '';
        
        switch (status) {
            case 'connected':
                if (!this.gameClient.roomCode) {
                    statusElement.textContent = 'CONNECTING...';
                    statusElement.style.color = '#FFFF00';
                    statusElement.style.animation = 'pulse 1.5s infinite';
                }
                break;
            case 'disconnected':
                statusElement.textContent = 'DISCONNECTED';
                statusElement.style.color = '#FF0055';
                statusElement.style.textShadow = '0 0 10px #FF0055';
                break;
            case 'reconnecting':
                statusElement.textContent = 'RECONNECTING...';
                statusElement.style.color = '#FFAA00';
                statusElement.style.animation = 'glow 1s infinite';
                break;
            case 'error':
            case 'failed':
                statusElement.textContent = 'CONNECTION FAILED';
                statusElement.style.color = '#FF0055';
                statusElement.style.animation = 'pulse 0.5s infinite';
                break;
        }
    }

    initializeControllerScreen() {
        // Reset controller status
        const controllerStatus = document.getElementById('controller-status');
        controllerStatus.textContent = 'DISCONNECTED';
        controllerStatus.classList.remove('connected');
        
        // Reset sensor status
        document.getElementById('sensor-status').textContent = 'WAITING FOR CONNECTION';
        
        // Reset motion bar
        document.getElementById('motion-fill').style.width = '0%';
        
        // Clear room code input
        document.getElementById('room-code-input').value = '';
        
        // Hide debug info initially
        document.getElementById('debug-info').style.display = 'none';
        
        // Clean up existing controller client
        if (this.controllerClient) {
            this.controllerClient.disconnect();
            this.controllerClient = null;
        }
        
        // Clean up existing sensor manager
        if (this.controllerSensorManager) {
            this.controllerSensorManager.stopSensor();
            this.controllerSensorManager = null;
        }
        
        // Don't initialize sensors yet - wait until room connection is successful
    }

    setupControllerClientHandlers() {
        // Connection status handling
        this.controllerClient.onConnectionChange = (status) => {
            this.connectionStatusManager.updateControllerConnectionStatus(status);
        };
        
        // Error handling
        this.controllerClient.onError = (errorInfo) => {
            this.errorHandler.handleWebSocketError(errorInfo);
        };
        
        this.controllerClient.onConnectionSuccess = () => {
            this.connectionStatusManager.updateControllerConnectionStatus('connected');
            this.errorHandler.showSuccess('Connected to game!');
            
            // Now initialize motion detection after successful connection
            this.initializeControllerMotionDetection();
            
            // Show calibration instructions
            setTimeout(() => {
                this.errorHandler.showSuccess('Ready! Move your phone to calibrate motion controls.');
                
                // Start automatic calibration after connection
                if (this.controllerSensorManager) {
                    this.controllerSensorManager.startCalibration();
                    document.getElementById('sensor-status').textContent = 'CALIBRATING - MOVE PHONE';
                }
            }, 2000);
        };

        this.controllerClient.onGameDisconnected = () => {
            this.connectionStatusManager.updateControllerConnectionStatus('disconnected');
            this.errorHandler.handlePartnerDisconnection(true);
        };

        this.controllerClient.onCalibrationReceived = (calibrationData) => {
            console.log('Controller received calibration data:', calibrationData);
            if (this.controllerSensorManager) {
                this.controllerSensorManager.setCalibrationData(calibrationData);
                this.errorHandler.showSuccess('Calibration data received! Motion controls are now active.');
                
                // Update sensor status to show calibration is complete
                document.getElementById('sensor-status').textContent = 'CALIBRATED & ACTIVE';
            }
        };
    }

    updateControllerConnectionStatus(status) {
        const statusElement = document.getElementById('controller-status');
        
        // Remove existing animations and styles
        statusElement.style.animation = '';
        statusElement.style.boxShadow = '';
        
        switch (status) {
            case 'connected':
                // Don't override if already showing room-specific status
                if (!statusElement.textContent.includes('CONNECTED')) {
                    statusElement.textContent = 'CONNECTING...';
                    statusElement.style.animation = 'pulse 1.5s infinite';
                }
                break;
            case 'disconnected':
                statusElement.textContent = 'DISCONNECTED';
                statusElement.classList.remove('connected');
                statusElement.style.boxShadow = '0 0 10px var(--status-disconnected)';
                break;
            case 'reconnecting':
                statusElement.textContent = 'RECONNECTING...';
                statusElement.classList.remove('connected');
                statusElement.style.animation = 'glow 1s infinite';
                break;
            case 'error':
            case 'failed':
                statusElement.textContent = 'CONNECTION FAILED';
                statusElement.classList.remove('connected');
                statusElement.style.animation = 'pulse 0.5s infinite';
                statusElement.style.boxShadow = '0 0 15px var(--status-disconnected)';
                break;
        }
    }

    initializeGameCanvas() {
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        // Universal click/touch handler for all browsers including Safari and mobile
        const handleCanvasInteraction = (e) => {
            try {
                console.log('🖱️ Canvas interaction detected!', e.type, 'Game state:', this.gameEngine?.gameState);
                
                // Prevent default behavior and event bubbling
                if (e && e.preventDefault) e.preventDefault();
                if (e && e.stopPropagation) e.stopPropagation();
                
                if (this.gameEngine) {
                    const currentState = this.gameEngine.gameState;
                    console.log('🎮 Current game state in interaction handler:', currentState);
                    
                    if (currentState === 'over') {
                        console.log('🔄 Restarting game from interaction');
                        this.gameEngine.reset();
                        this.gameEngine.start();
                        
                        // Visual feedback for restart
                        const canvas = this.gameEngine.canvas;
                        if (canvas) {
                            canvas.style.filter = 'brightness(1.2)';
                            setTimeout(() => {
                                canvas.style.filter = 'brightness(1)';
                            }, 100);
                        }
                    } else if (currentState === 'start' || currentState === 'playing') {
                        console.log('🐦 Flap from interaction');
                        this.gameEngine.flap();
                    } else {
                        console.log('⚠️ Unhandled game state:', currentState);
                    }
                } else {
                    console.warn('⚠️ Game engine not available');
                }
            } catch (error) {
                console.error('Canvas interaction error:', error);
            }
            
            return false; // Prevent any default behavior
        };
        
        // Remove existing listeners to avoid duplicates
        const events = ['click', 'touchend', 'touchstart', 'mousedown', 'pointerdown'];
        events.forEach(eventType => {
            try {
                canvas.removeEventListener(eventType, handleCanvasInteraction);
            } catch (e) {
                // Ignore errors when removing non-existent listeners
            }
        });
        
        // Browser detection for compatibility (declared once at the top)
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        console.log('Browser detection:', { isSafari, isMobile });
        
        // Add event listeners with progressive enhancement
        try {
            // Primary click event - works on all browsers
            canvas.addEventListener('click', handleCanvasInteraction, false);
            
            // Touch events for mobile - essential for iOS Safari
            if (isMobile || 'ontouchstart' in window) {
                canvas.addEventListener('touchstart', handleCanvasInteraction, false);
                canvas.addEventListener('touchend', handleCanvasInteraction, false);
                console.log('✅ Touch events added for mobile');
            }
            
            // Mouse events for desktop
            if (!isMobile) {
                canvas.addEventListener('mousedown', handleCanvasInteraction, false);
                console.log('✅ Mouse events added for desktop');
            }
            
            // Pointer events if supported (modern browsers)
            if (window.PointerEvent && !isSafari) {
                canvas.addEventListener('pointerdown', handleCanvasInteraction, false);
                console.log('✅ Pointer events added');
            }
            
            console.log('✅ Canvas event listeners configured for browser compatibility');
            
        } catch (error) {
            // Ultimate fallback - basic event listeners
            console.warn('Using basic fallback event listeners:', error);
            try {
                canvas.onclick = handleCanvasInteraction;
                canvas.ontouchstart = handleCanvasInteraction;
                canvas.ontouchend = handleCanvasInteraction;
                console.log('✅ Fallback event handlers set');
            } catch (fallbackError) {
                console.error('❌ Failed to set any event handlers:', fallbackError);
            }
        }
        
        // Simplified canvas sizing to fix display issues
        const container = canvas.parentElement;
        
        // Simple, reliable canvas sizing
        let canvasWidth, canvasHeight;
        
        if (isMobile) {
            canvasWidth = 400;
            canvasHeight = 300;
        } else {
            canvasWidth = 800;
            canvasHeight = 600;
        }
        
        // Set canvas size with browser-specific handling
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Set CSS size to match exactly
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        
        // Safari and mobile optimizations
        if (isSafari || isMobile) {
            canvas.style.webkitTransform = 'translateZ(0)';
            canvas.style.transform = 'translateZ(0)';
            canvas.style.webkitBackfaceVisibility = 'hidden';
            canvas.style.backfaceVisibility = 'hidden';
        }
        
        // Canvas rendering setup with compatibility checks
        try {
            ctx.imageSmoothingEnabled = false;
        } catch (e) {
            // Fallback for older browsers
            try {
                ctx.webkitImageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.msImageSmoothingEnabled = false;
            } catch (fallbackError) {
                console.warn('Image smoothing control not available');
            }
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Test basic canvas functionality
        try {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 1, 1);
            ctx.clearRect(0, 0, 1, 1);
            console.log('✅ Canvas functionality test passed');
        } catch (testError) {
            console.error('❌ Canvas functionality test failed:', testError);
        }
        
        console.log(`Canvas initialized: ${canvas.width}x${canvas.height} (display: ${canvas.style.width}x${canvas.style.height}, Safari: ${isSafari}, Mobile: ${isMobile})`);
        
        // Run browser compatibility test before initializing game
        this.runBrowserCompatibilityTest(canvas, ctx);
        
        // Initialize game engine with browser compatibility checks
        console.log('🎮 Initializing game engine...');
        if (!this.gameEngine) {
            try {
                console.log('🎮 Creating new GameEngine instance...');
                this.gameEngine = new GameEngine(canvas);
                console.log('🎮 GameEngine created successfully');
                
                // Resume audio context if user has already interacted
                if (this.shouldResumeAudio && this.gameEngine.audioContext && this.gameEngine.audioContext.state === 'suspended') {
                    this.gameEngine.audioContext.resume().then(() => {
                        console.log('Audio context resumed after game engine creation');
                    }).catch(error => {
                        console.warn('Failed to resume audio context after game engine creation:', error);
                    });
                }
                
                this.gameEngine.onScoreUpdate = (score) => {
                    const scoreElement = document.getElementById('score');
                    if (scoreElement) {
                        scoreElement.textContent = score.toString();
                    }
                };
                
                this.gameEngine.onGameOver = (finalScore) => {
                    console.log(`Game Over! Final Score: ${finalScore}`);
                    
                    const scoreElement = document.getElementById('score');
                    if (scoreElement) {
                        scoreElement.textContent = finalScore.toString();
                    }
                    
                    this.handleGameOver(finalScore);
                };
                
                console.log('✅ Game engine initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize game engine:', error);
                console.error('Error stack:', error.stack);
                const connectionStatus = document.getElementById('connection-status');
                if (connectionStatus) {
                    connectionStatus.textContent = 'GAME ERROR - Try refreshing';
                    connectionStatus.style.color = '#ff0000';
                }
                return;
            }
        } else {
            // Update canvas reference if resized
            console.log('🎮 Updating existing GameEngine canvas...');
            this.gameEngine.updateCanvas(canvas);
            console.log('🎮 GameEngine canvas updated');
        }
        
        // Start the game loop with error handling
        console.log('🎮 Starting game engine...');
        try {
            if (this.gameEngine) {
                console.log('🎮 Calling gameEngine.start()...');
                console.log('🎮 Current game state before start:', this.gameEngine.gameState);
                this.gameEngine.start();
                console.log('🎮 Game state after start:', this.gameEngine.gameState);
                console.log('✅ Game started successfully');
            } else {
                console.error('❌ Game engine not initialized');
            }
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            console.error('Error stack:', error.stack);
        }
    }
    
    runBrowserCompatibilityTest(canvas, ctx) {
        console.log('🔍 Running browser compatibility test...');
        
        const userAgent = navigator.userAgent;
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        
        console.log('Browser info:', {
            userAgent: userAgent,
            isSafari: isSafari,
            isMobile: isMobile,
            isIOS: isIOS,
            touchSupport: 'ontouchstart' in window,
            pointerEvents: !!window.PointerEvent,
            canvasSupport: !!canvas.getContext,
            contextSupport: !!ctx
        });
        
        // Enhanced Safari-specific debugging
        if (isSafari) {
            console.log('Safari detected - enabling enhanced compatibility checks');
            console.log('requestAnimationFrame support:', !!window.requestAnimationFrame);
            console.log('webkitRequestAnimationFrame support:', !!window.webkitRequestAnimationFrame);
            console.log('cancelAnimationFrame support:', !!window.cancelAnimationFrame);
            console.log('webkitCancelAnimationFrame support:', !!window.webkitCancelAnimationFrame);
            console.log('performance.now support:', !!window.performance?.now);
            console.log('webkitPerformance support:', !!window.webkitPerformance);
        }
        
        // Test canvas rendering
        try {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(10, 10, 50, 50);
            ctx.fillStyle = '#00ff00';
            ctx.fillText('TEST', 35, 35);
            console.log('✅ Canvas rendering test passed');
            
            // Clear test
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.error('❌ Canvas rendering test failed:', error);
        }
        
        // Test event handling
        let eventTestPassed = false;
        const testHandler = () => {
            eventTestPassed = true;
            console.log('✅ Event handling test passed');
        };
        
        try {
            canvas.addEventListener('click', testHandler, false);
            canvas.removeEventListener('click', testHandler, false);
            console.log('✅ Event listener test passed');
        } catch (error) {
            console.error('❌ Event listener test failed:', error);
        }
        
        // Show compatibility status to user
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            if (isSafari && isMobile) {
                connectionStatus.textContent = 'SAFARI MOBILE DETECTED';
                connectionStatus.style.color = '#ffaa00';
            } else if (isSafari) {
                connectionStatus.textContent = 'SAFARI DETECTED';
                connectionStatus.style.color = '#ffaa00';
                // Add special Safari warning
                connectionStatus.textContent += ' - CHECK CONSOLE FOR ERRORS';
            } else if (isMobile) {
                connectionStatus.textContent = 'MOBILE DETECTED';
                connectionStatus.style.color = '#00aaff';
            } else {
                connectionStatus.textContent = 'DESKTOP DETECTED';
                connectionStatus.style.color = '#00ff00';
            }
        }
    }

    async initializeControllerMotionDetection() {
        // Show debug info
        document.getElementById('debug-info').style.display = 'block';
        this.addDebugMessage('Starting controller motion detection...');
        
        try {
            // Create sensor manager for controller
            this.controllerSensorManager = new SensorManager();
            this.addDebugMessage('SensorManager created');
            
            // Setup sensor callbacks
            this.controllerSensorManager.onSensorData = (sensorData) => {
                this.handleControllerMotionData(sensorData);
            };
            
            // Setup error handling
            this.controllerSensorManager.onSensorError = (errorInfo) => {
                this.handleControllerSensorError(errorInfo);
            };
            
            // Setup calibration completion handler
            this.controllerSensorManager.onCalibrationUpdate = (currentY, calibrationData) => {
                // Check if calibration is complete (auto-completed)
                if (!this.controllerSensorManager.isCalibrating && 
                    calibrationData.minY !== null && 
                    calibrationData.maxY !== null) {
                    const range = calibrationData.maxY - calibrationData.minY;
                    if (range > 1.0) {
                        // Send calibration data to game when auto-completed
                        if (this.controllerClient && this.controllerClient.connectionStatus === 'connected') {
                            console.log('📡 Auto-sending calibration data to game:', calibrationData);
                            this.controllerClient.sendCalibrationData(calibrationData);
                        }
                    }
                }
            };
            
            document.getElementById('sensor-status').textContent = 'REQUESTING PERMISSIONS...';
            this.addDebugMessage('Requesting permissions...');
            
            // Request permissions and start sensor
            const permissionResult = await this.controllerSensorManager.requestPermissions();
            
            if (!permissionResult.success) {
                this.connectionStatusManager.updateSensorStatus('permission_denied');
                this.addDebugMessage('❌ Permission denied');
                return;
            }
            
            this.addDebugMessage('Permissions granted');
            
            this.connectionStatusManager.updateSensorStatus('ready');
            this.addDebugMessage('Starting sensor reading...');
            
            const sensorResult = await this.controllerSensorManager.startSensorReading();
            
            if (sensorResult.success) {
                // Start real-time transmission
                this.controllerSensorManager.startRealTimeTransmission();
                
                this.connectionStatusManager.updateSensorStatus('active');
                
                this.addDebugMessage('✅ Sensor initialized successfully!');
                this.addDebugMessage('📡 Real-time transmission active at ~60Hz');
                console.log('Controller motion detection initialized successfully');
            } else {
                this.connectionStatusManager.updateSensorStatus('error');
                this.addDebugMessage('❌ Failed to start sensors');
                throw sensorResult.error || new Error('Failed to start sensor reading');
            }
            
        } catch (error) {
            console.error('Controller motion detection error:', error);
            document.getElementById('sensor-status').textContent = 'SENSOR ERROR';
            this.addDebugMessage('❌ Error: ' + error.message);
            
            // Show more specific error message
            let errorMsg = 'Failed to initialize motion sensors';
            if (error.message.includes('permission')) {
                errorMsg = 'Motion sensor permission denied. Please allow motion access and refresh.';
            } else if (error.message.includes('not supported')) {
                errorMsg = 'Motion sensors not supported on this device.';
            } else if (error.message.includes('No motion data')) {
                errorMsg = 'No motion data received. Make sure you\'re on a mobile device with motion sensors.';
            }
            
            this.showError(errorMsg);
        }
    }

    addDebugMessage(message) {
        const debugMessages = document.getElementById('debug-messages');
        if (debugMessages) {
            const timestamp = new Date().toLocaleTimeString();
            debugMessages.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            debugMessages.scrollTop = debugMessages.scrollHeight;
        }
    }

    testSensorsDirectly() {
        this.addDebugMessage('=== DIRECT SENSOR TEST ===');
        this.addDebugMessage('User Agent: ' + navigator.userAgent);
        this.addDebugMessage('Protocol: ' + window.location.protocol);
        this.addDebugMessage('Host: ' + window.location.host);
        
        // Check all possible sensor APIs
        this.addDebugMessage('DeviceMotionEvent: ' + (typeof window.DeviceMotionEvent));
        this.addDebugMessage('DeviceOrientationEvent: ' + (typeof window.DeviceOrientationEvent));
        this.addDebugMessage('Accelerometer: ' + (typeof window.Accelerometer));
        this.addDebugMessage('Gyroscope: ' + (typeof window.Gyroscope));
        
        // Check if it's a function vs constructor
        if (window.DeviceMotionEvent) {
            this.addDebugMessage('DeviceMotionEvent is: ' + window.DeviceMotionEvent.toString().substring(0, 100));
        }
        
        // Try to check permissions
        if (navigator.permissions) {
            this.addDebugMessage('Checking accelerometer permission...');
            navigator.permissions.query({name: 'accelerometer'}).then(result => {
                this.addDebugMessage('Accelerometer permission: ' + result.state);
            }).catch(err => {
                this.addDebugMessage('Permission query failed: ' + err.message);
            });
        }
        
        // Check for HTTPS requirement
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            this.addDebugMessage('⚠️ WARNING: Not using HTTPS - some browsers require HTTPS for motion sensors');
        }
        
        // Try different event names
        const eventNames = ['devicemotion', 'deviceorientation', 'deviceorientationabsolute'];
        eventNames.forEach(eventName => {
            this.addDebugMessage(`Testing ${eventName} event...`);
            
            let eventCount = 0;
            const testHandler = (event) => {
                eventCount++;
                this.addDebugMessage(`${eventName} event ${eventCount} received!`);
                
                if (eventName === 'devicemotion') {
                    const acc = event.accelerationIncludingGravity;
                    if (acc) {
                        this.addDebugMessage(`  Acceleration: x=${acc.x?.toFixed(2)}, y=${acc.y?.toFixed(2)}, z=${acc.z?.toFixed(2)}`);
                    }
                }
                
                if (eventCount >= 3) {
                    window.removeEventListener(eventName, testHandler);
                    this.addDebugMessage(`✅ ${eventName} is working!`);
                }
            };
            
            window.addEventListener(eventName, testHandler);
            
            setTimeout(() => {
                if (eventCount === 0) {
                    window.removeEventListener(eventName, testHandler);
                    this.addDebugMessage(`❌ No ${eventName} events received`);
                }
            }, 2000);
        });
    }

    handleControllerMotionData(sensorData) {
        // Update motion bar based on processed data
        const motionFill = document.getElementById('motion-fill');
        const sensorStatus = document.getElementById('sensor-status');
        
        if (sensorData.processed && sensorData.processed.calibrated) {
            // Enhanced motion bar with position and state feedback
            const position = sensorData.processed.normalizedPosition;
            motionFill.style.width = (position * 100) + '%';
            
            // Dynamic color based on position and state
            if (sensorData.processed.shouldFlap) {
                motionFill.style.background = 'linear-gradient(90deg, #00FF00, #32CD32)'; // Bright green for flap
                motionFill.style.boxShadow = '0 0 15px #00FF00';
                sensorStatus.textContent = '🚀 FLAP DETECTED!';
                sensorStatus.style.color = '#00ff00';
                sensorStatus.style.textShadow = '0 0 10px #00ff00';
            } else if (sensorData.processed.downState) {
                motionFill.style.background = 'linear-gradient(90deg, #FF6B6B, #FF8E53)'; // Red-orange for down state
                motionFill.style.boxShadow = '0 0 10px #FF6B6B';
                sensorStatus.textContent = '⬇️ DOWN STATE';
                sensorStatus.style.color = '#ffaa00';
                sensorStatus.style.textShadow = '0 0 5px #ffaa00';
            } else if (sensorData.processed.isDown) {
                motionFill.style.background = 'linear-gradient(90deg, #FF4757, #FF6B6B)'; // Red for down position
                motionFill.style.boxShadow = '0 0 8px #FF4757';
                sensorStatus.textContent = '📍 DOWN POSITION';
                sensorStatus.style.color = '#ff6600';
                sensorStatus.style.textShadow = '0 0 5px #ff6600';
            } else {
                motionFill.style.background = 'linear-gradient(90deg, #4ECDC4, #44A08D)'; // Teal for up position
                motionFill.style.boxShadow = '0 0 8px #4ECDC4';
                sensorStatus.textContent = '📍 UP POSITION';
                sensorStatus.style.color = '#00aaff';
                sensorStatus.style.textShadow = '0 0 5px #00aaff';
            }
            
            // Add motion intensity visual feedback
            const motionIntensity = sensorData.processed.motionIntensity;
            if (motionIntensity > 1.0) {
                motionFill.style.animation = 'pulse 0.3s ease-in-out';
                setTimeout(() => {
                    if (motionFill) motionFill.style.animation = '';
                }, 300);
            }
            
            // Add debug info for motion intensity
            this.addDebugMessage(`Motion: ${motionIntensity.toFixed(2)}, Pos: ${position.toFixed(2)}, Down: ${sensorData.processed.downState}`);
            
        } else {
            // Fallback to simple motion intensity using Y-axis
            const motionIntensity = Math.abs(sensorData.y) / 10;
            const normalizedMotion = Math.min(motionIntensity, 1);
            motionFill.style.width = (normalizedMotion * 100) + '%';
            
            // Default gradient for uncalibrated data
            motionFill.style.background = 'linear-gradient(90deg, var(--accent-pink), var(--accent-cyan))';
            motionFill.style.boxShadow = '0 0 5px var(--accent-cyan)';
            
            if (normalizedMotion > 0.3) {
                sensorStatus.textContent = '📊 MOTION DETECTED';
                sensorStatus.style.color = '#ffaa00';
                sensorStatus.style.textShadow = '0 0 5px #ffaa00';
            } else {
                sensorStatus.textContent = '⚡ SENSOR READY';
                sensorStatus.style.color = '#00ff00';
                sensorStatus.style.textShadow = '0 0 5px #00ff00';
            }
        }
        
        // Send sensor data to game if connected (real-time transmission)
        if (this.controllerClient && this.controllerClient.connectionStatus === 'connected') {
            console.log('📡 Sending sensor data to game:', {
                position: sensorData.processed?.normalizedPosition?.toFixed(2),
                shouldFlap: sensorData.processed?.shouldFlap,
                calibrated: sensorData.processed?.calibrated,
                minY: this.controllerSensorManager?.calibrationData?.minY,
                maxY: this.controllerSensorManager?.calibrationData?.maxY
            });
            
            const success = this.controllerClient.sendSensorData(sensorData);
            if (!success) {
                console.error('❌ Failed to send sensor data');
                this.addDebugMessage('⚠️ Failed to send sensor data - connection issue');
            } else {
                console.log('✅ Sensor data sent successfully');
            }
        } else {
            console.log('⚠️ Controller not connected, cannot send sensor data');
        }
    }
    
    handleControllerSensorError(errorInfo) {
        console.error('Controller sensor error:', errorInfo);
        
        // Update sensor status display
        this.connectionStatusManager.updateSensorStatus(errorInfo.type, errorInfo);
        
        // Add debug message
        this.addDebugMessage(`❌ Sensor Error [${errorInfo.type}]: ${errorInfo.message}`);
        
        // Show user-friendly error message
        this.errorHandler.handleSensorError(errorInfo);
        
        // Handle specific error types
        switch (errorInfo.type) {
            case 'consecutive_errors':
                this.addDebugMessage('⚠️ Multiple sensor errors - motion detection unreliable');
                break;
                
            case 'permission_denied':
                this.addDebugMessage('❌ Motion sensor permission denied by user');
                break;
                
            case 'not_supported':
                this.addDebugMessage('❌ Motion sensors not supported on this device');
                break;
                
            case 'no_data':
                this.addDebugMessage('❌ No motion data received - check device sensors');
                break;
                
            default:
                this.addDebugMessage(`❓ Unknown sensor error: ${errorInfo.message}`);
        }
    }

    async handleJoinRoom() {
        try {
            console.log('🚀 handleJoinRoom called');
            const roomCodeInput = document.getElementById('room-code-input');
            const roomCode = roomCodeInput ? roomCodeInput.value : '';
            
            console.log('📝 Room code:', roomCode);
            
            if (window.mobileDebug) {
                window.mobileDebug.log('Join room attempt: ' + roomCode);
            }
            
            if (roomCode.length !== 4) {
                console.log('❌ Invalid room code length:', roomCode.length);
                this.showError('Please enter a 4-digit room code');
                return;
            }
            
            // Show loading
            console.log('⏳ Showing loading...');
            this.showLoading();
            
            // Create and setup controller client
            console.log('🔧 Creating controller client...');
            this.controllerClient = new ControllerClient();
            this.setupControllerClientHandlers();
            
            console.log('🔗 Attempting to join room...');
            const success = await this.controllerClient.joinRoom(roomCode);
            
            console.log('✅ Join room result:', success);
            this.hideLoading();
            
            if (!success) {
                console.log('❌ Join room failed');
                this.showError('Failed to join room. Please try again.');
            } else {
                console.log('🎉 Successfully joined room!');
                if (window.mobileDebug) {
                    window.mobileDebug.log('Successfully joined room: ' + roomCode);
                }
            }
        } catch (error) {
            console.error('💥 handleJoinRoom error:', error);
            if (window.mobileDebug) {
                window.mobileDebug.error('Join room error: ' + error.message);
            }
            this.hideLoading();
            console.error('Controller client error:', error);
            
            if (error.message.includes('WebSocket is not supported')) {
                this.showError('WebSocket is not supported in this browser. Please use a modern browser.');
            } else if (error.message.includes('timeout')) {
                this.showError('Connection timeout. Please check your internet connection and try again.');
            } else {
                this.showError('Connection failed. Please check your internet connection and try again.');
            }
        }
    }

    showLoading(message = 'LOADING...') {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = loadingOverlay.querySelector('.loading-text');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        loadingOverlay.classList.remove('hidden');
        
        // Add animated dots to loading text
        this.loadingDotAnimation = setInterval(() => {
            if (loadingText) {
                const currentText = loadingText.textContent;
                const baseText = currentText.replace(/\.+$/, '');
                const dots = currentText.match(/\.+$/);
                const dotCount = dots ? dots[0].length : 0;
                
                if (dotCount >= 3) {
                    loadingText.textContent = baseText;
                } else {
                    loadingText.textContent = baseText + '.'.repeat(dotCount + 1);
                }
            }
        }, 500);
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
        
        if (this.loadingDotAnimation) {
            clearInterval(this.loadingDotAnimation);
            this.loadingDotAnimation = null;
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    showError(message) {
        // Delegate to the new ErrorHandler
        this.errorHandler.showError({
            message: message,
            type: 'GENERAL_ERROR',
            canRetry: true
        });
    }

    showSuccess(message) {
        // Delegate to the new ErrorHandler
        this.errorHandler.showSuccess(message);
    }
    
    handleGameOver(finalScore) {
        // Handle game over logic
        console.log(`Handling game over with score: ${finalScore}`);
        
        // Save high score to localStorage
        const currentHighScore = localStorage.getItem('situpbird-highscore') || 0;
        if (finalScore > currentHighScore) {
            localStorage.setItem('situpbird-highscore', finalScore.toString());
            console.log(`New high score: ${finalScore}!`);
            
            // Could show a "New High Score!" message
            setTimeout(() => {
                this.showSuccess(`New High Score: ${finalScore}!`);
            }, 1000);
        }
        
        // Update connection status to show game over
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            connectionStatus.textContent = 'GAME OVER';
        }
    }
    
    displayHighScore() {
        // Get high score from localStorage and display it
        const highScore = localStorage.getItem('situpbird-highscore') || 0;
        
        // Find or create high score display element
        let highScoreElement = document.getElementById('high-score');
        if (!highScoreElement) {
            // Create high score display in the game header
            const gameHeader = document.querySelector('.game-header');
            if (gameHeader) {
                const highScoreDisplay = document.createElement('div');
                highScoreDisplay.className = 'score-display';
                highScoreDisplay.innerHTML = `
                    <span class="label">HIGH SCORE:</span>
                    <span id="high-score" class="code">${highScore}</span>
                `;
                
                // Insert before the current score display
                const scoreDisplay = gameHeader.querySelector('.score-display');
                if (scoreDisplay) {
                    gameHeader.insertBefore(highScoreDisplay, scoreDisplay);
                } else {
                    gameHeader.appendChild(highScoreDisplay);
                }
            }
        } else {
            // Update existing high score display
            highScoreElement.textContent = highScore;
        }
    }

    cleanupGameClient() {
        if (this.gameEngine) {
            this.gameEngine.stop();
            this.gameEngine = null;
        }
        
        if (this.gameClient) {
            this.gameClient.disconnect();
            this.gameClient = null;
        }
    }

    cleanupControllerClient() {
        if (this.controllerClient) {
            this.controllerClient.disconnect();
            this.controllerClient = null;
        }
        if (this.controllerSensorManager) {
            this.controllerSensorManager.stopRealTimeTransmission();
            this.controllerSensorManager.stopSensor();
            this.controllerSensorManager = null;
        }
        
        // Reset sensor status display
        const sensorStatus = document.getElementById('sensor-status');
        if (sensorStatus) {
            sensorStatus.textContent = 'SENSOR READY';
            sensorStatus.style.color = '';
        }
    }

    async initializeCalibrationScreen() {
        // Reset calibration state
        this.calibrationStep = 0;
        this.calibrationComplete = false;
        
        // Initialize sensor manager
        this.sensorManager = new SensorManager();
        
        // Reset UI elements
        this.resetCalibrationUI();
        
        // Setup sensor callbacks
        this.setupCalibrationCallbacks();
        
        // Create game room first so we have a room code
        try {
            this.gameClient = new GameClient();
            this.setupGameClientHandlers();
            
            // Show loading while creating room
            this.showLoading();
            
            // Create room
            const success = await this.gameClient.createRoom();
            this.hideLoading();
            
            if (!success) {
                this.showError('Failed to create game room. Please try again.');
                this.showScreen('selection-screen');
                return;
            }
            
            // Start with step 1
            this.updateCalibrationStep(1);
            
        } catch (error) {
            this.hideLoading();
            console.error('Room creation error:', error);
            this.showError('Failed to create game room: ' + error.message);
            this.showScreen('selection-screen');
        }
    }

    resetCalibrationUI() {
        // Reset step indicator
        document.getElementById('calibration-step-text').textContent = 'STEP 1 OF 3';
        
        // Reset instruction text
        document.getElementById('calibration-instruction-text').textContent = 
            'Position yourself for situps and hold your phone firmly.';
        
        // Reset sensor readings
        document.getElementById('current-y-value').textContent = '0.0';
        document.getElementById('min-y-value').textContent = '--';
        document.getElementById('max-y-value').textContent = '--';
        
        // Reset position indicator
        const positionIndicator = document.getElementById('current-position');
        positionIndicator.style.left = '50%';
        
        // Hide markers
        document.getElementById('min-marker').classList.add('hidden');
        document.getElementById('max-marker').classList.add('hidden');
        
        // Reset button visibility
        document.getElementById('start-calibration-btn').classList.remove('hidden');
        document.getElementById('next-calibration-btn').classList.add('hidden');
        document.getElementById('finish-calibration-btn').classList.add('hidden');
        document.getElementById('recalibrate-btn').classList.add('hidden');
        
        // Hide manual adjustment
        document.getElementById('manual-adjustment').classList.add('hidden');
    }

    setupCalibrationCallbacks() {
        this.sensorManager.onCalibrationUpdate = (currentY, calibrationData) => {
            this.updateCalibrationDisplay(currentY, calibrationData);
        };
        
        this.sensorManager.onSensorData = (sensorData) => {
            // Update current position indicator
            this.updatePositionIndicator(sensorData);
        };
        
        this.sensorManager.onSensorError = (errorInfo) => {
            this.handleCalibrationSensorError(errorInfo);
        };
    }

    async startCalibrationProcess() {
        try {
            // Request sensor permissions
            await this.sensorManager.requestPermissions();
            
            // Start sensor reading
            await this.sensorManager.startSensorReading();
            
            // Start calibration
            this.sensorManager.startCalibration();
            
            // Update UI for step 2
            this.updateCalibrationStep(2);
            
        } catch (error) {
            console.error('Calibration start error:', error);
            this.showError('Failed to start calibration: ' + error.message);
        }
    }

    updateCalibrationStep(step) {
        this.calibrationStep = step;
        
        const stepText = document.getElementById('calibration-step-text');
        const instructionText = document.getElementById('calibration-instruction-text');
        const startBtn = document.getElementById('start-calibration-btn');
        const nextBtn = document.getElementById('next-calibration-btn');
        const finishBtn = document.getElementById('finish-calibration-btn');
        const recalibrateBtn = document.getElementById('recalibrate-btn');
        
        switch (step) {
            case 1:
                stepText.textContent = 'STEP 1 OF 3';
                instructionText.textContent = 'Position yourself for situps and hold your phone firmly.';
                startBtn.classList.remove('hidden');
                nextBtn.classList.add('hidden');
                finishBtn.classList.add('hidden');
                recalibrateBtn.classList.add('hidden');
                break;
                
            case 2:
                stepText.textContent = 'STEP 2 OF 3';
                instructionText.textContent = 'Perform your full situp range slowly. Go from lying down to sitting up several times.';
                startBtn.classList.add('hidden');
                nextBtn.classList.remove('hidden');
                finishBtn.classList.add('hidden');
                recalibrateBtn.classList.add('hidden');
                break;
                
            case 3:
                stepText.textContent = 'STEP 3 OF 3';
                instructionText.textContent = 'Review your calibration. Adjust if needed, then create your game room.';
                startBtn.classList.add('hidden');
                nextBtn.classList.add('hidden');
                finishBtn.classList.remove('hidden');
                recalibrateBtn.classList.remove('hidden');
                document.getElementById('manual-adjustment').classList.remove('hidden');
                this.setupManualAdjustment();
                break;
        }
    }

    updateCalibrationDisplay(currentY, calibrationData) {
        // Update current Y value with color coding
        const currentYElement = document.getElementById('current-y-value');
        currentYElement.textContent = currentY.toFixed(1);
        
        // Color code based on motion intensity
        const motionIntensity = Math.abs(currentY - (this.lastCalibrationY || currentY));
        this.lastCalibrationY = currentY;
        
        if (motionIntensity > 1.0) {
            currentYElement.style.color = '#00FF88'; // Green for active motion
            currentYElement.style.textShadow = '0 0 10px #00FF88';
        } else if (motionIntensity > 0.5) {
            currentYElement.style.color = '#FFFF00'; // Yellow for moderate motion
            currentYElement.style.textShadow = '0 0 5px #FFFF00';
        } else {
            currentYElement.style.color = '#e0e0ff'; // Default color for minimal motion
            currentYElement.style.textShadow = 'none';
        }
        
        // Update min/max values with enhanced visual feedback
        // Only update if we have valid values (not null)
        if (calibrationData.minY !== null && calibrationData.minY !== undefined) {
            const minElement = document.getElementById('min-y-value');
            minElement.textContent = calibrationData.minY.toFixed(1);
            minElement.style.color = '#00FF88';
            minElement.style.textShadow = '0 0 5px #00FF88';
            document.getElementById('min-marker').classList.remove('hidden');
        }
        
        if (calibrationData.maxY !== null && calibrationData.maxY !== undefined) {
            const maxElement = document.getElementById('max-y-value');
            maxElement.textContent = calibrationData.maxY.toFixed(1);
            maxElement.style.color = '#00FF88';
            maxElement.style.textShadow = '0 0 5px #00FF88';
            document.getElementById('max-marker').classList.remove('hidden');
        }
        
        // Update position indicator with enhanced animation
        this.updatePositionIndicatorFromCalibration(currentY, calibrationData);
        
        // Add visual feedback for good calibration range
        if ((calibrationData.minY !== null && calibrationData.minY !== undefined) && 
            (calibrationData.maxY !== null && calibrationData.maxY !== undefined)) {
            const range = Math.abs(calibrationData.maxY - calibrationData.minY);
            const rangeBar = document.querySelector('.range-bar');
            
            if (range > 3.0) {
                rangeBar.style.borderColor = '#00FF88'; // Good range
                rangeBar.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
            } else if (range > 1.5) {
                rangeBar.style.borderColor = '#FFFF00'; // Acceptable range
                rangeBar.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.5)';
            } else {
                rangeBar.style.borderColor = '#FF0055'; // Poor range
                rangeBar.style.boxShadow = '0 0 10px rgba(255, 0, 85, 0.5)';
            }
        }
    }

    updatePositionIndicatorFromCalibration(currentY, calibrationData) {
        const positionIndicator = document.getElementById('current-position');
        
        // If we have valid min/max values, calculate position based on them
        if (calibrationData.minY !== null && calibrationData.minY !== undefined && 
            calibrationData.maxY !== null && calibrationData.maxY !== undefined) {
            const range = calibrationData.maxY - calibrationData.minY;
            const position = range > 0 ? (currentY - calibrationData.minY) / range : 0.5;
            const clampedPosition = Math.max(0, Math.min(1, position));
            
            // Smooth animation
            positionIndicator.style.left = (clampedPosition * 100) + '%';
            
            // Enhanced visual feedback based on position
            if (clampedPosition < 0.2) {
                positionIndicator.style.backgroundColor = '#FF6B6B'; // Red for down position
                positionIndicator.style.boxShadow = '0 0 15px #FF6B6B';
                positionIndicator.style.transform = 'translate(-50%, -50%) scale(1.2)';
            } else if (clampedPosition > 0.8) {
                positionIndicator.style.backgroundColor = '#4ECDC4'; // Teal for up position
                positionIndicator.style.boxShadow = '0 0 15px #4ECDC4';
                positionIndicator.style.transform = 'translate(-50%, -50%) scale(1.2)';
            } else {
                positionIndicator.style.backgroundColor = '#00FFFF'; // Cyan for middle
                positionIndicator.style.boxShadow = '0 0 10px #00FFFF';
                positionIndicator.style.transform = 'translate(-50%, -50%) scale(1.0)';
            }
        } else {
            // If we don't have calibration data yet, just show the raw position
            // This is for cases where we're receiving data from the phone during calibration
            const normalizedPosition = (currentY + 10) / 20; // Roughly normalize -10 to 10 range to 0-1
            const clampedPosition = Math.max(0, Math.min(1, normalizedPosition));
            positionIndicator.style.left = (clampedPosition * 100) + '%';
            positionIndicator.style.backgroundColor = '#00FFFF';
            positionIndicator.style.boxShadow = '0 0 10px #00FFFF';
            positionIndicator.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }
    }

    updatePositionIndicator(sensorData) {
        if (sensorData.processed && sensorData.processed.normalizedPosition !== undefined) {
            const positionIndicator = document.getElementById('current-position');
            positionIndicator.style.left = (sensorData.processed.normalizedPosition * 100) + '%';
        }
    }

    nextCalibrationStep() {
        if (this.calibrationStep === 2) {
            // Stop calibration recording
            this.sensorManager.stopCalibration();
            
            // Check if we have valid calibration data
            const calibrationData = this.sensorManager.getCalibrationData();
            if (calibrationData.minY === null || calibrationData.maxY === null) {
                this.showError('No motion detected. Please perform situp motions and try again.');
                return;
            }
            
            // Move to step 3
            this.updateCalibrationStep(3);
        }
    }

    setupManualAdjustment() {
        const calibrationData = this.sensorManager.getCalibrationData();
        
        // Set slider values with typical Y-axis range (0.5 to 9.5)
        const minSlider = document.getElementById('min-adjustment');
        const maxSlider = document.getElementById('max-adjustment');
        
        minSlider.value = calibrationData.minY || 0.5;
        maxSlider.value = calibrationData.maxY || 9.5;
        
        // Update display values
        document.getElementById('min-adjustment-value').textContent = (calibrationData.minY || 0.5).toFixed(1);
        document.getElementById('max-adjustment-value').textContent = (calibrationData.maxY || 9.5).toFixed(1);
        
        // Update slider ranges based on detected values or use typical Y-axis range
        if (calibrationData.minY !== null && calibrationData.maxY !== null) {
            const buffer = Math.abs(calibrationData.maxY - calibrationData.minY) * 0.5;
            minSlider.min = Math.max(0, calibrationData.minY - buffer).toFixed(1);
            minSlider.max = (calibrationData.maxY + buffer).toFixed(1);
            maxSlider.min = Math.max(0, calibrationData.minY - buffer).toFixed(1);
            maxSlider.max = (calibrationData.maxY + buffer).toFixed(1);
        } else {
            // Set typical Y-axis ranges
            minSlider.min = "0";
            minSlider.max = "15";
            maxSlider.min = "0";
            maxSlider.max = "15";
        }
    }

    updateManualAdjustment(type, value) {
        const calibrationData = this.sensorManager.getCalibrationData();
        
        if (type === 'min') {
            calibrationData.minY = value;
            document.getElementById('min-adjustment-value').textContent = value.toFixed(1);
            document.getElementById('min-y-value').textContent = value.toFixed(1);
        } else if (type === 'max') {
            calibrationData.maxY = value;
            document.getElementById('max-adjustment-value').textContent = value.toFixed(1);
            document.getElementById('max-y-value').textContent = value.toFixed(1);
        }
        
        // Update sensor manager with new values
        this.sensorManager.setCalibrationData(calibrationData);
        
        // Update position indicator
        this.updatePositionIndicatorFromCalibration(this.sensorManager.currentY, calibrationData);
    }

    restartCalibration() {
        // Reset calibration data
        this.sensorManager.calibrationData.minY = null;
        this.sensorManager.calibrationData.maxY = null;
        
        // Reset UI and start over
        this.resetCalibrationUI();
        this.updateCalibrationStep(1);
    }

    async finishCalibration() {
        const calibrationData = this.sensorManager.getCalibrationData();
        
        // Validate calibration data
        if (calibrationData.minY === null || calibrationData.maxY === null) {
            this.showError('Invalid calibration data. Please recalibrate.');
            return;
        }
        
        if (calibrationData.maxY <= calibrationData.minY) {
            this.showError('Invalid range detected. Max value must be greater than min value.');
            return;
        }
        
        // Mark calibration as complete
        this.calibrationComplete = true;
        
        // Move to game screen (room already created)
        this.showScreen('game-screen');
        this.initializeGameCanvas();
        
        // Send calibration data to any connected game client (laptop)
        if (this.gameClient && this.gameClient.roomCode) {
            // Send calibration data to the game client (laptop)
            this.gameClient.sendMessage({
                type: 'CALIBRATION_DATA',
                code: this.gameClient.roomCode,
                payload: calibrationData
            });
            console.log('Sent calibration data to game client (laptop):', calibrationData);
        }
    }

    handleCalibrationSensorError(errorInfo) {
        console.error('Calibration sensor error:', errorInfo);
        
        switch (errorInfo.type) {
            case 'consecutive_errors':
                this.showError('Sensor is unstable during calibration. Please ensure your device is held firmly and try again.');
                // Optionally restart calibration
                this.restartCalibration();
                break;
                
            case 'sensor_error':
                // Just log single errors during calibration, don't interrupt the process
                console.warn('Calibration sensor warning:', errorInfo.message);
                break;
        }
    }

    cleanupCalibration() {
        if (this.sensorManager) {
            this.sensorManager.stopSensor();
            this.sensorManager = null;
        }
        this.calibrationStep = 0;
        this.calibrationComplete = false;
        
        // Hide calibration room code
        const calibrationRoomCode = document.getElementById('calibration-room-code');
        if (calibrationRoomCode) {
            calibrationRoomCode.style.display = 'none';
        }
    }

    cleanup() {
        this.cleanupGameClient();
        this.cleanupControllerClient();
        this.cleanupCalibration();
    }
}

// UI Interactions and Animations
class UIAnimations {
    constructor() {
        this.initializeAnimations();
    }

    initializeAnimations() {
        const compatibility = BrowserCompatibility.checkSupport();
        
        // Enhanced cross-platform button interactions
        document.querySelectorAll('.game-button').forEach(button => {
            // Mouse events for desktop
            if (!compatibility.isMobile) {
                button.addEventListener('mousedown', () => {
                    button.style.transform = 'scale(0.95) translateY(2px)';
                });
                
                button.addEventListener('mouseup', () => {
                    button.style.transform = '';
                });
                
                button.addEventListener('mouseleave', () => {
                    button.style.transform = '';
                });
            }
            
            // Touch events for mobile (with proper touch handling)
            if (compatibility.touchEvents) {
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault(); // Prevent mouse events from firing
                    button.style.transform = 'scale(0.95) translateY(2px)';
                    
                    // Add haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, { passive: false });
                
                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    button.style.transform = '';
                }, { passive: false });
                
                button.addEventListener('touchcancel', (e) => {
                    e.preventDefault();
                    button.style.transform = '';
                }, { passive: false });
            }
        });

        // Enhanced input focus animations with touch support
        document.querySelectorAll('.code-input').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.boxShadow = '0 0 15px var(--accent-green)';
                
                // Scroll input into view on mobile
                if (compatibility.isMobile) {
                    setTimeout(() => {
                        input.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                        });
                    }, 300);
                }
            });
            
            input.addEventListener('blur', () => {
                input.style.boxShadow = '';
            });
        });
        
        // Add orientation change handling
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Trigger canvas resize after orientation change
                if (window.screenManager && window.screenManager.currentScreen === 'game-screen') {
                    window.screenManager.initializeGameCanvas();
                }
            }, 500); // Delay to allow orientation change to complete
        });
    }

    pulseElement(elementId, duration = 1000) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.style.animation = `pulse ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }

    glowElement(elementId, duration = 2000) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.style.animation = `glow ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }
}

// Enhanced Error Handling and UI Management
class ErrorHandler {
    constructor() {
        this.errorModal = document.getElementById('error-modal');
        this.errorMessage = document.getElementById('error-message');
        this.errorOkBtn = document.getElementById('error-ok-btn');
        this.successNotification = document.getElementById('success-notification');
        this.successMessage = document.getElementById('success-message');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.errorOkBtn) {
            this.errorOkBtn.addEventListener('click', () => {
                this.hideError();
            });
        }
        
        // Close error modal on escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.errorModal.classList.contains('hidden')) {
                this.hideError();
            }
        });
    }
    
    enhanceErrorMessage(errorInfo) {
        const compatibility = BrowserCompatibility.checkSupport();
        let message = errorInfo.message || 'An error occurred';
        
        // Add platform-specific guidance based on error type
        switch (errorInfo.type) {
            case 'WEBSOCKET_ERROR':
            case 'CONNECTION_TIMEOUT':
                if (!compatibility.webSocket) {
                    message += '\n\nWebSocket support is required. Please update your browser to the latest version.';
                } else if (compatibility.isMobile) {
                    message += '\n\nTry switching between WiFi and mobile data, or move to an area with better signal.';
                } else {
                    message += '\n\nCheck your firewall settings and ensure WebSocket connections are allowed.';
                }
                break;
                
            case 'SENSOR_ERROR':
            case 'permission_denied':
                if (compatibility.isIOS) {
                    message += '\n\nOn iOS: Go to Settings > Safari > Motion & Orientation Access and enable it.';
                } else if (compatibility.isAndroid) {
                    message += '\n\nOn Android: Make sure location services are enabled and try refreshing the page.';
                } else {
                    message += '\n\nMotion sensors require a mobile device. Please use a phone or tablet.';
                }
                break;
                
            case 'not_supported':
                if (!compatibility.isMobile) {
                    message += '\n\nThis feature requires a mobile device with motion sensors. Please use a smartphone or tablet.';
                } else if (compatibility.isFirefox) {
                    message += '\n\nFirefox may have limited sensor support. Try Chrome or Safari for the best experience.';
                } else {
                    message += '\n\nYour browser may not support motion sensors. Try updating to the latest version.';
                }
                break;
                
            case 'ROOM_NOT_FOUND_OR_FULL':
                message += '\n\nDouble-check the 4-digit code or ask the game host to create a new room.';
                break;
                
            case 'COMPATIBILITY_WARNING':
                message += '\n\nSome features may not work properly, but you can still try to play.';
                break;
                
            default:
                // Add general platform guidance for unknown errors
                if (compatibility.isMobile && !compatibility.isChrome && !compatibility.isSafari) {
                    message += '\n\nFor the best experience, try using Chrome or Safari.';
                }
                break;
        }
        
        return message;
    }
    
    getPlatformSpecificInstructions(errorType) {
        const compatibility = BrowserCompatibility.checkSupport();
        
        const instructions = {
            webSocket: {
                mobile: 'Update your browser app to the latest version',
                desktop: 'Update your browser or try a different one (Chrome, Firefox, Safari, Edge)'
            },
            sensors: {
                ios: 'Enable Motion & Orientation Access in Safari settings',
                android: 'Enable location services and refresh the page',
                desktop: 'Use a mobile device with motion sensors'
            },
            connection: {
                mobile: 'Try switching between WiFi and mobile data',
                desktop: 'Check your internet connection and firewall settings'
            }
        };
        
        return instructions[errorType] || {};
    }
    
    showError(errorInfo) {
        if (!this.errorModal || !this.errorMessage) {
            console.error('Error modal elements not found');
            alert(errorInfo.message || 'An error occurred');
            return;
        }
        
        // Enhance error message with platform-specific guidance
        const enhancedMessage = this.enhanceErrorMessage(errorInfo);
        
        // Set error message
        this.errorMessage.textContent = enhancedMessage;
        
        // Add error type class for styling
        this.errorModal.className = 'modal';
        if (errorInfo.type) {
            this.errorModal.classList.add(`error-${errorInfo.type.toLowerCase()}`);
        }
        
        // Show modal
        this.errorModal.classList.remove('hidden');
        
        // Focus on OK button for accessibility
        if (this.errorOkBtn) {
            setTimeout(() => this.errorOkBtn.focus(), 100);
        }
        
        // Auto-hide after 10 seconds for non-critical errors
        if (errorInfo.canRetry !== false) {
            setTimeout(() => {
                if (!this.errorModal.classList.contains('hidden')) {
                    this.hideError();
                }
            }, 10000);
        }
    }
    
    hideError() {
        if (this.errorModal) {
            this.errorModal.classList.add('hidden');
            this.errorModal.className = 'modal hidden'; // Reset classes
        }
    }
    
    showSuccess(message, duration = 3000) {
        if (!this.successNotification || !this.successMessage) {
            console.log('Success:', message);
            return;
        }
        
        this.successMessage.textContent = message;
        this.successNotification.classList.remove('hidden');
        
        setTimeout(() => {
            this.successNotification.classList.add('hidden');
        }, duration);
    }
    
    handleWebSocketError(errorInfo) {
        let message = errorInfo.message;
        let showRetryGuidance = false;
        
        switch (errorInfo.type) {
            case 'CONNECTION_TIMEOUT':
                message = 'Connection timed out. Please check your internet connection and try again.';
                showRetryGuidance = true;
                break;
            case 'WEBSOCKET_ERROR':
                message = errorInfo.message;
                showRetryGuidance = true;
                break;
            case 'MAX_RECONNECT_ATTEMPTS':
                message = 'Unable to maintain connection to server. Please refresh the page and try again.';
                showRetryGuidance = false;
                break;
            case 'ROOM_NOT_FOUND_OR_FULL':
                message = 'Room not found or is full. Please check the room code or create a new game.';
                showRetryGuidance = false;
                break;
            case 'INVALID_ROOM_CODE':
                message = 'Please enter a valid 4-digit room code.';
                showRetryGuidance = false;
                break;
        }
        
        this.showError({
            message: message,
            type: errorInfo.type,
            canRetry: showRetryGuidance
        });
    }
    
    handleSensorError(errorInfo) {
        let message = errorInfo.message;
        
        switch (errorInfo.type) {
            case 'permission_denied':
                message = 'Motion sensor access denied. Please enable motion sensors in your browser settings and refresh the page.';
                break;
            case 'not_supported':
                message = 'Motion sensors are not supported on this device. Please use a mobile device with motion sensors.';
                break;
            case 'no_data':
                message = 'No motion data detected. Please make sure you\'re on a mobile device and try moving it gently.';
                break;
            case 'consecutive_errors':
                message = 'Motion sensor connection is unstable. Please check your device and try again.';
                break;
        }
        
        this.showError({
            message: message,
            type: errorInfo.type,
            canRetry: errorInfo.canRetry
        });
    }
    
    handlePartnerDisconnection(isController = false) {
        const message = isController 
            ? 'Game device disconnected. Please reconnect or return to menu.'
            : 'Controller disconnected. Waiting for reconnection...';
            
        this.showError({
            message: message,
            type: 'PARTNER_DISCONNECTED',
            canRetry: true
        });
    }
}

// Connection Status Manager
class ConnectionStatusManager {
    constructor() {
        this.gameStatusElement = document.getElementById('connection-status');
        this.controllerStatusElement = document.getElementById('controller-status');
        this.sensorStatusElement = document.getElementById('sensor-status');
    }
    
    updateGameConnectionStatus(status, roomCode = null) {
        if (!this.gameStatusElement) return;
        
        switch (status) {
            case 'connecting':
                this.gameStatusElement.textContent = 'CONNECTING...';
                this.gameStatusElement.className = 'status connecting';
                break;
            case 'connected':
                this.gameStatusElement.textContent = roomCode ? `ROOM: ${roomCode}` : 'CONNECTED';
                this.gameStatusElement.className = 'status connected';
                break;
            case 'waiting':
                this.gameStatusElement.textContent = 'WAITING FOR CONTROLLER...';
                this.gameStatusElement.className = 'status waiting';
                break;
            case 'ready':
                this.gameStatusElement.textContent = 'READY TO PLAY!';
                this.gameStatusElement.className = 'status ready';
                break;
            case 'disconnected':
                this.gameStatusElement.textContent = 'CONTROLLER DC';
                this.gameStatusElement.className = 'status disconnected';
                break;
            case 'error':
                this.gameStatusElement.textContent = 'CONNECTION ERROR';
                this.gameStatusElement.className = 'status error';
                break;
            case 'reconnecting':
                this.gameStatusElement.textContent = 'RECONNECTING...';
                this.gameStatusElement.className = 'status reconnecting';
                break;
        }
    }
    
    updateControllerConnectionStatus(status) {
        if (!this.controllerStatusElement) return;
        
        switch (status) {
            case 'connecting':
                this.controllerStatusElement.textContent = 'CONNECTING...';
                this.controllerStatusElement.className = 'status connecting';
                break;
            case 'connected':
                this.controllerStatusElement.textContent = 'CONNECTED!';
                this.controllerStatusElement.className = 'status connected';
                break;
            case 'disconnected':
                this.controllerStatusElement.textContent = 'DISCONNECTED';
                this.controllerStatusElement.className = 'status disconnected';
                break;
            case 'error':
                this.controllerStatusElement.textContent = 'CONNECTION ERROR';
                this.controllerStatusElement.className = 'status error';
                break;
            case 'reconnecting':
                this.controllerStatusElement.textContent = 'RECONNECTING...';
                this.controllerStatusElement.className = 'status reconnecting';
                break;
        }
    }
    
    updateSensorStatus(status, errorInfo = null) {
        if (!this.sensorStatusElement) return;
        
        switch (status) {
            case 'ready':
                this.sensorStatusElement.textContent = 'SENSOR READY';
                this.sensorStatusElement.className = 'status ready';
                break;
            case 'active':
                this.sensorStatusElement.textContent = 'SENSOR ACTIVE';
                this.sensorStatusElement.className = 'status active';
                break;
            case 'error':
                this.sensorStatusElement.textContent = 'SENSOR ERROR';
                this.sensorStatusElement.className = 'status error';
                break;
            case 'permission_denied':
                this.sensorStatusElement.textContent = 'PERMISSION DENIED';
                this.sensorStatusElement.className = 'status error';
                break;
            case 'not_supported':
                this.sensorStatusElement.textContent = 'NOT SUPPORTED';
                this.sensorStatusElement.className = 'status error';
                break;
        }
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Situp Bird app...');
        
        // Check browser compatibility first
        const compatibility = BrowserCompatibility.checkSupport();
        console.log('Browser compatibility check:', compatibility);
        
        // Show compatibility warning if needed (non-blocking)
        if (BrowserCompatibility.shouldShowCompatibilityWarning()) {
            setTimeout(() => {
                BrowserCompatibility.showCompatibilityWarning();
            }, 2000); // Delay to allow UI to load first
        }
        
        console.log('📱 Creating ScreenManager...');
        const screenManager = new ScreenManager();
        console.log('✅ ScreenManager created successfully');
        
        console.log('🎨 Creating UIAnimations...');
        const uiAnimations = new UIAnimations();
        console.log('✅ UIAnimations created successfully');
        
        // Make managers globally available for debugging
        window.screenManager = screenManager;
        window.uiAnimations = uiAnimations;
        window.errorHandler = screenManager.errorHandler;
        window.connectionStatusManager = screenManager.connectionStatusManager;
        window.browserCompatibility = compatibility;
        
        console.log('🎉 App initialization complete!');
        
        // Add mobile debug panel for easier debugging
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.mobileDebug = {
                log: (message) => {
                    console.log(message);
                    // Also show in a debug panel if needed
                    const debugPanel = document.getElementById('mobile-debug-panel');
                    if (debugPanel) {
                        debugPanel.innerHTML += '<div>' + message + '</div>';
                        debugPanel.scrollTop = debugPanel.scrollHeight;
                    }
                },
                error: (message) => {
                    console.error(message);
                    alert('Debug Error: ' + message); // Immediate feedback on mobile
                }
            };
            console.log('📱 Mobile debug system enabled');
        }
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        
        // Enhanced mobile error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            right: 20px;
            background: #ff0055;
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            text-align: center;
            z-index: 9999;
            max-height: 300px;
            overflow-y: auto;
        `;
        errorDiv.innerHTML = `
            <h3>App Failed to Load</h3>
            <p>Please refresh the page and try again.</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Stack:</strong> ${error.stack?.substring(0, 200)}...</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 10px; background: white; color: #ff0055; border: none; border-radius: 5px;">Refresh Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    console.log('Situp Bird application initialized with enhanced cross-platform support');
});

// Handle window resize for responsive canvas
window.addEventListener('resize', () => {
    if (window.screenManager && window.screenManager.currentScreen === 'game-screen') {
        window.screenManager.initializeGameCanvas();
    }
});

// Handle page unload to cleanup WebSocket connections
window.addEventListener('beforeunload', () => {
    if (window.screenManager) {
        window.screenManager.cleanup();
    }
});

// Handle visibility change to manage connections
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, could pause connections if needed
        console.log('Page hidden');
    } else {
        // Page is visible again
        console.log('Page visible');
    }
});
