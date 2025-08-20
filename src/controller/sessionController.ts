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
 * See the License for the specific language governing permclearSessionissions and
 * limitations under the License.
 */
import { Message, Whatsapp } from '@wppconnect-team/wppconnect';
import { Request, Response } from 'express';
import fs from 'fs';
import mime from 'mime-types';
import QRCode from 'qrcode';
import { Logger } from 'winston';

import { version } from '../../package.json';
import config from '../config';
import CreateSessionUtil from '../util/createSessionUtil';
import { callWebHook, contactToArray } from '../util/functions';
import getAllTokens from '../util/getAllTokens';
import { clientsArray, deleteSessionOnArray } from '../util/sessionUtil';

const SessionUtil = new CreateSessionUtil();

async function downloadFileFunction(
  message: Message,
  client: Whatsapp,
  logger: Logger
) {
  try {
    const buffer = await client.decryptFile(message);

    const filename = `./WhatsAppImages/file${message.t}`;
    if (!fs.existsSync(filename)) {
      let result = '';
      if (message.type === 'ptt') {
        result = `${filename}.oga`;
      } else {
        result = `${filename}.${mime.extension(message.mimetype)}`;
      }

      await fs.writeFile(result, buffer, (err) => {
        if (err) {
          logger.error(err);
        }
      });

      return result;
    } else {
      return `${filename}.${mime.extension(message.mimetype)}`;
    }
  } catch (e) {
    logger.error(e);
    logger.warn(
      'Erro ao descriptografar a midia, tentando fazer o download direto...'
    );
    try {
      const buffer = await client.downloadMedia(message);
      const filename = `./WhatsAppImages/file${message.t}`;
      if (!fs.existsSync(filename)) {
        let result = '';
        if (message.type === 'ptt') {
          result = `${filename}.oga`;
        } else {
          result = `${filename}.${mime.extension(message.mimetype)}`;
        }

        await fs.writeFile(result, buffer, (err) => {
          if (err) {
            logger.error(err);
          }
        });

        return result;
      } else {
        return `${filename}.${mime.extension(message.mimetype)}`;
      }
    } catch (e) {
      logger.error(e);
      logger.warn('Não foi possível baixar a mídia...');
    }
  }
}

export async function download(message: any, client: any, logger: any) {
  try {
    const path = await downloadFileFunction(message, client, logger);
    return path?.replace('./', '');
  } catch (e) {
    logger.error(e);
  }
}

export async function startAllSessions(
  req: Request,
  res: Response
): Promise<any> {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.autoBody=false
     #swagger.operationId = 'startAllSessions'
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["secretkey"] = {
      schema: 'THISISMYSECURECODE'
     }
   */
  const { secretkey } = req.params;
  const { authorization: token } = req.headers;

  let tokenDecrypt = '';

  if (secretkey === undefined) {
    tokenDecrypt = (token).split(' ')[0];
  } else {
    tokenDecrypt = secretkey;
  }

  const allSessions = await getAllTokens(req);

  if (tokenDecrypt !== req.serverOptions.secretKey) {
    res.status(400).json({
      response: 'error',
      message: 'The token is incorrect',
    });
  }

  allSessions.map(async (session: string) => {
    const util = new CreateSessionUtil();
    await util.opendata(req, session);
  });

  return await res
    .status(201)
    .json({ status: 'success', message: 'Starting all sessions' });
}

export async function showAllSessions(
  req: Request,
  res: Response
): Promise<any> {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.autoBody=false
     #swagger.operationId = 'showAllSessions'
     #swagger.autoQuery=false
     #swagger.autoHeaders=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["secretkey"] = {
      schema: 'THISISMYSECURETOKEN'
     }
   */
  const { secretkey } = req.params;
  const { authorization: token } = req.headers;

  let tokenDecrypt: any = '';

  if (secretkey === undefined) {
    tokenDecrypt = token?.split(' ')[0];
  } else {
    tokenDecrypt = secretkey;
  }

  const arr: any = [];

  if (tokenDecrypt !== req.serverOptions.secretKey) {
    res.status(400).json({
      response: false,
      message: 'The token is incorrect',
    });
  }

  Object.keys(clientsArray).forEach((item) => {
    arr.push({ session: item });
  });

  res.status(200).json({ response: await getAllTokens(req) });
}

