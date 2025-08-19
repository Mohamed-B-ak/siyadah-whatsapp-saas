/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { create, SocketState } from '@wppconnect-team/wppconnect';
import { Request } from 'express';

import { download } from '../controller/sessionController';
import { WhatsAppServer } from '../types/WhatsAppServer';
import chatWootClient from './chatWootClient';
import { autoDownload, callWebHook, startHelper } from './functions';
import { clientsArray, eventEmitter } from './sessionUtil';
import Factory from './tokenStore/factory';

// WEBHOOK RATE LIMITING AND LOOP PREVENTION SYSTEM
interface WebhookRateLimit {
  lastWebhookTime: number;
  webhookCount: number;
  hourlyResetTime: number;
  cooldownUntil: number;
  lastStatus: string;
  duplicateCount: number;
}

interface SessionProtectionState {
  lastProtectionTime: number;
  protectionCount: number;
  originalStatus: string;
  isInCooldown: boolean;
}

// Global tracking for webhook rate limiting
const webhookRateLimits: { [sessionId: string]: WebhookRateLimit } = {};
const protectionStates: { [sessionId: string]: SessionProtectionState } = {};

// Rate limiting configuration
const WEBHOOK_RATE_LIMIT = {
  MAX_WEBHOOKS_PER_HOUR: 10,
  COOLDOWN_DURATION: 5 * 60 * 1000, // 5 minutes
  DUPLICATE_THRESHOLD: 3,
  PROTECTION_COOLDOWN: 10 * 60 * 1000, // 10 minutes
  RESET_INTERVAL: 60 * 60 * 1000, // 1 hour
};

// Helper functions for rate limiting
function initializeRateLimit(sessionId: string): WebhookRateLimit {
  const now = Date.now();
  return {
    lastWebhookTime: 0,
    webhookCount: 0,
    hourlyResetTime: now + WEBHOOK_RATE_LIMIT.RESET_INTERVAL,
    cooldownUntil: 0,
    lastStatus: '',
    duplicateCount: 0,
  };
}

function initializeProtectionState(sessionId: string): SessionProtectionState {
  return {
    lastProtectionTime: 0,
    protectionCount: 0,
    originalStatus: '',
    isInCooldown: false,
  };
}

function shouldAllowWebhook(sessionId: string, status: string, logger: any): boolean {
  const now = Date.now();

  // Initialize if not exists
  if (!webhookRateLimits[sessionId]) {
    webhookRateLimits[sessionId] = initializeRateLimit(sessionId);
  }

  const rateLimit = webhookRateLimits[sessionId];

  // Reset hourly counters
  if (now >= rateLimit.hourlyResetTime) {
    rateLimit.webhookCount = 0;
    rateLimit.hourlyResetTime = now + WEBHOOK_RATE_LIMIT.RESET_INTERVAL;
    rateLimit.duplicateCount = 0;
    logger.info(`[${sessionId}] 🔄 Webhook rate limit reset`);
  }

  // Check cooldown period
  if (now < rateLimit.cooldownUntil) {
    logger.info(`[${sessionId}] 🚫 Webhook in cooldown until ${new Date(rateLimit.cooldownUntil).toLocaleTimeString()}`);
    return false;
  }

  // Check duplicate status
  if (rateLimit.lastStatus === status) {
    rateLimit.duplicateCount++;
    if (rateLimit.duplicateCount >= WEBHOOK_RATE_LIMIT.DUPLICATE_THRESHOLD) {
      rateLimit.cooldownUntil = now + WEBHOOK_RATE_LIMIT.COOLDOWN_DURATION;
      logger.info(`[${sessionId}] 🚫 Duplicate status detected (${status}), entering cooldown`);
      return false;
    }
  } else {
    rateLimit.duplicateCount = 0;
  }

  // Check hourly limit
  if (rateLimit.webhookCount >= WEBHOOK_RATE_LIMIT.MAX_WEBHOOKS_PER_HOUR) {
    logger.info(`[${sessionId}] 🚫 Webhook hourly limit reached (${WEBHOOK_RATE_LIMIT.MAX_WEBHOOKS_PER_HOUR})`);
    return false;
  }

  // Update tracking
  rateLimit.lastWebhookTime = now;
  rateLimit.webhookCount++;
  rateLimit.lastStatus = status;

  logger.info(`[${sessionId}] ✅ Webhook allowed (${rateLimit.webhookCount}/${WEBHOOK_RATE_LIMIT.MAX_WEBHOOKS_PER_HOUR})`);
  return true;
}

