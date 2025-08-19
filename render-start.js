
#!/usr/bin/env node

// Render.com startup script
console.log('=== Render.com Deployment Startup ===');

// Set environment variables for Render
process.env.NODE_ENV = 'production';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/google-chrome';
process.env.RENDER = 'true';
process.env.CHROME_BIN = '/usr/bin/google-chrome';

// Verify Chrome installation
const { execSync } = require('child_process');

try {
  const chromeVersion = execSync('/usr/bin/google-chrome --version', { encoding: 'utf8' });
  console.log('✅ Chrome installed:', chromeVersion.trim());
} catch (error) {
  console.log('❌ Chrome not found:', error.message);
  process.exit(1);
}

// Create required directories
const fs = require('fs');
const dirs = ['/tmp/chrome-user-data', '/tmp/chrome-data', '/tmp/chrome-cache', './logs', './tokens', './uploads', './userDataDir'];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Set permissions for Chrome directories
try {
  execSync('chmod -R 755 /tmp/chrome-user-data /tmp/chrome-data /tmp/chrome-cache', { encoding: 'utf8' });
  console.log('✅ Chrome directory permissions set');
} catch (error) {
  console.log('⚠️ Warning: Could not set Chrome directory permissions');
}

// Start the application
console.log('🚀 Starting WhatsApp SaaS Platform...');
require('./dist/server.js');