export async function startSession(req, res): Promise<any> {
  console.log('[DEBUG] startSession function called');
  console.log('[DEBUG] Session:', req.session);
  console.log('[DEBUG] Request body:', req.body);
  /**
   * #swagger.tags = ["Auth"]
     #swagger.autoBody=false
     #swagger.operationId = 'startSession'
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              webhook: { type: "string" },
              waitQrCode: { type: "boolean" },
            }
          },
          example: {
            webhook: "",
            waitQrCode: false,
          }
        }
      }
     }
   */
  const session = req.params.session;
  const { waitQrCode = false } = req.body;

  try {
    req.logger.info(
      `[SESSION-START] Initiating session ${session} with autoClose: 0`
    );
    req.logger.info(`[SESSION-START] waitQrCode: ${waitQrCode}`);
    req.logger.info(`[SESSION-START] Request body:`, JSON.stringify(req.body));

    // Start session without timeout for QR scanning
    req.logger.info(`[SESSION-START] Getting session state for ${session}`);
    await getSessionState(req, res);
    req.logger.info(
      `[SESSION-START] Session state retrieved, opening session data for ${session}`
    );
    await SessionUtil.opendata(req, session, waitQrCode ? res : null);
    req.logger.info(
      `[SESSION-START] Session data opened successfully for ${session}`
    );

    // If we get here, session started successfully
    req.logger.info(`[SESSION-START] Session ${session} started successfully`);
    if (!res.headersSent) {
      res.status(200).json({
        status: 'success',
        message: `Session ${session} started successfully`,
        session: session,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    req.logger.error(
      `[SESSION-START] Error starting session ${session}:`,
      errorMessage
    );
    req.logger.error(
      `[SESSION-START] Error stack:`,
      error instanceof Error ? error.stack : 'No stack trace'
    );
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: `Failed to start session ${session}: ${errorMessage}`,
        session: session,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export async function closeSession(req, res): Promise<any> {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.operationId = 'closeSession'
     #swagger.autoBody=true
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  const session = req.session;
  
  req.logger.info(`[CLOSE-SESSION] Starting session closure for: ${session}`);
  
  try {
    // Check if session exists in clientsArray
    const sessionClient = (clientsArray)[session];
    
    req.logger.info(`[CLOSE-SESSION] Session client found: ${!!sessionClient}, Status: ${sessionClient?.status}`);
    
    if (!sessionClient || sessionClient.status === null) {
      // Session already closed or doesn't exist
      req.logger.info(`[CLOSE-SESSION] Session ${session} already closed or doesn't exist`);
      return await res
        .status(200)
        .json({ status: true, message: 'Session successfully closed' });
    } else {
      // Mark session as closed
      (clientsArray)[session] = { status: null };
      req.logger.info(`[CLOSE-SESSION] Marked session ${session} as closed`);

      // Close the client if it exists
      if (req.client && typeof req.client.close === 'function') {
        req.logger.info(`[CLOSE-SESSION] Closing client for session ${session}`);
        await req.client.close();
      }
      
      req.io.emit('whatsapp-status', false);
      
      // Call webhook if client exists
      if (req.client) {
        callWebHook(req.client, req, 'closesession', {
          message: `Session: ${session} disconnected`,
          connected: false,
        });
      }

      req.logger.info(`[CLOSE-SESSION] Session ${session} closed successfully`);
      return await res
        .status(200)
        .json({ status: true, message: 'Session successfully closed' });
    }
  } catch (error) {
    req.logger.error(`[CLOSE-SESSION] Error closing session ${session}:`, error);
    return await res
      .status(500)
      .json({ status: false, message: 'Error closing session', error: (error as Error).message });
  }
}

export async function logOutSession(req, res): Promise<any> {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.operationId = 'logoutSession'
   * #swagger.description = 'This route logout and delete session data'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  const session = req.session;
  
  req.logger.info(`[LOGOUT-SESSION] Starting session logout and deletion for: ${session}`);
  
  try {
    // First logout the WhatsApp client if it exists and is connected
    if (req.client && typeof req.client.logout === 'function') {
      req.logger.info(`[LOGOUT-SESSION] Logging out WhatsApp client for session: ${session}`);
      try {
        await req.client.logout();
      } catch (logoutError) {
        req.logger.warn(`[LOGOUT-SESSION] Client logout failed (session may be inactive): ${(logoutError as Error).message}`);
      }
    } else {
      req.logger.info(`[LOGOUT-SESSION] No active client found for session: ${session}, proceeding with cleanup`);
    }
    
    // Remove from sessions array and force cleanup from all registries
    deleteSessionOnArray(req.session);
    req.logger.info(`[LOGOUT-SESSION] Removed session ${session} from array`);
    
    // Force remove from WPPConnect internal registry
    try {
      const { clientsArray } = require('../util/sessionUtil');
      if (clientsArray[req.session]) {
        delete clientsArray[req.session];
        req.logger.info(`[LOGOUT-SESSION] Force removed ${session} from WPPConnect registry`);
      }
    } catch (registryError) {
      req.logger.warn(`[LOGOUT-SESSION] Registry cleanup warning: ${(registryError as Error).message}`);
    }

    // Clean up session files and data comprehensively
    const pathUserData = config.customUserDataDir + req.session;
    const pathTokens = __dirname + `../../../tokens/${req.session}.data.json`;
    const pathTokensDir = __dirname + `../../../tokens/${req.session}`;
    const pathWppTokens = __dirname + `../../../wppconnect_tokens/${req.session}`;
    const pathUploads = __dirname + `../../../uploads/${req.session}`;
    
    // Array of all possible session paths
    const sessionPaths = [
      pathUserData,
      pathTokens,
      pathTokensDir,
      pathWppTokens,
      pathUploads,
      `./userDataDir/${req.session}`,
      `./tokens/${req.session}`,
      `./tokens/${req.session}.data.json`,
      `./wppconnect_tokens/${req.session}`,
      `./uploads/${req.session}`
    ];

    for (const sessionPath of sessionPaths) {
      if (fs.existsSync(sessionPath)) {
        req.logger.info(`[LOGOUT-SESSION] Removing session data: ${sessionPath}`);
        try {
          await fs.promises.rm(sessionPath, {
            recursive: true,
            maxRetries: 5,
            force: true,
            retryDelay: 1000,
          });
          req.logger.info(`[LOGOUT-SESSION] Successfully removed: ${sessionPath}`);
        } catch (cleanupError) {
          req.logger.warn(`[LOGOUT-SESSION] Failed to remove ${sessionPath}: ${(cleanupError as Error).message}`);
        }
      }
    }

    // Emit status change
    req.io.emit('whatsapp-status', false);
    
    // Call webhook if client exists
    if (req.client) {
      callWebHook(req.client, req, 'logoutsession', {
        message: `Session: ${session} logged out`,
        connected: false,
      });
    }

    req.logger.info(`[LOGOUT-SESSION] Session ${session} successfully logged out and deleted`);
    
    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      return res
        .status(200)
        .json({ status: true, message: 'Session successfully closed' });
    }
      
  } catch (error) {
    req.logger.error(`[LOGOUT-SESSION] Error logging out session ${session}:`, error);
    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ status: false, message: 'Error closing session', error: (error as Error).message });
    }
  }
}

export async function checkConnectionSession(
  req: Request,
  res: Response
): Promise<any> {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.operationId = 'CheckConnectionState'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  try {
    await req.client.isConnected();

    res.status(200).json({ status: true, message: 'Connected' });
  } catch (error) {
    res.status(200).json({ status: false, message: 'Disconnected' });
  }
}

export async function downloadMediaByMessage(req, res) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.operationId = 'downloadMediabyMessage'
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              messageId: { type: "string" },
            }
          },
          example: {
            messageId: '<messageId>'
          }
        }
      }
     }
   */
  const client = req.client;
  const { messageId } = req.body;

  let message;

  try {
    if (!messageId.isMedia || !messageId.type) {
      message = await client.getMessageById(messageId);
    } else {
      message = messageId;
    }

    if (!message)
      res.status(400).json({
        status: 'error',
        message: 'Message not found',
      });

    if (!(message['mimetype'] || message.isMedia || message.isMMS))
      res.status(400).json({
        status: 'error',
        message: 'Message does not contain media',
      });

    const buffer = await client.decryptFile(message);

    res
      .status(200)
      .json({ base64: buffer.toString('base64'), mimetype: message.mimetype });
  } catch (e) {
    req.logger.error(e);
    res.status(400).json({
      status: 'error',
      message: 'Decrypt file error',
      error: e,
    });
  }
}

