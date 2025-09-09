# Deployment Guide

This document provides instructions for deploying the Situp Bird game to production environments.

## Architecture Overview

The application consists of two main components:
- **Backend**: Node.js WebSocket signaling server (deployed on Render)
- **Frontend**: Static web application (deployed on GitHub Pages)

## Backend Deployment (Render)

### Prerequisites
- Render account (free tier supported)
- GitHub repository with the server code

### Steps

1. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository containing this code

2. **Configure Service Settings**
   - **Name**: `situp-bird-server` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (or upgrade as needed)

3. **Environment Variables**
   - `NODE_ENV`: `production`
   - `PORT`: (automatically set by Render)

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy from your main branch
   - Note the deployment URL (e.g., `https://your-app-name.onrender.com`)

### Health Check
The server includes a health check endpoint at `/health` that Render can use to monitor the service.

## Frontend Deployment (GitHub Pages)

### Prerequisites
- GitHub repository with the frontend code
- GitHub Pages enabled for the repository

### Automatic Deployment

1. **Enable GitHub Actions**
   - The `.github/workflows/deploy.yml` file is already configured
   - Push to the `main` branch to trigger automatic deployment

2. **Update WebSocket URL**
   - In `app.js`, update the `renderUrl` variable with your actual Render deployment URL:
   ```javascript
   const renderUrl = 'your-app-name.onrender.com';
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `gh-pages` (created automatically by the workflow)

### Manual Deployment

If you prefer manual deployment:

1. **Build the frontend**
   ```bash
   mkdir dist
   cp index.html styles.css app.js dist/
   ```

2. **Update WebSocket URL in dist/app.js**
   - Replace `situp-bird-server.onrender.com` with your actual Render URL

3. **Deploy to GitHub Pages**
   - Push the `dist` folder contents to the `gh-pages` branch
   - Or use GitHub's web interface to upload files

## Configuration

### WebSocket URL Configuration

The frontend automatically detects the environment and uses appropriate WebSocket URLs:

- **Local Development**: `ws://localhost:8080`
- **GitHub Pages**: `wss://your-render-app.onrender.com`
- **Same Domain**: Uses the same host as the web page

### Security Considerations

1. **HTTPS/WSS**: Production deployment uses secure WebSocket connections (WSS)
2. **CORS**: The server includes CORS headers for cross-origin requests
3. **Error Handling**: Enhanced error logging and monitoring in production
4. **Rate Limiting**: Consider adding rate limiting for production use

## Monitoring and Logging

### Server Monitoring

The server includes production-ready logging:
- Timestamped log entries
- Connection tracking
- Room statistics
- Error reporting
- Health check endpoint

### Client-Side Error Handling

The frontend includes:
- Connection retry logic
- Detailed error messages
- Browser compatibility detection
- Graceful degradation

## Environment Variables

### Backend (Render)
- `NODE_ENV=production`: Enables production logging and optimizations
- `PORT`: Automatically set by Render

### Frontend
No environment variables needed - configuration is automatic based on deployment context.

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Verify the Render service is running
   - Check the WebSocket URL in the frontend code
   - Ensure WSS is used for HTTPS sites

2. **GitHub Pages Not Updating**
   - Check the GitHub Actions workflow status
   - Verify the `gh-pages` branch is created
   - Ensure GitHub Pages is enabled in repository settings

3. **Render Service Not Starting**
   - Check the build logs in Render dashboard
   - Verify `package.json` has correct start script
   - Ensure all dependencies are listed

### Debug Mode

For debugging, you can:
1. Check browser console for WebSocket connection errors
2. Monitor Render logs in the dashboard
3. Use the health check endpoint to verify server status

## Scaling Considerations

### Free Tier Limitations
- Render free tier: 512MB RAM, sleeps after 15 minutes of inactivity
- GitHub Pages: 1GB storage, 100GB bandwidth per month

### Optimization for Free Tier
- Automatic room cleanup (1 hour timeout)
- Connection pooling and efficient memory usage
- Minimal logging in production to reduce I/O

### Upgrading
For higher traffic, consider:
- Render paid plans for better performance and uptime
- CDN for frontend assets
- Database for persistent room storage
- Load balancing for multiple server instances

## Security Best Practices

1. **Input Validation**: All user inputs are validated
2. **Rate Limiting**: Consider implementing rate limiting
3. **Error Handling**: Errors don't expose internal details
4. **HTTPS Only**: Force HTTPS in production
5. **Regular Updates**: Keep dependencies updated

## Support

For deployment issues:
- Check the GitHub repository issues
- Review Render documentation
- Verify GitHub Pages configuration
- Test locally before deploying