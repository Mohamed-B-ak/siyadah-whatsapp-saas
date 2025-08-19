/**
 * Environment Configuration for Multi-Platform Deployment
 * Supports Replit, Render.com, and local development
 */

export interface DeploymentConfig {
  baseUrl: string;
  isProduction: boolean;
  platform: 'replit' | 'render' | 'local';
  chromeExecutablePath: string;
  serverHost: string;
  serverPort: number;
}

export const getDeploymentConfig = (): DeploymentConfig => {
  // Detect deployment platform
  const platform = detectPlatform();
  const isProduction = platform !== 'local';
  
  return {
    baseUrl: getBaseUrlForPlatform(platform),
    isProduction,
    platform,
    chromeExecutablePath: getChromeExecutablePath(platform),
    serverHost: getServerHost(platform),
    serverPort: getServerPort()
  };
};

function detectPlatform(): 'replit' | 'render' | 'local' {
  if (process.env.REPLIT_DB_URL || process.env.REPLIT_DEV_DOMAIN) {
    return 'replit';
  }
  if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
    return 'render';
  }
  return 'local';
}

function getBaseUrlForPlatform(platform: 'replit' | 'render' | 'local'): string {
  switch (platform) {
    case 'render':
      return process.env.RENDER_EXTERNAL_URL || 'https://siyadah-whatsapp-saas.onrender.com';
    case 'replit':
      return process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://0.0.0.0:5000';
    case 'local':
    default:
      return 'http://0.0.0.0:5000';
  }
}

function getChromeExecutablePath(platform: 'replit' | 'render' | 'local'): string {
  switch (platform) {
    case 'render':
      return process.env.CHROME_BIN || '/usr/bin/google-chrome';
    case 'replit':
      return '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
    case 'local':
    default:
      return process.env.CHROME_BIN || 
             '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
  }
}

function getServerHost(platform: 'replit' | 'render' | 'local'): string {
  // Always bind to 0.0.0.0 for cloud deployments
  return platform === 'local' ? 'localhost' : '0.0.0.0';
}

function getServerPort(): number {
  return parseInt(process.env.PORT || '5000', 10);
}

// Browser arguments optimized for each platform
export const getBrowserArgs = (platform: 'replit' | 'render' | 'local'): string[] => {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--remote-debugging-port=9222',
    '--remote-debugging-address=0.0.0.0',
  ];

  const cloudArgs = [
    '--no-first-run',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--memory-pressure-off',
    '--max_old_space_size=4096',
  ];

  const replicArgs = [
    '--single-process', // Only safe on Replit
    '--no-zygote', // Only safe on Replit
    '--disable-ipc-flooding-protection',
  ];

  switch (platform) {
    case 'render':
      return [...baseArgs, ...cloudArgs];
    case 'replit':
      return [...baseArgs, ...cloudArgs, ...replicArgs];
    case 'local':
    default:
      return baseArgs;
  }
};

// Export singleton instance
export const deploymentConfig = getDeploymentConfig();

// Utility functions for backward compatibility
export const getBaseUrl = (): string => deploymentConfig.baseUrl;
export const isProduction = (): boolean => deploymentConfig.isProduction;
export const getPlatform = (): string => deploymentConfig.platform;