function shouldAllowAutoProtection(sessionId: string, statusFind: string, logger: any): boolean {
  const now = Date.now();

  // Initialize if not exists
  if (!protectionStates[sessionId]) {
    protectionStates[sessionId] = initializeProtectionState(sessionId);
  }

  const protectionState = protectionStates[sessionId];

  // Check if in cooldown
  if (protectionState.isInCooldown) {
    const timeSinceLastProtection = now - protectionState.lastProtectionTime;
    if (timeSinceLastProtection < WEBHOOK_RATE_LIMIT.PROTECTION_COOLDOWN) {
      logger.info(`[${sessionId}] 🛡️ Auto-protection in cooldown (${Math.round((WEBHOOK_RATE_LIMIT.PROTECTION_COOLDOWN - timeSinceLastProtection) / 1000)}s remaining)`);
      return false;
    } else {
      // Reset cooldown
      protectionState.isInCooldown = false;
      protectionState.protectionCount = 0;
      logger.info(`[${sessionId}] 🔄 Auto-protection cooldown ended`);
    }
  }

  // Check if same status being protected repeatedly
  if (protectionState.originalStatus === statusFind) {
    protectionState.protectionCount++;
    if (protectionState.protectionCount >= 3) {
      protectionState.isInCooldown = true;
      protectionState.lastProtectionTime = now;
      logger.info(`[${sessionId}] 🚫 Auto-protection loop detected, entering cooldown`);
      return false;
    }
  } else {
    protectionState.protectionCount = 1;
    protectionState.originalStatus = statusFind;
  }

  protectionState.lastProtectionTime = now;
  return true;
}

export default class CreateSessionUtil {
  startChatWootClient(client: any) {
    if (client.config.chatWoot && !client._chatWootClient)
      client._chatWootClient = new chatWootClient(
        client.config.chatWoot,
        client.session
      );
    return client._chatWootClient;
  }

