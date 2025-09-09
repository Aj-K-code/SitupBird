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
        
        // For production - try to use same host with WebSocket protocol
        // If deployed on Render or similar, this should work
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
                        reject(new Error('Connection timeout'));
                    }
                }, 10000); // 10 second timeout

                this.socket.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log('WebSocket connected to:', this.serverUrl);
                    this.connectionStatus = 'connected';
                    this.reconnectAttempts = 0;
                    this.notifyConnectionChange();
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };

                this.socket.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.connectionStatus = 'disconnected';
                    this.notifyConnectionChange();
                    
                    // Attempt reconnection if not a clean close
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect();
                    }
                };

                this.socket.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    console.error('WebSocket error:', error);
                    this.connectionStatus = 'error';
                    this.notifyConnectionChange();
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        this.connectionStatus = 'reconnecting';
        this.notifyConnectionChange();
        
        setTimeout(() => {
            this.connect().catch(() => {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error('Max reconnection attempts reached');
                    this.connectionStatus = 'failed';
                    this.notifyConnectionChange();
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
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.connectionStatus = 'disconnected';
        this.notifyConnectionChange();
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
            if (this.onError) {
                this.onError(message.message);
            }
        });
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
            if (this.onError) {
                this.onError(message.message);
            }
        });
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
        this.sensorSupported = false;
        this.permissionGranted = false;
        this.lastPosition = 0.5;
        
        // Check for Generic Sensor API support
        this.checkSensorSupport();
    }

    checkSensorSupport() {
        console.log('Checking sensor support...');
        console.log('Accelerometer in window:', 'Accelerometer' in window);
        console.log('DeviceMotionEvent in window:', 'DeviceMotionEvent' in window);
        console.log('User agent:', navigator.userAgent);
        
        if ('Accelerometer' in window) {
            this.sensorSupported = true;
            console.log('✅ Generic Sensor API supported');
        } else if (window.DeviceMotionEvent) {
            this.sensorSupported = true;
            console.log('✅ DeviceMotion API supported (fallback)');
        } else {
            this.sensorSupported = false;
            console.warn('❌ No motion sensor APIs supported');
        }
    }

    async requestPermissions() {
        if (!this.sensorSupported) {
            throw new Error('Motion sensors not supported on this device');
        }

        try {
            // Handle iOS 13+ permission request for DeviceMotion
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                console.log('Requesting iOS DeviceMotion permission...');
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.permissionGranted = true;
                    return true;
                } else {
                    throw new Error('DeviceMotion permission denied');
                }
            }
            
            // Try Generic Sensor API
            if ('Accelerometer' in window) {
                try {
                    const result = await navigator.permissions.query({ name: 'accelerometer' });
                    if (result.state === 'granted' || result.state === 'prompt') {
                        this.permissionGranted = true;
                        return true;
                    } else {
                        throw new Error('Accelerometer permission denied');
                    }
                } catch (permError) {
                    console.log('Generic Sensor API permission check failed, falling back to DeviceMotion');
                    // Fall through to DeviceMotion
                }
            }
            
            // DeviceMotion API fallback - assume permission granted for older browsers
            if (window.DeviceMotionEvent) {
                this.permissionGranted = true;
                return true;
            }
            
            throw new Error('No motion sensor APIs available');
            
        } catch (error) {
            console.error('Permission request failed:', error);
            throw new Error('Failed to get sensor permissions: ' + error.message);
        }
    }

    async startSensorReading() {
        if (!this.permissionGranted) {
            await this.requestPermissions();
        }

        try {
            // For mobile devices, prefer DeviceMotion API as it's more widely supported
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile || !('Accelerometer' in window)) {
                console.log('Using DeviceMotion API for mobile device');
                return this.fallbackToDeviceMotion();
            }
            
            // Try Generic Sensor API for desktop
            if ('Accelerometer' in window) {
                console.log('Trying Generic Sensor API...');
                this.sensor = new Accelerometer({ frequency: 60 });
                
                this.sensor.addEventListener('reading', () => {
                    this.currentY = this.sensor.y || 0;
                    this.processSensorData();
                });

                this.sensor.addEventListener('error', (event) => {
                    console.error('Sensor error:', event.error);
                    console.log('Falling back to DeviceMotion API');
                    this.fallbackToDeviceMotion();
                });

                this.sensor.start();
                console.log('Generic Sensor API started');
                return true;
            } else {
                // Fallback to DeviceMotion API
                return this.fallbackToDeviceMotion();
            }
        } catch (error) {
            console.error('Failed to start Generic Sensor API:', error);
            console.log('Falling back to DeviceMotion API');
            return this.fallbackToDeviceMotion();
        }
    }

    fallbackToDeviceMotion() {
        if (window.DeviceMotionEvent) {
            console.log('Setting up DeviceMotion API...');
            this.setupDeviceMotion();
            return true;
        }
        console.error('DeviceMotion API not available');
        return false;
    }

    setupDeviceMotion() {
        window.addEventListener('devicemotion', (event) => {
            const acceleration = event.accelerationIncludingGravity;
            if (acceleration && acceleration.y !== null) {
                this.currentY = acceleration.y;
                this.processSensorData();
            }
        });
        console.log('DeviceMotion API started');
    }

    processSensorData() {
        // Update calibration data if calibrating
        if (this.isCalibrating) {
            if (this.calibrationData.minY === null || this.currentY < this.calibrationData.minY) {
                this.calibrationData.minY = this.currentY;
            }
            if (this.calibrationData.maxY === null || this.currentY > this.calibrationData.maxY) {
                this.calibrationData.maxY = this.currentY;
            }
            
            if (this.onCalibrationUpdate) {
                this.onCalibrationUpdate(this.currentY, this.calibrationData);
            }
        }

        // Process sensor data for game logic
        const processedData = this.processMotionData();
        
        if (this.onSensorData) {
            this.onSensorData(processedData);
        }
    }

    processMotionData() {
        const { minY, maxY, threshold } = this.calibrationData;
        
        if (minY === null || maxY === null) {
            return {
                y: this.currentY,
                timestamp: Date.now(),
                processed: {
                    isDown: false,
                    shouldFlap: false,
                    gapPosition: 0.5
                }
            };
        }

        // Normalize position to 0-1 range
        const range = maxY - minY;
        const normalizedPosition = range > 0 ? Math.max(0, Math.min(1, (this.currentY - minY) / range)) : 0.5;
        
        // Determine if user is in "down" position (lower threshold)
        const downThreshold = 0.3; // 30% of range from bottom
        const upThreshold = 0.7;   // 70% of range from bottom
        
        const isDown = normalizedPosition < downThreshold;
        const isUp = normalizedPosition > upThreshold;
        
        // Simple flap detection: transition from down to up
        const shouldFlap = this.lastPosition < downThreshold && normalizedPosition > upThreshold;
        this.lastPosition = normalizedPosition;

        return {
            y: this.currentY,
            timestamp: Date.now(),
            processed: {
                isDown: isDown,
                shouldFlap: shouldFlap,
                gapPosition: normalizedPosition,
                normalizedPosition: normalizedPosition
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

    stopSensor() {
        if (this.sensor && this.sensor.stop) {
            this.sensor.stop();
            this.sensor = null;
        }
        // DeviceMotion events can't be stopped, but we can ignore them
        this.onSensorData = null;
        this.onCalibrationUpdate = null;
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
        this.initializeEventListeners();
    }

    showScreen(screenId) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        if (this.screens[screenId]) {
            this.screens[screenId].classList.add('active');
            this.currentScreen = screenId;
        }
    }

    initializeEventListeners() {
        // Selection screen buttons
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.showScreen('calibration-screen');
            this.initializeCalibrationScreen();
        });

        document.getElementById('use-controller-btn').addEventListener('click', () => {
            this.showScreen('controller-screen');
            this.initializeControllerScreen();
        });

        // Back to menu buttons
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.cleanupGameClient();
            this.showScreen('selection-screen');
        });

        document.getElementById('controller-back-btn').addEventListener('click', () => {
            this.cleanupControllerClient();
            this.showScreen('selection-screen');
        });

        document.getElementById('calibration-back-btn').addEventListener('click', () => {
            this.cleanupCalibration();
            this.showScreen('selection-screen');
        });

        // Controller screen functionality
        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.handleJoinRoom();
        });

        // Room code input validation
        const roomCodeInput = document.getElementById('room-code-input');
        roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 4);
        });

        // Calibration screen functionality
        document.getElementById('start-calibration-btn').addEventListener('click', () => {
            this.startCalibrationProcess();
        });

        document.getElementById('next-calibration-btn').addEventListener('click', () => {
            this.nextCalibrationStep();
        });

        document.getElementById('finish-calibration-btn').addEventListener('click', () => {
            this.finishCalibration();
        });

        document.getElementById('recalibrate-btn').addEventListener('click', () => {
            this.restartCalibration();
        });

        // Manual adjustment sliders
        document.getElementById('min-adjustment').addEventListener('input', (e) => {
            this.updateManualAdjustment('min', parseFloat(e.target.value));
        });

        document.getElementById('max-adjustment').addEventListener('input', (e) => {
            this.updateManualAdjustment('max', parseFloat(e.target.value));
        });

        // Error modal
        document.getElementById('error-ok-btn').addEventListener('click', () => {
            this.hideModal('error-modal');
        });
    }

    async initializeGameScreen() {
        // Reset score
        document.getElementById('score').textContent = '0';
        
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
        this.gameClient.onRoomCreated = (roomCode) => {
            // Update room code in both calibration and game screens
            document.getElementById('room-code').textContent = roomCode;
            document.getElementById('connection-status').textContent = 'WAITING FOR CONTROLLER...';
            
            // Show room code in calibration screen if we're calibrating
            if (this.currentScreen === 'calibration-screen') {
                document.getElementById('calibration-room-code-value').textContent = roomCode;
                document.getElementById('calibration-room-code').style.display = 'flex';
            }
        };

        this.gameClient.onControllerConnected = () => {
            document.getElementById('connection-status').textContent = 'CONNECTED!';
            this.showSuccess('Controller connected! Ready to play.');
            
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
        };

        this.gameClient.onControllerDisconnected = () => {
            document.getElementById('connection-status').textContent = 'CONTROLLER DC';
            this.showError('Controller disconnected');
        };

        this.gameClient.onSensorData = (sensorData) => {
            // Handle sensor data for game logic (will be implemented in later tasks)
            console.log('Received sensor data:', sensorData);
        };

        this.gameClient.onCalibrationReceived = (calibrationData) => {
            // Handle calibration data (will be implemented in later tasks)
            console.log('Received calibration data:', calibrationData);
        };

        this.gameClient.onConnectionChange = (status) => {
            this.updateGameConnectionStatus(status);
        };

        this.gameClient.onError = (message) => {
            this.showError(message);
        };
    }

    updateGameConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        switch (status) {
            case 'connected':
                if (!this.gameClient.roomCode) {
                    statusElement.textContent = 'CONNECTING...';
                }
                break;
            case 'disconnected':
                statusElement.textContent = 'DISCONNECTED';
                break;
            case 'reconnecting':
                statusElement.textContent = 'RECONNECTING...';
                break;
            case 'error':
            case 'failed':
                statusElement.textContent = 'CONNECTION FAILED';
                break;
        }
    }

    initializeControllerScreen() {
        // Reset controller status
        const controllerStatus = document.getElementById('controller-status');
        controllerStatus.textContent = 'DISCONNECTED';
        controllerStatus.classList.remove('connected');
        
        // Reset sensor status
        document.getElementById('sensor-status').textContent = 'SENSOR READY';
        
        // Reset motion bar
        document.getElementById('motion-fill').style.width = '0%';
        
        // Clear room code input
        document.getElementById('room-code-input').value = '';
        
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
        
        // Initialize motion detection
        this.initializeControllerMotionDetection();
    }

    setupControllerClientHandlers() {
        this.controllerClient.onConnectionSuccess = () => {
            const controllerStatus = document.getElementById('controller-status');
            controllerStatus.textContent = 'CONNECTED';
            controllerStatus.classList.add('connected');
            this.showSuccess('Connected to game!');
        };

        this.controllerClient.onGameDisconnected = () => {
            const controllerStatus = document.getElementById('controller-status');
            controllerStatus.textContent = 'GAME DC';
            controllerStatus.classList.remove('connected');
            this.showError('Game disconnected');
        };

        this.controllerClient.onConnectionChange = (status) => {
            this.updateControllerConnectionStatus(status);
        };

        this.controllerClient.onCalibrationReceived = (calibrationData) => {
            console.log('Controller received calibration data:', calibrationData);
            if (this.controllerSensorManager) {
                this.controllerSensorManager.setCalibrationData(calibrationData);
                this.showSuccess('Calibration data received! Motion controls are now active.');
            }
        };

        this.controllerClient.onError = (message) => {
            this.showError(message);
        };
    }

    updateControllerConnectionStatus(status) {
        const statusElement = document.getElementById('controller-status');
        switch (status) {
            case 'connected':
                // Don't override if already showing room-specific status
                if (!statusElement.textContent.includes('CONNECTED')) {
                    statusElement.textContent = 'CONNECTING...';
                }
                break;
            case 'disconnected':
                statusElement.textContent = 'DISCONNECTED';
                statusElement.classList.remove('connected');
                break;
            case 'reconnecting':
                statusElement.textContent = 'RECONNECTING...';
                statusElement.classList.remove('connected');
                break;
            case 'error':
            case 'failed':
                statusElement.textContent = 'CONNECTION FAILED';
                statusElement.classList.remove('connected');
                break;
        }
    }

    initializeGameCanvas() {
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size based on container
        const container = canvas.parentElement;
        const maxWidth = Math.min(800, container.clientWidth - 40);
        const maxHeight = Math.min(600, window.innerHeight * 0.6);
        
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        
        // Draw placeholder game screen
        ctx.fillStyle = '#000022';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ffff';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('GAME READY', canvas.width / 2, canvas.height / 2);
        ctx.fillText('WAITING FOR CONTROLLER...', canvas.width / 2, canvas.height / 2 + 40);
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
            
            document.getElementById('sensor-status').textContent = 'REQUESTING PERMISSIONS...';
            this.addDebugMessage('Requesting permissions...');
            
            // Request permissions and start sensor
            await this.controllerSensorManager.requestPermissions();
            this.addDebugMessage('Permissions granted');
            
            document.getElementById('sensor-status').textContent = 'STARTING SENSORS...';
            this.addDebugMessage('Starting sensor reading...');
            
            const success = await this.controllerSensorManager.startSensorReading();
            
            if (success) {
                document.getElementById('sensor-status').textContent = 'SENSOR READY';
                this.addDebugMessage('✅ Sensor initialized successfully!');
                console.log('Controller motion detection initialized successfully');
            } else {
                throw new Error('Failed to start sensor reading');
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

    handleControllerMotionData(sensorData) {
        // Update motion bar based on processed data
        const motionFill = document.getElementById('motion-fill');
        
        if (sensorData.processed && sensorData.processed.normalizedPosition !== undefined) {
            // Use calibrated position for motion bar
            motionFill.style.width = (sensorData.processed.normalizedPosition * 100) + '%';
            
            // Update sensor status based on motion state
            const sensorStatus = document.getElementById('sensor-status');
            if (sensorData.processed.shouldFlap) {
                sensorStatus.textContent = 'FLAP DETECTED!';
            } else if (sensorData.processed.isDown) {
                sensorStatus.textContent = 'DOWN POSITION';
            } else {
                sensorStatus.textContent = 'UP POSITION';
            }
        } else {
            // Fallback to simple motion intensity using Y-axis
            const motionIntensity = Math.abs(sensorData.y) / 10; // Y-axis typically has larger range
            const normalizedMotion = Math.min(motionIntensity, 1);
            motionFill.style.width = (normalizedMotion * 100) + '%';
            
            const sensorStatus = document.getElementById('sensor-status');
            if (normalizedMotion > 0.3) {
                sensorStatus.textContent = 'MOTION DETECTED';
            } else {
                sensorStatus.textContent = 'SENSOR READY';
            }
        }
        
        // Send sensor data to game if connected
        if (this.controllerClient && this.controllerClient.connectionStatus === 'connected') {
            this.controllerClient.sendSensorData(sensorData);
        }
    }

    async handleJoinRoom() {
        const roomCode = document.getElementById('room-code-input').value;
        
        if (roomCode.length !== 4) {
            this.showError('Please enter a 4-digit room code');
            return;
        }
        
        // Show loading
        this.showLoading();
        
        try {
            // Create and setup controller client
            this.controllerClient = new ControllerClient();
            this.setupControllerClientHandlers();
            
            const success = await this.controllerClient.joinRoom(roomCode);
            this.hideLoading();
            
            if (!success) {
                this.showError('Failed to join room. Please try again.');
            }
        } catch (error) {
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

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showModal('error-modal');
    }

    showSuccess(message) {
        // You could add a success modal similar to error modal
        console.log('Success:', message);
    }

    cleanupGameClient() {
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
            this.controllerSensorManager.stopSensor();
            this.controllerSensorManager = null;
        }
    }

    initializeCalibrationScreen() {
        // Reset calibration state
        this.calibrationStep = 0;
        this.calibrationComplete = false;
        
        // Initialize sensor manager
        this.sensorManager = new SensorManager();
        
        // Reset UI elements
        this.resetCalibrationUI();
        
        // Setup sensor callbacks
        this.setupCalibrationCallbacks();
        
        // Start with step 1
        this.updateCalibrationStep(1);
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
    }

    async startCalibrationProcess() {
        try {
            // Create game room first so we have a room code
            this.gameClient = new GameClient();
            this.setupGameClientHandlers();
            
            // Show loading while creating room
            this.showLoading();
            
            // Create room
            const success = await this.gameClient.createRoom();
            this.hideLoading();
            
            if (!success) {
                this.showError('Failed to create game room. Please try again.');
                return;
            }
            
            // Request sensor permissions
            await this.sensorManager.requestPermissions();
            
            // Start sensor reading
            await this.sensorManager.startSensorReading();
            
            // Start calibration
            this.sensorManager.startCalibration();
            
            // Update UI for step 2
            this.updateCalibrationStep(2);
            
        } catch (error) {
            this.hideLoading();
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
        // Update current Y value
        document.getElementById('current-y-value').textContent = currentY.toFixed(1);
        
        // Update min/max values
        if (calibrationData.minY !== null) {
            document.getElementById('min-y-value').textContent = calibrationData.minY.toFixed(1);
            document.getElementById('min-marker').classList.remove('hidden');
        }
        
        if (calibrationData.maxY !== null) {
            document.getElementById('max-y-value').textContent = calibrationData.maxY.toFixed(1);
            document.getElementById('max-marker').classList.remove('hidden');
        }
        
        // Update position indicator
        this.updatePositionIndicatorFromCalibration(currentY, calibrationData);
    }

    updatePositionIndicatorFromCalibration(currentY, calibrationData) {
        const positionIndicator = document.getElementById('current-position');
        
        if (calibrationData.minY !== null && calibrationData.maxY !== null) {
            const range = calibrationData.maxY - calibrationData.minY;
            const position = range > 0 ? (currentY - calibrationData.minY) / range : 0.5;
            const clampedPosition = Math.max(0, Math.min(1, position));
            positionIndicator.style.left = (clampedPosition * 100) + '%';
        } else {
            positionIndicator.style.left = '50%';
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
        
        // Send calibration data to any connected controllers
        if (this.gameClient && this.gameClient.roomCode) {
            // If controller is already connected, send calibration data immediately
            const connectedControllers = document.getElementById('connection-status').textContent.includes('CONNECTED');
            if (connectedControllers) {
                this.gameClient.sendMessage({
                    type: 'CALIBRATION_DATA',
                    code: this.gameClient.roomCode,
                    payload: calibrationData
                });
                console.log('Sent calibration data to controller:', calibrationData);
            }
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
        // Add button click animations
        document.querySelectorAll('.game-button').forEach(button => {
            button.addEventListener('mousedown', () => {
                button.style.transform = 'scale(0.95) translateY(2px)';
            });
            
            button.addEventListener('mouseup', () => {
                button.style.transform = '';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = '';
            });
        });

        // Add input focus animations
        document.querySelectorAll('.code-input').forEach(input => {
            input.addEventListener('focus', () => {
                input.style.boxShadow = '0 0 15px var(--accent-green)';
            });
            
            input.addEventListener('blur', () => {
                input.style.boxShadow = '';
            });
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

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    const screenManager = new ScreenManager();
    const uiAnimations = new UIAnimations();
    
    // Make managers globally available for debugging
    window.screenManager = screenManager;
    window.uiAnimations = uiAnimations;
    
    console.log('Situp Bird application initialized');
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