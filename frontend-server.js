const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Parse URL and remove query parameters
  let filePath = req.url.split('?')[0];
  
  // Default to index.html for root path
  if (filePath === '/') {
    filePath = '/index.html';
  }
  
  // Construct full file path
  const fullPath = path.join(__dirname, filePath);
  
  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  // Check if file exists
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    // Read and serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache' // Disable caching for development
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
  console.log(`WebSocket server should be running at ws://localhost:8080`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});