export async function getMediaByMessage(req, res) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.operationId = 'getMediaByMessage'
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["session"] = {
      schema: 'messageId'
     }
   */
  const client = req.client;
  const { messageId } = req.params;

  try {
    const message = await client.getMessageById(messageId);

    if (!message)
      res.status(400).json({
        status: 'error',
        message: 'Message not found',
      });

    if (!(message['mimetype'] || message.isMedia || message.isMMS))
      res.status(400).json({
        status: 'error',
        message: 'Message does not contain media',
      });

    const buffer = await client.decryptFile(message);

    res
      .status(200)
      .json({ base64: buffer.toString('base64'), mimetype: message.mimetype });
  } catch (ex) {
    req.logger.error(ex);
    res.status(500).json({
      status: 'error',
      message: 'The session is not active',
      error: ex,
    });
  }
}

export async function getSessionState(req, res) {
  /**
     #swagger.tags = ["Auth"]
     #swagger.operationId = 'getSessionState'
     #swagger.summary = 'Retrieve status of a session'
     #swagger.autoBody = false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  try {
    const sessionName = req.params.session;
    const { waitQrCode = false } = req.body;
    
    // Get client from clientsArray instead of req.client
    const { clientsArray } = require('../util/sessionUtil');
    const client = clientsArray[sessionName];
    
    req.logger.info(`[STATUS-CHECK] Checking status for session: ${sessionName}`);
    req.logger.info(`[STATUS-CHECK] Client found: ${!!client}, Status: ${client?.status}`);
    
    const qr =
      client?.urlcode != null && client?.urlcode != ''
        ? await QRCode.toDataURL(client.urlcode, {
            errorCorrectionLevel: 'H' as const,
            type: 'image/png' as const,
            scale: 8,
            width: 512,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          })
        : null;

    // Return proper status based on actual client state
    if (!client) {
      req.logger.info(`[STATUS-CHECK] No client found for session: ${sessionName}`);
      res.status(200).json({ status: 'CLOSED', qrcode: null, message: 'Session not found' });
    } else {
      const actualStatus = client.status || 'INITIALIZING';
      req.logger.info(`[STATUS-CHECK] Returning status: ${actualStatus} for session: ${sessionName}`);
      
      res.status(200).json({
        status: actualStatus,
        qrcode: qr,
        urlcode: client.urlcode,
        version: version,
        sessionName: sessionName,
        timestamp: new Date().toISOString()
      });
    }
  } catch (ex) {
    req.logger.error(`[STATUS-CHECK] Error getting session state: ${ex}`);
    res.status(500).json({
      status: 'error',
      message: 'The session is not active',
      error: ex,
    });
  }
}

export async function getQrCode(req, res) {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.autoBody=false
     #swagger.operationId = 'getQrCode'
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  const session = req.params.session;

  try {
    req.logger.info(`[QR-REQUEST] QR code requested for session: ${session}`);

    // Get client from session array instead of req.client
    const { clientsArray } = require('../util/sessionUtil');
    const client = clientsArray[session];

    if (client?.urlcode || client?.qrcode) {
      req.logger.info(`[QR-REQUEST] QR code data found for session: ${session}`);
      req.logger.info(`[QR-REQUEST] urlcode present: ${!!client.urlcode}`);
      req.logger.info(`[QR-REQUEST] qrcode present: ${!!client.qrcode}`);
      req.logger.info(`[QR-REQUEST] Client status: ${client.status}`);
      
      if (client.qrcode) {
        req.logger.info(`[QR-REQUEST] QR code length: ${client.qrcode.length}`);
        req.logger.info(`[QR-REQUEST] QR code format: ${client.qrcode.substring(0, 30)}...`);
      }

      const acceptHeader = req.headers.accept || '';
      
      if (acceptHeader.includes('application/json')) {
        // Prioritize stored qrcode over generating new one
        let qrCodeData = client.qrcode;
        
        // Only generate if no stored QR code exists
        if (!qrCodeData && client.urlcode) {
          try {
            const qrOptions = {
              errorCorrectionLevel: 'H' as const,
              type: 'image/png' as const,
              scale: 8,
              width: 512,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            };
            qrCodeData = await QRCode.toDataURL(client.urlcode, qrOptions);
            req.logger.info(`[QR-REQUEST] Generated high-quality QR code from urlcode`);
          } catch (qrError) {
            req.logger.error(`[QR-REQUEST] QR generation failed: ${(qrError as Error).message}`);
          }
        }

        if (!qrCodeData) {
          return res.status(200).json({
            status: 'waiting',
            message: 'QR code is being generated, please wait...',
            session: session,
            state: client.status || 'INITIALIZING'
          });
        }

        req.logger.info(`[QR-REQUEST] Returning QR code - length: ${qrCodeData.length}`);
        
        // Store QR code in database
        try {
          const { storage } = require('../../server/mongodb');
          if (storage && qrCodeData) {
            await storage.updateSessionQRCode(session, qrCodeData);
            req.logger.info(`[QR-REQUEST] QR code saved to database for session: ${session}`);
          }
        } catch (dbError) {
          req.logger.warn(`[QR-REQUEST] Failed to save QR code to database: ${(dbError as Error).message}`);
        }
        
        return res.status(200).json({
          status: 'success',
          qrcode: qrCodeData,
          urlcode: client.urlcode || null,
          session: session,
          state: client.status || 'QRCODE',
          timestamp: new Date().toISOString()
        });
        
      } else {
        // PNG format response
        let qrDataURL = client.qrcode;
        
        if (!qrDataURL && client.urlcode) {
          const qrOptions = {
            errorCorrectionLevel: 'H' as const,
            type: 'image/png' as const,
            scale: 8,
            width: 512,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          };
          qrDataURL = await QRCode.toDataURL(client.urlcode, qrOptions);
          req.logger.info(`[QR-REQUEST] Generated high-quality QR code from urlcode`);
        }

        if (!qrDataURL) {
          throw new Error('No QR code data available');
        }

        // Generate fresh PNG directly from URL data to avoid corruption
        try {
          const freshQrBuffer = await QRCode.toBuffer(client.urlcode, {
            errorCorrectionLevel: 'H',
            type: 'png',
            scale: 8,
            width: 512,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          req.logger.info(`[QR-REQUEST] Fresh PNG buffer generated - Size: ${freshQrBuffer.length} bytes`);
          
          // Store QR code in database as base64
          try {
            const { storage } = require('../../server/mongodb');
            if (storage && freshQrBuffer) {
              const qrCodeBase64 = `data:image/png;base64,${freshQrBuffer.toString('base64')}`;
              await storage.updateSessionQRCode(session, qrCodeBase64);
              req.logger.info(`[QR-REQUEST] QR code PNG saved to database for session: ${session}`);
            }
          } catch (dbError) {
            req.logger.warn(`[QR-REQUEST] Failed to save QR code PNG to database: ${(dbError as Error).message}`);
          }
          
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': freshQrBuffer.length,
          });
          res.end(freshQrBuffer);
          
        } catch (bufferError) {
          req.logger.error(`[QR-REQUEST] Buffer generation failed: ${(bufferError as Error).message}`);
          
          // Fallback to base64 conversion
          const base64Data = qrDataURL.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
          
          // Clean base64 string
          const cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
          
          // Validate base64 format
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
            req.logger.error(`[QR-REQUEST] Invalid base64 format after cleaning`);
            throw new Error('Invalid QR code format');
          }

          const img = Buffer.from(cleanBase64, 'base64');
          
          req.logger.info(`[QR-REQUEST] Fallback PNG created - Size: ${img.length} bytes`);

          // Store QR code in database as base64 (fallback)
          try {
            const { storage } = require('../../server/mongodb');
            if (storage && qrDataURL) {
              await storage.updateSessionQRCode(session, qrDataURL);
              req.logger.info(`[QR-REQUEST] QR code fallback saved to database for session: ${session}`);
            }
          } catch (dbError) {
            req.logger.warn(`[QR-REQUEST] Failed to save QR code fallback to database: ${(dbError as Error).message}`);
          }

          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length,
          });
          res.end(img);
        }
      }
    } else if (typeof client === 'undefined') {
      req.logger.warn(`[QR-REQUEST] Session not found: ${session}`);
      res.status(200).json({
        status: null,
        message: 'Session not started. Please, use the /start-session route, for initialization your session',
      });
    } else {
      req.logger.warn(
        `[QR-REQUEST] QR code not available for session: ${session}, status: ${client?.status}`
      );
      res.status(200).json({
        status: client?.status || 'INITIALIZING',
        message: 'QRCode is not available yet...',
      });
    }
  } catch (ex) {
    req.logger.error(
      `[QR-REQUEST] Error retrieving QRCode for session: ${session}`,
      ex
    );
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving QRCode',
      error: ex,
    });
  }
}

export async function killServiceWorker(req, res) {
  /**
   * #swagger.ignore=true
   * #swagger.tags = ["Messages"]
     #swagger.operationId = 'killServiceWorkier'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  try {
    res.status(200).json({ status: 'error', response: 'Not implemented yet' });
  } catch (ex) {
    req.logger.error(ex);
    res.status(500).json({
      status: 'error',
      message: 'The session is not active',
      error: ex,
    });
  }
}

export async function restartService(req, res) {
  /**
   * #swagger.ignore=true
   * #swagger.tags = ["Messages"]
     #swagger.operationId = 'restartService'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
   */
  try {
    res.status(200).json({ status: 'error', response: 'Not implemented yet' });
  } catch (ex) {
    req.logger.error(ex);
    res.status(500).json({
      status: 'error',
      response: { message: 'The session is not active', error: ex },
    });
  }
}

