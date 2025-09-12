// Simple browser compatibility check
function checkBrowserCompatibility() {
    const issues = [];
    
    // Check for basic features
    if (!document.createElement('canvas').getContext) {
        issues.push('Canvas not supported');
    }
    
    if (!window.requestAnimationFrame && !window.setTimeout) {
        issues.push('Animation not supported');
    }
    
    if (!window.addEventListener) {
        issues.push('Event listeners not supported');
    }
    
    // Check for touch events on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !('ontouchstart' in window)) {
        issues.push('Touch events may not work properly');
    }
    
    // Safari-specific checks
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
        console.log('Safari detected - using compatibility mode');
    }
    
    if (issues.length > 0) {
        console.warn('Browser compatibility issues:', issues);
        return false;
    }
    
    console.log('Browser compatibility check passed');
    return true;
}

// Run check when script loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const compatible = checkBrowserCompatibility();
        if (!compatible) {
            const message = 'Your browser may not support all game features. For best experience, please use Chrome, Firefox, or Safari (latest versions).';
            console.warn(message);
            
            // Show warning to user
            const warningDiv = document.createElement('div');
            warningDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; right: 10px; background: #ff9800; color: white; padding: 10px; border-radius: 5px; z-index: 1000; font-family: Arial, sans-serif; font-size: 14px;';
            warningDiv.innerHTML = message + ' <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>';
            document.body.appendChild(warningDiv);
            
            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (warningDiv.parentElement) {
                    warningDiv.remove();
                }
            }, 10000);
        }
    });
}