  async createSessionUtil(
    req: any,
    clientsArray: any,
    session: string,
    res?: any
  ) {
    try {
      let client = this.getClient(session) as any;
      if (client.status != null && client.status !== 'CLOSED') return;
      client.status = 'INITIALIZING';
      client.config = req.body;

      const tokenStore = new Factory();
      const myTokenStore = tokenStore.createTokenStory(client);
      const tokenData = await myTokenStore.getToken(session);

      // we need this to update phone in config every time session starts, so we can ask for code for it again.
      myTokenStore.setToken(session, tokenData ?? {});

      this.startChatWootClient(client);

      if (req.serverOptions.customUserDataDir) {
        req.serverOptions.createOptions.puppeteerOptions = {
          userDataDir: req.serverOptions.customUserDataDir + session,
        };
      }

      const wppClient = await create(
        Object.assign(
          {},
          { tokenStore: myTokenStore },
          req.serverOptions.createOptions,
          {
            session: session,
            phoneNumber: client.config.phone ?? null,
            deviceName:
              client.config.phone == undefined // bug when using phone code this shouldn't be passed (https://github.com/wppconnect-team/wppconnect-server/issues/1687#issuecomment-2099357874)
                ? client.config?.deviceName ||
                  req.serverOptions.deviceName ||
                  'WppConnect'
                : undefined,
            poweredBy:
              client.config.phone == undefined // bug when using phone code this shouldn't be passed (https://github.com/wppconnect-team/wppconnect-server/issues/1687#issuecomment-2099357874)
                ? client.config?.poweredBy ||
                  req.serverOptions.poweredBy ||
                  'WPPConnect-Server'
                : undefined,
            // ENTERPRISE-GRADE SESSION MANAGEMENT
            autoClose: 0, // Completely disable auto-close for production stability
            disableSpins: true, // Prevent automatic session cleanup
            waitForLogin: true, // Wait for manual QR scan
            logQR: true, // Enable comprehensive QR logging
            disableWelcome: true, // Skip welcome screen for faster loading

            // Advanced session configuration
            createPathFileToken: false, // Don't create file tokens
            browserRevisionFallback: false, // Use exact browser version
            addBrowserArgs: [], // No additional args to avoid conflicts

            // QR Code specific settings
            qrMaxRetries: 5, // Allow multiple QR generation attempts
            qrRefreshS: 30, // Refresh QR every 30 seconds
            qrLogSkip: false, // Log all QR activities
            // Force disable auto-close at browser level - using environment-aware config
            browserArgs: [],
            // Add timeout for browser launch
            browserWS: undefined,
            puppeteerOptions: {
              headless: 'new', // Use new headless mode
              executablePath: (() => {
                // Environment detection for Chrome path configuration
                if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
                  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';
                  console.log('[CHROME-CONFIG] Render Platform - Chrome path:', chromePath);
                  return chromePath;
                } else if (process.env.REPLIT_DEV_DOMAIN) {
                  const chromePath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
                  console.log('[CHROME-CONFIG] Replit Platform - Chrome path:', chromePath);
                  return chromePath;
                } else {
                  const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
                  console.log('[CHROME-CONFIG] Default Platform - Chrome path:', chromePath);
                  return chromePath;
                }
              })(),
              args: (() => {
                const baseArgs = [
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                  '--disable-dev-shm-usage',
                  '--disable-gpu',
                  '--disable-web-security',
                  '--disable-features=VizDisplayCompositor',
                  '--remote-debugging-port=9222',
                  '--remote-debugging-address=0.0.0.0',
                  '--no-first-run',
                  '--disable-default-apps',
                  '--disable-extensions',
                  '--disable-sync',
                  '--disable-translate',
                  '--disable-background-networking',
                  '--memory-pressure-off',
                  '--user-data-dir=/tmp/chrome-user-data',
                  '--data-path=/tmp/chrome-data',
                  '--disk-cache-dir=/tmp/chrome-cache'
                ];

                if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
                  const renderArgs = [
                    ...baseArgs,
                    '--disable-accelerated-2d-canvas',
                    '--disable-accelerated-video-decode',
                    '--disable-background-mode'
                  ];
                  console.log('[CHROME-CONFIG] Render args:', renderArgs.join(' '));
                  return renderArgs;
                }

                console.log('[CHROME-CONFIG] Default args:', baseArgs.join(' '));
                return baseArgs;
              })(),
              timeout: 180000, // 3 minutes for stable initialization
              defaultViewport: { width: 1366, height: 768 }, // Standard viewport
              ignoreDefaultArgs: ['--enable-automation'], // Hide automation detection
            },
            catchLinkCode: (code: string) => {
              this.exportPhoneCode(req, client.config.phone, code, client, res);
            },
            catchQR: (
              base64Qr: any,
              asciiQR: any,
              attempt: any,
              urlCode: string
            ) => {
              req.logger.info(
                `[${session}] QR Code generated - Attempt ${attempt}`
              );

              // Store QR data for immediate access
              if (base64Qr && base64Qr.length > 100) {
                client.qrcode = base64Qr;
                client.urlcode = urlCode;
                this.exportQR(req, base64Qr, urlCode, client, res);
                req.logger.info(
                  `[${session}] QR Code ready for scanning`
                );
              } else {
                req.logger.warn(
                  `[${session}] Invalid QR Code data, retrying...`
                );
              }
            },
            onLoadingScreen: (percent: string, message: string) => {
              req.logger.info(`[${session}] ${percent}% - ${message}`);
            },
            statusFind: (statusFind: string) => {
              try {
                eventEmitter.emit(
                  `status-${client.session}`,
                  client,
                  statusFind
                );

                req.logger.info(`[${session}] Raw status received: ${statusFind}`);

                // RATE-LIMITED AUTO-CLOSE PROTECTION WITH LOOP PREVENTION
                const blockedStatuses = [
                  'autocloseCalled', 'TIMEOUT', 'browserClose', 'CLOSE', 'CLOSED',
                  'timeout', 'close', 'disconnect', 'error', 'failed'
                ];

                const shouldBlock = blockedStatuses.some(blocked => 
                  statusFind.toLowerCase().includes(blocked.toLowerCase())
                );

                if (shouldBlock) {
                  // Check if auto-protection should be allowed (prevents loops)
                  if (!shouldAllowAutoProtection(session, statusFind, req.logger)) {
                    req.logger.info(
                      `[${session}] 🚫 AUTO-CLOSE PROTECTION BLOCKED: ${statusFind} - Rate limited or in cooldown`
                    );
                    // Still update client status but don't trigger webhooks
                    client.status = statusFind === 'CLOSED' ? 'QRCODE' : statusFind;
                    return;
                  }

                  req.logger.info(
                    `[${session}] 🛡️ AUTO-CLOSE PROTECTION: ${statusFind} - Session preserved for QR scanning`
                  );

                  // Override with QR ready state
                  client.status = 'QRCODE';
                  client.qrcode = client.qrcode || 'pending';

                  // Emit protected status
                  eventEmitter.emit(`status-${client.session}`, client, 'QRCODE');

                  // Rate-limited webhook call
                  if (shouldAllowWebhook(session, 'QRCODE', req.logger)) {
                    callWebHook(client, req, 'status-find', {
                      status: 'QRCODE',
                      session: client.session,
                      protected: true,
                      originalStatus: statusFind,
                      rateLimited: true
                    });
                  } else {
                    req.logger.info(
                      `[${session}] 🚫 Webhook blocked for auto-protection - rate limit exceeded`
                    );
                  }
                  return; // Completely bypass closure
                }

                // Handle proper status transitions
                if (statusFind === 'CONNECTED' || statusFind === 'inChat') {
                  req.logger.info(`[${session}] ✅ Session connected successfully: ${statusFind}`);
                  client.status = 'CONNECTED';
                } else if (statusFind === 'qrReadSuccess' || statusFind === 'PAIRING') {
                  req.logger.info(`[${session}] 📱 QR scanned, pairing: ${statusFind}`);
                  client.status = 'PAIRING';
                } else if (statusFind === 'Session unpaired' || statusFind.includes('unpaired')) {
                  req.logger.info(`[${session}] 📱 Session ready for QR scanning: ${statusFind}`);
                  client.status = 'QRCODE';
                } else if (statusFind === 'desconnectedMobile') {
                  req.logger.info(`[${session}] 📱 Phone disconnected: ${statusFind}`);
                  client.status = 'DISCONNECTED';
                } else if (statusFind === 'DESTROYED') {
                  req.logger.info(`[${session}] ❌ Session destroyed: ${statusFind}`);
                  client.status = 'CLOSED';
                  client.qrcode = null;
                  if (client.close) client.close();
                  clientsArray[session] = undefined;
                } else {
                  req.logger.info(`[${session}] 🔄 Status update: ${statusFind}`);
                  // Keep session alive, don't mark as CLOSED
                  if (statusFind !== 'CLOSED') {
                    client.status = statusFind;
                  } else {
                    // Override CLOSED status to keep session alive
                    client.status = 'QRCODE';
                    req.logger.info(`[${session}] OVERRIDING CLOSED STATUS - keeping as QRCODE`);
                  }
                }

                // Rate-limited webhook call for normal status updates
                if (shouldAllowWebhook(session, client.status, req.logger)) {
                  callWebHook(client, req, 'status-find', {
                    status: client.status, // Use the processed status, not raw statusFind
                    session: client.session,
                    rateLimited: true
                  });
                } else {
                  req.logger.info(
                    `[${session}] 🚫 Webhook blocked for status update (${client.status}) - rate limit exceeded`
                  );
                }

              } catch (error) {
                req.logger.error(`[${session}] Error in statusFind: ${error}`);
              }
            },
          }
        )
      );

