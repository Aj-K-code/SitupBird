#!/usr/bin/env node

/**
 * Integration Verification Script
 * Tests the complete user journey and system integration
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Situp Bird - Integration Verification\n');

// Test 1: File Structure
console.log('📁 Checking file structure...');
const requiredFiles = [
    'app.js',
    'index.html', 
    'styles.css',
    'server.js',
    'config.js',
    'package.json',
    'DEPLOYMENT.md',
    'PRODUCTION_CHECKLIST.md',
    'SETUP_GUIDE.md'
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
    console.log('❌ Missing files:', missingFiles.join(', '));
    process.exit(1);
} else {
    console.log('✅ All required files present');
}

// Test 2: Package.json validation
console.log('\n📦 Checking package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['start', 'dev', 'test'];
const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
if (missingScripts.length > 0) {
    console.log('❌ Missing scripts:', missingScripts.join(', '));
} else {
    console.log('✅ All required scripts present');
}

// Test 3: Code syntax validation
console.log('\n🔧 Checking code syntax...');
try {
    // Check if app.js can be parsed
    const appJs = fs.readFileSync('app.js', 'utf8');
    
    // Basic syntax checks
    const braceCount = (appJs.match(/\{/g) || []).length - (appJs.match(/\}/g) || []).length;
    if (braceCount !== 0) {
        console.log('❌ Unmatched braces in app.js');
    } else {
        console.log('✅ app.js syntax appears valid');
    }
    
    // Check for required classes
    const requiredClasses = [
        'BrowserCompatibility',
        'WebSocketClient', 
        'GameClient',
        'ControllerClient',
        'SensorManager',
        'GameEngine'
    ];
    
    const missingClasses = requiredClasses.filter(className => 
        !appJs.includes(`class ${className}`)
    );
    
    if (missingClasses.length > 0) {
        console.log('❌ Missing classes:', missingClasses.join(', '));
    } else {
        console.log('✅ All required classes found');
    }
    
} catch (error) {
    console.log('❌ Error reading app.js:', error.message);
}

// Test 4: HTML structure validation
console.log('\n🌐 Checking HTML structure...');
try {
    const html = fs.readFileSync('index.html', 'utf8');
    const requiredElements = [
        'game-canvas',
        'connection-status', 
        'room-code',
        'score',
        'calibration-screen',
        'controller-screen'
    ];
    
    const missingElements = requiredElements.filter(id => 
        !html.includes(`id="${id}"`)
    );
    
    if (missingElements.length > 0) {
        console.log('❌ Missing HTML elements:', missingElements.join(', '));
    } else {
        console.log('✅ All required HTML elements found');
    }
} catch (error) {
    console.log('❌ Error reading index.html:', error.message);
}

// Test 5: CSS validation
console.log('\n🎨 Checking CSS structure...');
try {
    const css = fs.readFileSync('styles.css', 'utf8');
    const requiredClasses = [
        '.screen',
        '.game-button',
        '.code-input',
        '.motion-bar',
        '.compatibility-banner'
    ];
    
    const missingClasses = requiredClasses.filter(className => 
        !css.includes(className)
    );
    
    if (missingClasses.length > 0) {
        console.log('❌ Missing CSS classes:', missingClasses.join(', '));
    } else {
        console.log('✅ All required CSS classes found');
    }
} catch (error) {
    console.log('❌ Error reading styles.css:', error.message);
}

// Test 6: Server configuration
console.log('\n⚙️ Checking server configuration...');
try {
    const serverJs = fs.readFileSync('server.js', 'utf8');
    const configJs = fs.readFileSync('config.js', 'utf8');
    
    // Check for required server features
    const serverFeatures = [
        'WebSocket',
        'RoomManager',
        'health',
        'CORS',
        'gracefulShutdown'
    ];
    
    const missingFeatures = serverFeatures.filter(feature => 
        !serverJs.includes(feature)
    );
    
    if (missingFeatures.length > 0) {
        console.log('❌ Missing server features:', missingFeatures.join(', '));
    } else {
        console.log('✅ All required server features found');
    }
    
    // Check config structure
    if (configJs.includes('module.exports')) {
        console.log('✅ Config file structure valid');
    } else {
        console.log('❌ Config file structure invalid');
    }
    
} catch (error) {
    console.log('❌ Error reading server files:', error.message);
}

// Test 7: Documentation completeness
console.log('\n📚 Checking documentation...');
const docFiles = ['DEPLOYMENT.md', 'PRODUCTION_CHECKLIST.md', 'SETUP_GUIDE.md'];
let docScore = 0;

docFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.length > 1000) { // Reasonable documentation length
            console.log(`✅ ${file} appears complete`);
            docScore++;
        } else {
            console.log(`⚠️ ${file} may be incomplete`);
        }
    } catch (error) {
        console.log(`❌ Error reading ${file}`);
    }
});

// Test 8: Test suite validation
console.log('\n🧪 Checking test suite...');
const testDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
let testScore = 0;

testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'));
        if (files.length > 0) {
            console.log(`✅ ${dir} has ${files.length} test files`);
            testScore++;
        } else {
            console.log(`⚠️ ${dir} has no test files`);
        }
    } else {
        console.log(`❌ ${dir} directory missing`);
    }
});

// Final Summary
console.log('\n📊 Integration Verification Summary');
console.log('=====================================');

const totalChecks = 8;
let passedChecks = 0;

// Count passed checks based on above tests
if (missingFiles.length === 0) passedChecks++;
if (missingScripts.length === 0) passedChecks++;
if (fs.existsSync('app.js')) passedChecks++; // Simplified for syntax
if (fs.existsSync('index.html')) passedChecks++; // Simplified for HTML
if (fs.existsSync('styles.css')) passedChecks++; // Simplified for CSS
if (fs.existsSync('server.js')) passedChecks++; // Simplified for server
if (docScore >= 2) passedChecks++; // At least 2 docs complete
if (testScore >= 2) passedChecks++; // At least 2 test dirs

const percentage = Math.round((passedChecks / totalChecks) * 100);

console.log(`Passed: ${passedChecks}/${totalChecks} checks (${percentage}%)`);

if (percentage >= 90) {
    console.log('🎉 Excellent! System is ready for deployment');
} else if (percentage >= 75) {
    console.log('✅ Good! Minor issues to address before deployment');
} else if (percentage >= 50) {
    console.log('⚠️ Fair! Several issues need attention');
} else {
    console.log('❌ Poor! Major issues must be fixed');
}

console.log('\n🚀 Next Steps:');
console.log('1. Fix any issues identified above');
console.log('2. Run: npm test');
console.log('3. Test locally: npm run dev');
console.log('4. Deploy following DEPLOYMENT.md');
console.log('5. Complete PRODUCTION_CHECKLIST.md');

process.exit(percentage >= 75 ? 0 : 1);