# Production Deployment Checklist

## Pre-Deployment

### Backend (Render)
- [ ] Update `config.js` with production CORS origins
- [ ] Set environment variables in Render dashboard
- [ ] Test health check endpoint locally
- [ ] Verify WebSocket connections work with WSS
- [ ] Review server logs for any errors
- [ ] Confirm graceful shutdown handling

### Frontend (GitHub Pages)
- [ ] Update WebSocket URL in `app.js` with actual Render URL
- [ ] Test cross-origin WebSocket connections
- [ ] Verify HTTPS compatibility
- [ ] Test on multiple browsers and devices
- [ ] Confirm responsive design works
- [ ] Check browser compatibility warnings

## Deployment Steps

### 1. Backend Deployment
1. Push code to GitHub repository
2. Connect repository to Render
3. Configure environment variables:
   - `NODE_ENV=production`
   - `PORT` (auto-configured)
4. Deploy and verify health check
5. Test WebSocket connections
6. Note the deployment URL

### 2. Frontend Deployment
1. Update `app.js` with Render URL
2. Commit and push to main branch
3. Verify GitHub Actions workflow runs
4. Check GitHub Pages deployment
5. Test end-to-end functionality

## Post-Deployment Verification

### Functional Testing
- [ ] Create game room successfully
- [ ] Join room with controller
- [ ] Motion calibration works
- [ ] Real-time motion detection
- [ ] Game physics and scoring
- [ ] Audio feedback
- [ ] Error handling and reconnection
- [ ] Cross-device compatibility

### Performance Testing
- [ ] WebSocket latency < 100ms
- [ ] Smooth 60fps gameplay
- [ ] Memory usage within limits
- [ ] Server handles multiple rooms
- [ ] Graceful handling of disconnections

### Security Testing
- [ ] HTTPS/WSS connections only
- [ ] CORS properly configured
- [ ] Input validation working
- [ ] No sensitive data exposed
- [ ] Error messages don't leak info

## Monitoring Setup

### Health Monitoring
- [ ] Health check endpoint responding
- [ ] Set up monitoring script (optional)
- [ ] Configure alert webhooks (optional)
- [ ] Monitor server logs
- [ ] Track room statistics

### Performance Monitoring
- [ ] Monitor WebSocket connection count
- [ ] Track room creation/deletion rates
- [ ] Monitor memory usage
- [ ] Check response times
- [ ] Monitor error rates

## Troubleshooting

### Common Issues
1. **WebSocket connection fails**
   - Check Render service status
   - Verify WSS URL is correct
   - Confirm CORS settings

2. **GitHub Pages not updating**
   - Check GitHub Actions status
   - Verify gh-pages branch exists
   - Confirm Pages settings

3. **Render service sleeping**
   - Free tier sleeps after 15 minutes
   - First connection may take 30+ seconds
   - Consider upgrading for production use

### Debug Tools
- Browser developer console
- Render service logs
- GitHub Actions logs
- Network tab for WebSocket inspection
- Health check endpoint

## Maintenance

### Regular Tasks
- [ ] Monitor server logs weekly
- [ ] Check error rates and patterns
- [ ] Review room statistics
- [ ] Update dependencies monthly
- [ ] Test backup/recovery procedures

### Scaling Considerations
- [ ] Monitor free tier limits
- [ ] Plan for traffic growth
- [ ] Consider CDN for frontend
- [ ] Evaluate database needs
- [ ] Plan for multiple server instances

## Emergency Procedures

### Service Outage
1. Check Render service status
2. Review recent deployments
3. Check GitHub Actions for frontend
4. Verify DNS/domain settings
5. Roll back if necessary

### High Error Rates
1. Check server logs for patterns
2. Monitor WebSocket connection failures
3. Verify client-side error handling
4. Check for DDoS or abuse
5. Implement rate limiting if needed

## Success Criteria

### Performance Targets
- [ ] WebSocket latency < 100ms
- [ ] 99% uptime (considering free tier limitations)
- [ ] < 5% error rate
- [ ] Support 10+ concurrent games
- [ ] Page load time < 3 seconds

### User Experience
- [ ] Intuitive device pairing
- [ ] Responsive motion controls
- [ ] Clear error messages
- [ ] Cross-platform compatibility
- [ ] Smooth gameplay experience

## Documentation Updates

After successful deployment:
- [ ] Update README with live URLs
- [ ] Document any configuration changes
- [ ] Update API documentation
- [ ] Create user guide
- [ ] Document troubleshooting steps