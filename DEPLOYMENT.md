# Deployment Guide

## Production Deployment

### Docker Build Strategy
The project uses a production-optimized Docker build that:

- **Installs only production dependencies** (`--only=production`)
- **Excludes development tools** (Husky, ESLint, Jest, etc.)
- **Rebuilds native modules** (bcrypt, puppeteer-core, etc.) for the target environment
- **Uses Node.js 22.16.0** (exact version required by package.json)

### Render.com Deployment
1. Connect your GitHub repository to Render
2. Use the provided `Dockerfile` (no changes needed)
3. Set environment variables in Render dashboard:
   - `DATABASE_URL` (MongoDB connection string)
   - `NODE_ENV=production`
   - Any required API keys

### Environment Variables
Required for production:
- `DATABASE_URL`: MongoDB Atlas connection string
- `NODE_ENV`: Set to "production"
- `PORT`: Render sets this automatically (usually 10000)

Optional:
- `AWS_S3_*`: For file storage
- `WEBHOOK_*`: For external integrations
- `STRIPE_*`: For payment processing

### Local Development
For local development with git hooks:
```bash
git clone <repository>
cd <project>
./setup-dev.sh  # Sets up Husky git hooks
npm run dev     # Start development server
```

### Troubleshooting
- **bcrypt errors**: Ensure native module rebuild is working
- **Husky errors**: Should not occur in production (excluded from build)
- **Chrome/Puppeteer errors**: Check Docker Chrome installation