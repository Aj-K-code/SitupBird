// Production configuration for Situp Bird
const config = {
  development: {
    port: 8080,
    logLevel: 'debug',
    corsOrigin: '*',
    roomCleanupInterval: 10 * 60 * 1000, // 10 minutes
    roomMaxAge: 60 * 60 * 1000, // 1 hour
    maxRooms: 100,
    maxConnectionsPerRoom: 2,
    enableHealthCheck: true,
    enableStats: false
  },
  
  production: {
    port: process.env.PORT || 8080,
    logLevel: 'info',
    corsOrigin: [
      'https://yourusername.github.io',
      'https://your-custom-domain.com'
    ],
    roomCleanupInterval: 5 * 60 * 1000, // 5 minutes (more frequent in production)
    roomMaxAge: 30 * 60 * 1000, // 30 minutes (shorter for free tier)
    maxRooms: 50, // Limit for free tier memory constraints
    maxConnectionsPerRoom: 2,
    enableHealthCheck: true,
    enableStats: true,
    statsInterval: 5 * 60 * 1000, // 5 minutes
    
    // Production optimizations
    websocketOptions: {
      perMessageDeflate: false, // Disable compression to save CPU
      maxPayload: 1024 * 16, // 16KB max message size
      clientTracking: true
    },
    
    // Error handling
    maxConsecutiveErrors: 10,
    errorReportingEnabled: true
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];