export async function subscribePresence(req, res) {
  /**
   * #swagger.tags = ["Misc"]
     #swagger.operationId = 'subscribePresence'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              isGroup: { type: "boolean" },
              all: { type: "boolean" },
            }
          },
          example: {
            phone: '5521999999999',
            isGroup: false,
            all: false,
          }
        }
      }
     }
   */
  try {
    const { phone, isGroup = false, all = false } = req.body;

    if (all) {
      let contacts;
      if (isGroup) {
        const groups = await req.client.getAllGroups(false);
        contacts = groups.map((p: any) => p.id._serialized);
      } else {
        const chats = await req.client.getAllContacts();
        contacts = chats.map((c: any) => c.id._serialized);
      }
      await req.client.subscribePresence(contacts);
    } else
      for (const contato of contactToArray(phone, isGroup)) {
        await req.client.subscribePresence(contato);
      }

    res.status(200).json({
      status: 'success',
      response: { message: 'Subscribe presence executed' },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error on subscribe presence',
      error: error,
    });
  }
}

export async function setOnlinePresence(req, res) {
  /**
   * #swagger.tags = ["Misc"]
     #swagger.operationId = 'setOnlinePresence'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              isOnline: { type: "boolean" },
            }
          },
          example: {
   isOnline: false,
          }
        }
      }
     }
   */
  try {
    const { isOnline = true } = req.body;

    await req.client.setOnlinePresence(isOnline);

    res.status(200).json({
      status: 'success',
      response: { message: 'Set Online Presence Successfully' },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error on set online presence',
      error: error,
    });
  }
}

