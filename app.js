// Screen Navigation System
class ScreenManager {
    constructor() {
        this.currentScreen = 'selection-screen';
        this.screens = {
            'selection-screen': document.getElementById('selection-screen'),
            'game-screen': document.getElementById('game-screen'),
            'controller-screen': document.getElementById('controller-screen')
        };
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
            this.showScreen('game-screen');
            this.initializeGameScreen();
        });

        document.getElementById('use-controller-btn').addEventListener('click', () => {
            this.showScreen('controller-screen');
            this.initializeControllerScreen();
        });

        // Back to menu buttons
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.showScreen('selection-screen');
        });

        document.getElementById('controller-back-btn').addEventListener('click', () => {
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

        // Error modal
        document.getElementById('error-ok-btn').addEventListener('click', () => {
            this.hideModal('error-modal');
        });
    }

    initializeGameScreen() {
        // Generate random room code
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('room-code').textContent = roomCode;
        
        // Reset score
        document.getElementById('score').textContent = '0';
        
        // Update connection status
        document.getElementById('connection-status').textContent = 'WAITING FOR CONTROLLER...';
        
        // Initialize game canvas
        this.initializeGameCanvas();
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
        
        // Initialize motion detection
        this.initializeMotionDetection();
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

    initializeMotionDetection() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                this.handleMotionData(event);
            });
        } else {
            this.showError('Motion sensors not supported on this device');
        }
    }

    handleMotionData(event) {
        // Get acceleration data
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;
        
        // Calculate motion intensity (simplified)
        const motionIntensity = Math.abs(acceleration.y || 0);
        const normalizedMotion = Math.min(motionIntensity / 20, 1); // Normalize to 0-1
        
        // Update motion bar
        const motionFill = document.getElementById('motion-fill');
        motionFill.style.width = (normalizedMotion * 100) + '%';
        
        // Update sensor status
        const sensorStatus = document.getElementById('sensor-status');
        if (normalizedMotion > 0.3) {
            sensorStatus.textContent = 'MOTION DETECTED';
        } else {
            sensorStatus.textContent = 'SENSOR READY';
        }
    }

    handleJoinRoom() {
        const roomCode = document.getElementById('room-code-input').value;
        
        if (roomCode.length !== 4) {
            this.showError('Please enter a 4-digit room code');
            return;
        }
        
        // Show loading
        this.showLoading();
        
        // Simulate connection attempt
        setTimeout(() => {
            this.hideLoading();
            
            // Simulate successful connection
            const controllerStatus = document.getElementById('controller-status');
            controllerStatus.textContent = 'CONNECTED';
            controllerStatus.classList.add('connected');
            
            this.showSuccess('Connected to room ' + roomCode);
        }, 2000);
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