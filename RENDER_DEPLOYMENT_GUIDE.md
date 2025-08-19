# Render.com Deployment Guide
## Siyadah WhatsApp Enterprise Platform

### Prerequisites

1. **MongoDB Atlas Database**
   - Create a MongoDB Atlas cluster
   - Whitelist render.com IP addresses
   - Get connection string (DATABASE_URL)

2. **Environment Variables Required**
   ```
   NODE_ENV=production
   DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/whatsapp_saas
   CHROME_BIN=/usr/bin/google-chrome-stable
   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   PORT=5000
   ```

### Deployment Options

#### Option 1: Using render.yaml (Recommended)
1. Push the project to GitHub
2. Connect render.com to your GitHub repository  
3. The `render.yaml` file will automatically configure:
   - Web service with Node.js environment
   - Chrome browser dependencies
   - MongoDB database connection
   - Health checks

#### Option 2: Manual Setup
1. Create new Web Service on render.com
2. Select your repository
3. Configure build settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Standard (required for browser dependencies)

### Browser Dependencies

The platform requires Chrome for WhatsApp Web automation. The `Dockerfile.render` includes:
- Google Chrome stable installation
- All required dependencies for headless browser operation
- Proper executable path configuration

### Important Notes

1. **Plan Requirements**: Standard plan or higher required for:
   - Sufficient memory for Chrome browser
   - Custom Dockerfile support
   - Extended build times

2. **Session Storage**: 
   - WhatsApp sessions stored in MongoDB
   - No local file dependencies
   - Automatic session cleanup

3. **Health Monitoring**:
   - Health check endpoint: `/api/health`
   - Automatic restarts on failure
   - 30-second interval checks

### Post-Deployment Configuration

1. **Webhook URLs**: Update webhook configurations to use your render.com URL
2. **Domain Setup**: Configure custom domain if needed
3. **SSL**: Automatic HTTPS provided by render.com
4. **Monitoring**: Check logs via render.com dashboard

### Troubleshooting

**Package Installation Issues**:
- **Error**: `npm ci` requires package-lock.json with lockfileVersion >= 1
- **Solution**: Updated to use `npm install --omit=dev` instead of `npm ci --only=production`
- **Alternative**: Use `npm install` if deployment still fails

**Chrome Issues**:
- Verify CHROME_BIN environment variable
- Check build logs for Chrome installation errors
- Ensure Standard plan or higher for sufficient resources

**Database Connection**:
- Verify MongoDB Atlas connection string
- Check IP whitelist settings
- Test connection from render.com environment

**Memory Issues**:
- Upgrade to higher plan if needed
- Monitor memory usage via dashboard
- Optimize session cleanup intervals

**Build Failures**:
- Check Node.js version compatibility (requires Node 22+)
- Verify all environment variables are set
- Review build logs for specific error messages
- Ensure package-lock.json is properly committed

### Performance Optimization

1. **Auto-scaling**: Enable auto-scaling for high traffic
2. **CDN**: Use render.com CDN for static assets
3. **Database Indexing**: Ensure proper MongoDB indexes
4. **Session Limits**: Configure appropriate session limits per plan

### Security Checklist

- [ ] Environment variables properly set
- [ ] MongoDB connection secured
- [ ] Webhook URLs using HTTPS
- [ ] API keys properly configured
- [ ] Rate limiting enabled
- [ ] Input validation active

### Support

For deployment issues:
1. Check render.com build logs
2. Verify all environment variables
3. Test MongoDB connection
4. Monitor resource usage
5. Review health check responses