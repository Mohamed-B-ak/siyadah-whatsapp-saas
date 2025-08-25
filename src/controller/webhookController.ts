import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Store webhook logs in memory (in production, use a database)
let webhookLogs: any[] = [];

// Store current webhook URL for legacy compatibility
let currentWebhookUrl: string | null = null;

// Load webhook URL using proper database lookup for user isolation
async function loadWebhookUrl(sessionName?: string): Promise<string> {
  try {
    if (!sessionName) {
      console.log(`[WEBHOOK-LOAD] No session name provided`);
      return '';
    }

    // Import MongoDB storage for database lookup
    const { mongoStorage } = require('../../server/mongodb');
    
    console.log(`[WEBHOOK-LOAD] Looking up webhook for session: ${sessionName}`);
    
    // Find session in database to get company ID
    const session = await mongoStorage.getSessionByName(sessionName);
    if (!session) {
      console.log(`[WEBHOOK-LOAD] Session not found in database: ${sessionName}`);
      return '';
    }
    
    console.log(`[WEBHOOK-LOAD] Session found - Company ID: ${session.companyId}, User ID: ${session.userId}`);
    
    // Get company data to find webhook URL
    const company = await mongoStorage.getCompany(session.companyId);
    if (company && company.webhookUrl) {
      console.log(`[WEBHOOK-LOAD] ✅ Found company webhook: ${company.webhookUrl}`);
      return company.webhookUrl;
    }
    
    // Fallback: Check file-based storage for backward compatibility
    const webhookStorageFile = path.join(process.cwd(), 'webhook-storage.json');
    if (fs.existsSync(webhookStorageFile)) {
      const data = fs.readFileSync(webhookStorageFile, 'utf8');
      const storage = JSON.parse(data);
      
      // Look up by company's master API key
      if (company && storage[company.masterApiKey] && storage[company.masterApiKey].webhookUrl) {
        console.log(`[WEBHOOK-LOAD] ✅ Found file-based webhook for company ${company.masterApiKey}: ${storage[company.masterApiKey].webhookUrl}`);
        return storage[company.masterApiKey].webhookUrl;
      }
    }
    
    console.log(`[WEBHOOK-LOAD] ❌ No webhook configured for session: ${sessionName} (Company: ${session.companyId})`);
    return '';
    
  } catch (error) {
    console.error('[WEBHOOK-LOAD] Error loading webhook URL:', error);
    return '';
  }
}

export async function setWebhook(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Webhook"]
   * #swagger.summary = "Set webhook URL for receiving messages"
   * #swagger.description = "Configure webhook URL to receive incoming WhatsApp messages"
   * #swagger.parameters["session"] = {
   *   in: "path",
   *   required: true,
   *   type: "string",
   *   description: "Session name"
   * }
   * #swagger.requestBody = {
   *   required: true,
   *   content: {
   *     "application/json": {
   *       schema: {
   *         type: "object",
   *         properties: {
   *           url: { type: "string", format: "uri", description: "Webhook URL" }
   *         },
   *         required: ["url"]
   *       }
   *     }
   *   }
   * }
   */

  const session = req.params.session;
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      status: 'error',
      message: 'Webhook URL is required',
    });
  }

  try {
    // Store webhook URL for the session (in production, use database)
    // For now, just return success
    console.log(`[WEBHOOK] Setting webhook for session ${session}: ${url}`);

    res.json({
      status: 'success',
      message: 'Webhook configured successfully',
      session,
      webhookUrl: url,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to configure webhook',
      error: error.message,
    });
  }
}