      client = clientsArray[session] = Object.assign(wppClient, client);
      await this.start(req, client);

      if (req.serverOptions.webhook.onParticipantsChanged) {
        await this.onParticipantsChanged(req, client);
      }

      if (req.serverOptions.webhook.onReactionMessage) {
        await this.onReactionMessage(client, req);
      }

      if (req.serverOptions.webhook.onRevokedMessage) {
        await this.onRevokedMessage(client, req);
      }

      if (req.serverOptions.webhook.onPollResponse) {
        await this.onPollResponse(client, req);
      }
      if (req.serverOptions.webhook.onLabelUpdated) {
        await this.onLabelUpdated(client, req);
      }
    } catch (e) {
      req.logger.warn(`[${session}] Session initialization warning: ${e}`);
      if (e instanceof Error && e.name == 'TimeoutError') {
        const client = this.getClient(session) as any;
        // Don't close session on timeout - keep it alive for QR scanning
        req.logger.info(`[${session}] Timeout during initialization - keeping session alive for QR scanning`);
        client.status = 'QRCODE'; // Keep session alive and ready for QR
        client.qrcode = 'pending'; // Mark as QR ready
      } else {
        // For other errors, also try to keep session alive
        const client = this.getClient(session) as any;
        if (client) {
          client.status = 'QRCODE';
          req.logger.info(`[${session}] Session error handled - marked as QRCODE ready`);
        }
      }
    }
  }

  async opendata(req: Request, session: string, res?: any) {
    await this.createSessionUtil(req, clientsArray, session, res);
  }

  exportPhoneCode(
    req: any,
    phone: any,
    phoneCode: any,
    client: WhatsAppServer,
    res?: any
  ) {
    eventEmitter.emit(`phoneCode-${client.session}`, phoneCode, client);

    Object.assign(client, {
      status: 'PHONECODE',
      phoneCode: phoneCode,
      phone: phone,
    });

    req.io.emit('phoneCode', {
      data: phoneCode,
      phone: phone,
      session: client.session,
    });

    callWebHook(client, req, 'phoneCode', {
      phoneCode: phoneCode,
      phone: phone,
      session: client.session,
    });

    if (res && !res._headerSent)
      res.status(200).json({
        status: 'phoneCode',
        phone: phone,
        phoneCode: phoneCode,
        session: client.session,
      });
  }

  exportQR(
    req: any,
    qrCode: any,
    urlCode: any,
    client: WhatsAppServer,
    res?: any
  ) {
    eventEmitter.emit(`qrcode-${client.session}`, qrCode, urlCode, client);

    // Store the QR data immediately
    const fullQrDataUrl = qrCode.startsWith('data:image/png;base64,') 
      ? qrCode 
      : `data:image/png;base64,${qrCode}`;

    Object.assign(client, {
      status: 'QRCODE',
      qrcode: fullQrDataUrl,
      urlcode: urlCode,
    });

    req.logger.info(`[${client.session}] QR Code stored - URL length: ${urlCode?.length || 0}`);
    req.logger.info(`[${client.session}] QR Data length: ${fullQrDataUrl.length}`);

    // AUTOMATIC QR CODE DATABASE STORAGE
    (async () => {
      try {
        // Import the storage module correctly
        const path = require('path');
        const mongodbPath = path.resolve(__dirname, '../../server/mongodb');
        const { storage } = require(mongodbPath);

        req.logger.info(`[QR-CAPTURE] 🔍 Attempting to save QR code for session: ${client.session}`);

        if (storage && typeof storage.updateSessionByName === 'function') {
          // Use updateSessionByName method for WPPConnect session names
          const updateResult = await storage.updateSessionByName(client.session, {
            qrCode: fullQrDataUrl,
            qrCodeGeneratedAt: new Date(),
            status: 'qr_ready'
          });

          if (updateResult) {
            req.logger.info(`[QR-CAPTURE] ✅ QR code automatically saved to database for session: ${client.session}`);
          } else {
            req.logger.warn(`[QR-CAPTURE] ⚠️ Session not found in database: ${client.session}`);
          }
        } else if (storage && typeof storage.updateSessionQRCode === 'function') {
          // Fallback to direct QR update method
          await storage.updateSessionQRCode(client.session, fullQrDataUrl);
          req.logger.info(`[QR-CAPTURE] ✅ QR code saved via updateSessionQRCode for session: ${client.session}`);
        } else {
          req.logger.warn(`[QR-CAPTURE] ❌ Storage update methods not available`);
          req.logger.warn(`[QR-CAPTURE] Storage methods:`, Object.getOwnPropertyNames(storage));
        }
      } catch (dbError) {
        req.logger.warn(`[QR-CAPTURE] ❌ Failed to save QR code to database: ${(dbError as Error).message}`);
        req.logger.warn(`[QR-CAPTURE] Error details:`, dbError);
      }
    })();

    req.io.emit('qrCode', {
      data: fullQrDataUrl,
      session: client.session,
    });

    callWebHook(client, req, 'qrcode', {
      qrcode: fullQrDataUrl,
      urlcode: urlCode,
      session: client.session,
    });

    if (res && !res._headerSent)
      res.status(200).json({
        status: 'qrcode',
        qrcode: fullQrDataUrl,
        urlcode: urlCode,
        session: client.session,
      });
  }

  async onParticipantsChanged(req: any, client: any) {
    await client.isConnected();
    await client.onParticipantsChanged((message: any) => {
      callWebHook(client, req, 'onparticipantschanged', message);
    });
  }

  async start(req: Request, client: WhatsAppServer) {
    try {
      await client.isConnected();
      Object.assign(client, { status: 'CONNECTED', qrcode: null });

      req.logger.info(`Started Session: ${client.session}`);
      //callWebHook(client, req, 'session-logged', { status: 'CONNECTED'});
      req.io.emit('session-logged', { status: true, session: client.session });
      startHelper(client, req);
    } catch (error) {
      req.logger.error(error);
      req.io.emit('session-error', client.session);
    }

    await this.checkStateSession(client, req);
    await this.listenMessages(client, req);

    if (req.serverOptions.webhook.listenAcks) {
      await this.listenAcks(client, req);
    }

    if (req.serverOptions.webhook.onPresenceChanged) {
      await this.onPresenceChanged(client, req);
    }
  }

  async checkStateSession(client: WhatsAppServer, req: Request) {
    await client.onStateChange((state) => {
      req.logger.info(`State Change ${state}: ${client.session}`);
      const conflits = [SocketState.CONFLICT];

      if (conflits.includes(state)) {
        client.useHere();
      }
    });
  }

  async listenMessages(client: WhatsAppServer, req: Request) {
    await client.onMessage(async (message: any) => {
      req.logger.info(
        `[MESSAGE-RECEIVED] Session: ${client.session}, From: ${message.from}, Body: ${message.body}`
      );

      // Add session info to message
      message.session = client.session;

      eventEmitter.emit(`mensagem-${client.session}`, client, message);
      callWebHook(client, req, 'onmessage', message);

      if (message.type === 'location')
        client.onLiveLocation(message.sender.id, (location) => {
          callWebHook(client, req, 'location', location);
        });
    });

    await client.onAnyMessage(async (message: any) => {
      message.session = client.session;

      if (message.type === 'sticker') {
        download(message, client, req.logger);
      }

      if (
        req.serverOptions?.websocket?.autoDownload ||
        (req.serverOptions?.webhook?.autoDownload && message.fromMe == false)
      ) {
        await autoDownload(client, req, message);
      }

      req.io.emit('received-message', { response: message });
      if (req.serverOptions.webhook.onSelfMessage && message.fromMe)
        callWebHook(client, req, 'onselfmessage', message);
    });

    await client.onIncomingCall(async (call) => {
      req.io.emit('incomingcall', call);
      callWebHook(client, req, 'incomingcall', call);
    });
  }

  async listenAcks(client: WhatsAppServer, req: Request) {
    await client.onAck(async (ack) => {
      req.io.emit('onack', ack);
      callWebHook(client, req, 'onack', ack);
    });
  }

  async onPresenceChanged(client: WhatsAppServer, req: Request) {
    await client.onPresenceChanged(async (presenceChangedEvent) => {
      req.io.emit('onpresencechanged', presenceChangedEvent);
      callWebHook(client, req, 'onpresencechanged', presenceChangedEvent);
    });
  }

  async onReactionMessage(client: WhatsAppServer, req: Request) {
    await client.isConnected();
    await client.onReactionMessage(async (reaction: any) => {
      req.io.emit('onreactionmessage', reaction);
      callWebHook(client, req, 'onreactionmessage', reaction);
    });
  }

  async onRevokedMessage(client: WhatsAppServer, req: Request) {
    await client.isConnected();
    await client.onRevokedMessage(async (response: any) => {
      req.io.emit('onrevokedmessage', response);
      callWebHook(client, req, 'onrevokedmessage', response);
    });
  }
  async onPollResponse(client: WhatsAppServer, req: Request) {
    await client.isConnected();
    await client.onPollResponse(async (response: any) => {
      req.io.emit('onpollresponse', response);
      callWebHook(client, req, 'onpollresponse', response);
    });
  }
  async onLabelUpdated(client: WhatsAppServer, req: Request) {
    await client.isConnected();
    await client.onUpdateLabel(async (response: any) => {
      req.io.emit('onupdatelabel', response);
      callWebHook(client, req, 'onupdatelabel', response);
    });
  }

  encodeFunction(data: any, webhook: any) {
    data.webhook = webhook;
    return JSON.stringify(data);
  }

  decodeFunction(text: any, client: any) {
    const object = JSON.parse(text);
    if (object.webhook && !client.webhook) client.webhook = object.webhook;
    delete object.webhook;
    return object;
  }

  getClient(session: any) {
    let client = clientsArray[session];

    if (!client)
      client = clientsArray[session] = {
        status: null,
        session: session,
      } as any;
    return client;
  }
}