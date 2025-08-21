import { ServerOptions } from './types/ServerOptions';

export default {
  secretKey:
    process.env.SECRET_KEY ||
    'SK_SIYADAH_WA_2025_PROD_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15),
  host: '0.0.0.0',
  port: process.env.PORT || '5000',
  deviceName: 'WppConnect',
  poweredBy: 'WPPConnect-Server',
  startAllSession: false,
  tokenStoreType: 'file',
  maxListeners: 15,
  customUserDataDir: './userDataDir/',
  webhook: {
    url: 'http://localhost:5000/webhook-test',
    autoDownload: true,
    uploadS3: false,
    readMessage: true,
    allUnreadOnStart: false,
    listenAcks: true,
    onPresenceChanged: true,
    onParticipantsChanged: true,
    onReactionMessage: true,
    onPollResponse: true,
    onRevokedMessage: true,
    onLabelUpdated: true,
    onSelfMessage: false,
    ignore: ['status@broadcast'],
  },
  websocket: {
    autoDownload: false,
    uploadS3: false,
  },
  chatwoot: {
    sendQrCode: true,
    sendStatus: true,
  },
  archive: {
    enable: false,
    waitTime: 10,
    daysToArchive: 45,
  },
  log: {
    level: 'info', // Optimized for performance - reduced from 'silly'
    logger: ['console', 'file'],
  },
  createOptions: {
    executablePath:
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    // Fixed QR behavior - generate once and wait for connection
    autoClose: 300000, // 5 minutes timeout - proper session management
    disableSpins: true,
    waitForLogin: true,
    // Controlled browser behavior
    headless: true,
    devtools: false,
    // QR should be generated once only
    logQR: true,
    disableWelcome: true,
    // Stop continuous QR regeneration
    refreshQR: false, // Prevent automatic QR refresh
    browserArgs: [
      // Core security and sandbox settings for Replit
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',

      // Stable process management (removed --single-process and --no-zygote)
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',

      // Memory and performance optimization for containers
      '--memory-pressure-off',
      '--max_old_space_size=2048',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',

      // Profile and session management
      '--user-data-dir=/tmp/chrome-user-data',
      '--disable-profile-directory-check',
      '--disable-process-singleton-dialog',
      '--no-first-run',
      '--disable-component-extensions-with-background-pages',

      // Reduced browser overhead
      '--disable-sync',
      '--disable-translate',
      '--disable-default-apps',
      '--disable-extensions',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--safebrowsing-disable-auto-update',

      // Network and certificate handling
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',

      // Additional stability flags for Replit
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-sync-preferences',
      '--disable-ipc-flooding-protection',
    ],
    /**
     * Example of configuring the linkPreview generator
     * If you set this to 'null', it will use global servers; however, you have the option to define your own server
     * Clone the repository https://github.com/wppconnect-team/wa-js-api-server and host it on your server with ssl
     *
     * Configure the attribute as follows:
     * linkPreviewApiServers: [ 'https://www.yourserver.com/wa-js-api-server' ]
     */
    linkPreviewApiServers: null,
  },
  mapper: {
    enable: false,
    prefix: 'tagone-',
  },
  db: {
    mongodbDatabase: 'tokens',
    mongodbCollection: '',
    mongodbUser: '',
    mongodbPassword: '',
    mongodbHost: '',
    mongoIsRemote: true,
    mongoURLRemote: '',
    mongodbPort: 27017,
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    redisPrefix: 'docker',
  },
  aws_s3: {
    region: 'sa-east-1' as any,
    access_key_id: null,
    secret_key: null,
    defaultBucketName: null,
    endpoint: null,
    forcePathStyle: null,
  },
} as unknown as ServerOptions;