export async function webhookTest(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Webhook"]
   * #swagger.summary = "Test webhook endpoint"
   * #swagger.description = "Endpoint to receive WhatsApp webhook messages"
   */

  console.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));

  const webhookData = {
    timestamp: new Date().toISOString(),
    event: req.body.event || 'message',
    session: req.body.session || 'unknown',
    from: req.body.from || req.body.phone || 'unknown',
    body: req.body.body || req.body.text || req.body.message || 'N/A',
    type: req.body.type || 'text',
    data: req.body,
  };

  // Enhanced logging
  console.log('📋 Processed webhook data:', {
    event: webhookData.event,
    from: webhookData.from,
    body: webhookData.body,
    type: webhookData.type,
  });

  // Store log
  webhookLogs.push(webhookData);

  // AUTOMATIC QR CODE DATABASE STORAGE
  console.log(`[QR-CAPTURE-DEBUG] Event: ${webhookData.event}, Has base64: ${!!req.body.base64}, Session: ${webhookData.session}`);
  
  if (webhookData.event === 'qrcode') {
    try {
      const path = require('path');
      const mongodbPath = path.resolve(__dirname, '../../server/mongodb');
      const { mongoStorage } = require(mongodbPath);
      
      const sessionName = webhookData.session;
      const qrBase64 = req.body.base64;
      
      console.log(`[QR-CAPTURE] 🔍 Attempting to save QR code for session: ${sessionName}`);
      console.log(`[QR-CAPTURE] Has QR base64 data: ${!!qrBase64}`);
      if (qrBase64) {
        console.log(`[QR-CAPTURE] QR data length: ${qrBase64.length}`);
      }
      
      // Prioritize saving just the URL code (more efficient than full PNG base64)
      let qrCodeData = req.body.urlcode || req.body.qrcode || qrBase64 || req.body.data?.urlcode || req.body.data?.qrcode;
      
      if (qrCodeData) {
        console.log(`[QR-CAPTURE] Saving QR code type: ${req.body.urlcode ? 'urlcode' : 'base64'} (${qrCodeData.length} chars)`);
        
        const updateResult = await mongoStorage.updateSessionByName(sessionName, {
          qrCode: qrCodeData,
          qrCodeGeneratedAt: new Date(),
          status: 'qr_ready'
        });
        
        if (updateResult) {
          console.log(`[QR-CAPTURE] ✅ QR code automatically saved to database for session: ${sessionName}`);
          console.log(`[QR-CAPTURE] Database ID: ${updateResult.id}`);
        } else {
          console.log(`[QR-CAPTURE] ⚠️ Session not found in database: ${sessionName}`);
        }
      } else {
        console.log(`[QR-CAPTURE] ⚠️ No QR code data found in webhook body`);
        console.log(`[QR-CAPTURE] Available fields:`, Object.keys(req.body));
      }
    } catch (dbError) {
      console.log(`[QR-CAPTURE] ❌ Failed to save QR code to database: ${(dbError as Error).message}`);
    }
  }

  // Emit via socket for real-time display
  if (req.io) {
    req.io.emit('webhook-received', webhookData);
    console.log('📡 Emitted webhook data via socket');
  }

  // Forward to user-specific webhook URL based on session (MESSAGES ONLY)
  const sessionName = req.body.session || req.body.sessionName;
  const webhookUrl = await loadWebhookUrl(sessionName);
  
  // Define message-related events that should be forwarded
  const messageEvents = [
    'onmessage',      // Incoming messages
  ];
  
  // Only forward message-related events, filter out QR codes and system events
  const eventType = webhookData.event || 'unknown';
  const shouldForward = messageEvents.includes(eventType);
  
  if (webhookUrl && shouldForward) {
    try {
      const axios = require('axios');
      
      await axios.post(webhookUrl, webhookData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Webhook-Bridge/1.0'
        }
      });
      console.log(`📬 Forwarded MESSAGE webhook to: ${webhookUrl} (event: ${eventType})`);
    } catch (error: any) {
      console.log(`⚠️ Failed to forward webhook to ${webhookUrl}: ${error.message || error}`);
    }
  } else if (webhookUrl && !shouldForward) {
    console.log(`🚫 Filtered webhook event: ${eventType} (not forwarded to ${webhookUrl})`);
  } else {
    console.log(`💡 No webhook URL configured for session: ${sessionName || 'unknown'}`);
  }

  res.json({
    status: 'success',
    message: 'Webhook received and processed',
    received: webhookData,
  });
}

export async function getWebhookLogs(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Webhook"]
   * #swagger.summary = "Get webhook logs"
   * #swagger.description = "Retrieve recent webhook activity logs"
   */

  res.json({
    status: 'success',
    logs: webhookLogs.slice(-20), // Return last 20 logs
    total: webhookLogs.length,
  });
}

export async function clearWebhookLogs(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Webhook"]
   * #swagger.summary = "Clear webhook logs"
   * #swagger.description = "Clear all webhook activity logs"
   */

  webhookLogs = [];

  res.json({
    status: 'success',
    message: 'Webhook logs cleared',
  });
}

export async function configureWebhook(req: Request, res: Response) {
  const { webhookUrl } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({
      success: false,
      message: 'Webhook URL is required'
    });
  }

  try {
    new URL(webhookUrl);
    currentWebhookUrl = webhookUrl;
    
    console.log(`🔧 Webhook URL configured: ${webhookUrl}`);
    
    res.json({
      success: true,
      message: 'Webhook URL configured successfully',
      webhookUrl: webhookUrl
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid webhook URL format'
    });
  }
}

export async function getWebhookConfig(req: Request, res: Response) {
  res.json({
    success: true,
    webhookUrl: currentWebhookUrl || 'Not configured',
    isConfigured: !!currentWebhookUrl
  });
}
