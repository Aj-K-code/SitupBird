#!/usr/bin/env node

// Simple monitoring script for production deployment
const http = require('http');
const https = require('https');

const config = {
  healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:8080/health',
  checkInterval: 30000, // 30 seconds
  alertThreshold: 3, // Alert after 3 consecutive failures
  logFile: process.env.LOG_FILE || null
};

let consecutiveFailures = 0;
let lastSuccessTime = Date.now();

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  if (config.logFile) {
    const fs = require('fs');
    fs.appendFileSync(config.logFile, logMessage + '\n');
  }
}

function checkHealth() {
  const url = new URL(config.healthCheckUrl);
  const client = url.protocol === 'https:' ? https : http;
  
  const startTime = Date.now();
  
  const req = client.get(config.healthCheckUrl, (res) => {
    const responseTime = Date.now() - startTime;
    
    if (res.statusCode === 200) {
      consecutiveFailures = 0;
      lastSuccessTime = Date.now();
      log(`Health check OK (${responseTime}ms) - Status: ${res.statusCode}`);
      
      // Parse response body for additional stats
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const stats = JSON.parse(body);
          log(`Server stats: Uptime: ${Math.round(stats.uptime)}s, Rooms: ${stats.rooms}`);
        } catch (e) {
          // Ignore JSON parse errors
        }
      });
    } else {
      consecutiveFailures++;
      log(`Health check FAILED - Status: ${res.statusCode} (${responseTime}ms)`);
      
      if (consecutiveFailures >= config.alertThreshold) {
        log(`ALERT: ${consecutiveFailures} consecutive failures detected!`);
        sendAlert(`Health check failing: ${consecutiveFailures} consecutive failures`);
      }
    }
  });
  
  req.on('error', (error) => {
    consecutiveFailures++;
    const responseTime = Date.now() - startTime;
    log(`Health check ERROR: ${error.message} (${responseTime}ms)`);
    
    if (consecutiveFailures >= config.alertThreshold) {
      log(`ALERT: ${consecutiveFailures} consecutive failures detected!`);
      sendAlert(`Health check error: ${error.message}`);
    }
  });
  
  req.setTimeout(10000, () => {
    req.destroy();
    consecutiveFailures++;
    log('Health check TIMEOUT (10s)');
    
    if (consecutiveFailures >= config.alertThreshold) {
      log(`ALERT: ${consecutiveFailures} consecutive failures detected!`);
      sendAlert('Health check timeout');
    }
  });
}

function sendAlert(message) {
  // In a real production environment, you would send alerts via:
  // - Email
  // - Slack webhook
  // - SMS
  // - Push notification service
  // - Monitoring service API (e.g., PagerDuty, Datadog)
  
  log(`ALERT TRIGGERED: ${message}`);
  
  // Example webhook alert (uncomment and configure for your service)
  /*
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (webhook) {
    const payload = JSON.stringify({
      text: `Situp Bird Server Alert: ${message}`,
      timestamp: new Date().toISOString(),
      consecutiveFailures: consecutiveFailures,
      lastSuccess: new Date(lastSuccessTime).toISOString()
    });
    
    // Send webhook request...
  }
  */
}

function getStatus() {
  const uptime = Date.now() - (Date.now() - process.uptime() * 1000);
  const timeSinceLastSuccess = Date.now() - lastSuccessTime;
  
  return {
    monitorUptime: Math.round(process.uptime()),
    consecutiveFailures: consecutiveFailures,
    lastSuccessTime: new Date(lastSuccessTime).toISOString(),
    timeSinceLastSuccess: Math.round(timeSinceLastSuccess / 1000),
    status: consecutiveFailures === 0 ? 'healthy' : 'unhealthy'
  };
}

// Start monitoring
log('Starting health check monitor...');
log(`Health check URL: ${config.healthCheckUrl}`);
log(`Check interval: ${config.checkInterval}ms`);
log(`Alert threshold: ${config.alertThreshold} failures`);

// Initial check
checkHealth();

// Schedule regular checks
setInterval(checkHealth, config.checkInterval);

// Status endpoint for the monitor itself
if (process.env.MONITOR_PORT) {
  const monitorServer = http.createServer((req, res) => {
    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getStatus(), null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  monitorServer.listen(process.env.MONITOR_PORT, () => {
    log(`Monitor status endpoint available on port ${process.env.MONITOR_PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Monitor shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Monitor shutting down...');
  process.exit(0);
});