export async function getSecretKey(req, res) {
  /**
   * #swagger.tags = ["Auth"]
     #swagger.operationId = 'getSecretKey'
     #swagger.autoBody=false
     #swagger.description = 'Get the current secret key for API authentication'
   */
  try {
    const config = require('../config').default;
    res.json({
      status: true,
      secretKey: config.secretKey,
      message: 'Secret key retrieved successfully'
    });
  } catch (error) {
    req.logger.error(error);
    res.status(500).json({
      status: false,
      message: 'Error retrieving secret key',
      error: (error as Error).message
    });
  }
}

export async function editBusinessProfile(req, res) {
  /**
   * #swagger.tags = ["Profile"]
     #swagger.operationId = 'editBusinessProfile'
   * #swagger.description = 'Edit your bussiness profile'
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["obj"] = {
      in: 'body',
      schema: {
        $adress: 'Av. Nossa Senhora de Copacabana, 315',
        $email: 'test@test.com.br',
        $categories: {
          $id: "133436743388217",
          $localized_display_name: "Artes e entretenimento",
          $not_a_biz: false,
        },
        $website: [
          "https://www.wppconnect.io",
          "https://www.teste2.com.br",
        ],
      }
     }
     
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              adress: { type: "string" },
              email: { type: "string" },
              categories: { type: "object" },
              websites: { type: "array" },
            }
          },
          example: {
            adress: 'Av. Nossa Senhora de Copacabana, 315',
            email: 'test@test.com.br',
            categories: {
              $id: "133436743388217",
              $localized_display_name: "Artes e entretenimento",
              $not_a_biz: false,
            },
            website: [
              "https://www.wppconnect.io",
              "https://www.teste2.com.br",
            ],
          }
        }
      }
     }
   */
  try {
    res.status(200).json(await req.client.editBusinessProfile(req.body));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error on edit business profile',
      error: error,
    });
  }
}
