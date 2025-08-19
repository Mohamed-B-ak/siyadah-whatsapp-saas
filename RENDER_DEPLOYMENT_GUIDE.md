# Render.com Deployment Guide

## 🚀 Complete Render Deployment Setup

Your WhatsApp SaaS platform is now optimized for production deployment on Render.com with the following improvements:

### ✅ Production-Ready Features Implemented

1. **Persistent Token Storage**
   - WhatsApp session tokens now stored in MongoDB GridFS
   - No dependency on local file system
   - Sessions persist across deployments and restarts

2. **Session Name Validation**
   - Automatic sanitization of session names for filesystem compatibility
   - Prevents double underscores and special characters
   - Length limits enforced (max 80 characters)

3. **Webhook Resilience System**
   - URL validation before webhook calls
   - Automatic retry logic with exponential backoff
   - Failed webhook detection and temporary disabling

4. **QR Code Polling Optimization**
   - Clear session status management (`INITIALIZING`, `QRCODE`, `CONNECTED`, etc.)
   - Smart polling intervals based on session state
   - Long-polling support to reduce API calls

5. **Chrome Browser Optimization**
   - Platform-specific Chrome arguments for Render
   - Memory optimization flags for limited cloud resources
   - Proper headless configuration

### 🔧 Deployment Configuration

#### Option 1: Using render.yaml (Recommended)
```yaml
services:
  - type: web
    name: siyadah-whatsapp-saas
    env: node
    region: oregon
    plan: starter
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: CHROME_BIN
        value: /usr/bin/google-chrome
      - key: RENDER
        value: true
    healthCheckPath: /api/health
```

#### Option 2: Manual Render Setup
1. Connect your GitHub repository
2. Set build command: `npm ci && npm run build`
3. Set start command: `npm start`
4. Add environment variables (see below)

### 📋 Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production
CHROME_BIN=/usr/bin/google-chrome
RENDER=true
PORT=10000

# MongoDB Database (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_saas

# Optional - Enhanced Security
SECRET_KEY=your-jwt-secret-key-here

# Optional - External Integrations
STRIPE_SECRET_KEY=sk_live_... (for payments)
AWS_ACCESS_KEY_ID=... (for file storage)
AWS_SECRET_ACCESS_KEY=... (for file storage)
```

### 🏗️ Build Process

The system includes optimized build commands:

```bash
# Development
npm run dev

# Production Build
npm run build:types  # TypeScript compilation
npm run build:js     # Babel transformation
npm run build        # Full build

# Production Start
npm start
```

### 📊 API Endpoints for Frontend Integration

#### Session Management
```bash
# Create session
POST /saas/api/sessions/{sessionName}/create

# Get session status (polling)
GET /saas/api/sessions/{sessionName}/status

# Get QR code with long polling
GET /saas/api/sessions/{sessionName}/qr-poll?timeout=30

# Send message
POST /saas/api/sessions/{sessionName}/send-message
```

#### Status Response Format
```json
{
  "success": true,
  "status": "qrcode",
  "qrCode": "data:image/png;base64,iVBOR...",
  "message": "QR code ready - scan with WhatsApp",
  "canRetry": true,
  "retryAfter": 3000,
  "shouldPoll": true
}
```

### 🔒 Security Features

- Session name validation and sanitization
- API key authentication at company and user levels
- Rate limiting with progressive penalties  
- Webhook URL validation to prevent SSRF attacks
- Chrome sandboxing with minimal privileges

### 🐳 Docker Deployment (Alternative)

A production-ready Dockerfile is included:

```bash
# Build image
docker build -t whatsapp-saas .

# Run container
docker run -p 10000:5000 \
  -e MONGODB_URI="your-mongodb-uri" \
  -e NODE_ENV=production \
  whatsapp-saas
```

### 🏥 Health Monitoring

Health check endpoint: `GET /api/health`
- MongoDB connection status
- System memory usage
- Active session count

### 🚨 Known Considerations

1. **First Deployment**: Allow 2-3 minutes for Chrome to initialize
2. **Memory Usage**: Start with Basic plan, upgrade if needed for multiple sessions
3. **Session Limits**: Monitor concurrent WhatsApp sessions based on plan limits
4. **Webhook URLs**: Ensure webhook endpoints are accessible from Render's IP ranges

### ✅ Deployment Checklist

- [ ] MongoDB Atlas cluster configured and accessible
- [ ] Environment variables set in Render dashboard
- [ ] Domain configured (optional, uses *.onrender.com by default)
- [ ] Webhook endpoints tested and accessible
- [ ] Health check endpoint responding at `/api/health`

Your system is production-ready for Render deployment with enterprise-grade reliability and performance optimizations.