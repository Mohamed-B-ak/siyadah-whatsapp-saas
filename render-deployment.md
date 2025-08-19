# Render.com Deployment Guide

## Environment Variables Required

Set these environment variables in your Render.com service:

```bash
# Database
MONGODB_URI=your_mongodb_connection_string

# Chrome Configuration  
CHROME_BIN=/usr/bin/google-chrome
RENDER=true

# Application Settings
NODE_ENV=production
PORT=10000

# WhatsApp Configuration
WPP_MAX_SESSIONS=50
WPP_SESSION_TIMEOUT=300000

# Optional Webhook Settings
WEBHOOK_BASE_URL=https://your-app-name.onrender.com
```

## Build Settings

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Node Version:**
```
22.16.0
```

## Docker Configuration

The existing Dockerfile is already configured for Render deployment with:
- Google Chrome installation
- Node.js runtime
- All necessary dependencies

## System Requirements

- **Memory**: Minimum 512MB (recommended 1GB+)
- **CPU**: Standard instance
- **Disk Space**: At least 1GB for Chrome and dependencies

## Health Check

Render will automatically monitor:
- HTTP endpoint: `GET /api/health`
- Expected response: 200 OK with system status

## Important Notes

1. **Chrome Installation**: Render automatically provides Google Chrome
2. **Session Storage**: Uses MongoDB for persistent session storage
3. **File Uploads**: Temporary files are stored in `/tmp` (ephemeral)
4. **Logs**: Use `console.log` - Render captures all stdout/stderr
5. **Scaling**: Each instance maintains its own WhatsApp sessions

## Deployment Steps

1. Connect your GitHub repository to Render
2. Select "Web Service" 
3. Set environment variables listed above
4. Deploy with provided build/start commands
5. Monitor logs for successful Chrome initialization