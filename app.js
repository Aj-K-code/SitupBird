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
        
        // Enhanced debugging for Windows Chrome
        const isWindows = navigator.platform.indexOf("Win") !== -1;
        const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
        
        console.log('🔍 Server URL detection:', {
            protocol,
            host,
            port: window.location.port,
            isWindows,
            isChrome,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        });
        
        // For local development - always use port 8080 for WebSocket server
        if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
            const url = `${protocol}//${host}:8080`;
            console.log('🔧 Local development URL:', url);
            return url;
        }
        
        // For GitHub Pages deployment - connect to Render backend
        if (host.includes('github.io') || host.includes('pages.dev')) {
            // Replace with your actual Render deployment URL
            const renderUrl = 'situpbirdserver.onrender.com'; // Your actual Render URL
            const url = `wss://${renderUrl}`;
            console.log('🌐 GitHub Pages URL:', url);
            return url;
        }
        
        // For production deployment on same domain (Render full-stack)
        const port = window.location.port ? `:${window.location.port}` : '';
        const url = `${protocol}//${host}${port}`;
        console.log('🏭 Production URL:', url);
        return url;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔍 Attempting WebSocket connection to:', this.serverUrl);
                
                // Enhanced debugging for Windows Chrome connection issues
                const isWindows = navigator.platform.indexOf("Win") !== -1;
                const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
                
                if (isWindows && isChrome) {
                    console.log('🔧 Windows Chrome detected - additional connection debugging enabled');
                }
                
                this.socket = new WebSocket(this.serverUrl);
                
                // Set connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.socket.readyState === WebSocket.CONNECTING) {
                        this.socket.close();
                        const error = new Error('Connection timeout - Unable to connect to server');
                        this.recordError(error, 'CONNECTION_TIMEOUT');
                        console.error('⏰ WebSocket connection timeout for:', this.serverUrl);
                        reject(error);
                    }
                }, 10000); // 10 second timeout
                
                this.connectionTimeouts.push(connectionTimeout);

                this.socket.onopen = () => {
                    this.clearConnectionTimeouts();
                    console.log('✅ WebSocket connected to:', this.serverUrl);
                    this.connectionStatus = 'connected';
                    this.reconnectAttempts = 0;
                    this.lastError = null; // Clear last error on successful connection
                    this.notifyConnectionChange();
                    resolve();
                };
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

