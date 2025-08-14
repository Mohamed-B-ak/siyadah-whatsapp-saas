import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Persistent file storage for webhook configurations
const WEBHOOK_STORAGE_FILE = path.join(process.cwd(), 'webhook-storage.json');

// Load existing webhook configurations from file
function loadWebhookStorage(): Map<string, { webhookUrl: string; webhookToken?: string }> {
  try {
    if (fs.existsSync(WEBHOOK_STORAGE_FILE)) {
      const data = fs.readFileSync(WEBHOOK_STORAGE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('[WEBHOOK-STORAGE] Error loading webhook storage:', error);
  }
  return new Map();
}

// Save webhook configurations to file
function saveWebhookStorage(storage: Map<string, { webhookUrl: string; webhookToken?: string }>) {
  try {
    const data = Object.fromEntries(storage);
    fs.writeFileSync(WEBHOOK_STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[WEBHOOK-STORAGE] Error saving webhook storage:', error);
  }
}

// Initialize storage from file
const webhookStorage = loadWebhookStorage();
console.log(`[WEBHOOK-STORAGE] Loaded ${webhookStorage.size} webhook configurations from persistent storage`);

// Save webhook configuration
router.post('/company-webhook-config', async (req: any, res) => {
  try {
    const { webhookUrl, webhookToken } = req.body;
    const authHeader = req.headers.authorization;

    console.log('[WEBHOOK-SAVE] Request received:', { 
      webhookUrl, 
      webhookToken, 
      hasAuth: !!authHeader 
    });

    if (!webhookUrl) {
      console.log('[WEBHOOK-SAVE] Error: Webhook URL is required');
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required'
      });
    }

    // Extract API key from authorization header
    let apiKey = 'default';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // Replace existing webhook for this user (one webhook per user policy)
    const previousWebhook = webhookStorage.get(apiKey);
    if (previousWebhook) {
      console.log('[WEBHOOK-SAVE] Replacing existing webhook for user:', apiKey.substring(0, 20) + '...');
      console.log('[WEBHOOK-SAVE] Old URL:', previousWebhook.webhookUrl);
      console.log('[WEBHOOK-SAVE] New URL:', webhookUrl);
    }
    
    // Save to storage (replaces existing entry)
    webhookStorage.set(apiKey, { webhookUrl, webhookToken });
    
    // Persist to file
    saveWebhookStorage(webhookStorage);
    
    console.log('[WEBHOOK-SAVE] Webhook configuration saved successfully for key:', apiKey.substring(0, 20) + '...');
    console.log('[WEBHOOK-SAVE] Total webhook configurations stored:', webhookStorage.size);
    
    res.json({
      success: true,
      message: 'Webhook configuration saved successfully'
    });

  } catch (error) {
    console.error('[WEBHOOK-SAVE] Error saving webhook config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save webhook configuration'
    });
  }
});

// Get webhook configuration
router.get('/company-webhook-config', async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('[WEBHOOK-GET] Request received, hasAuth:', !!authHeader);

    // Extract API key from authorization header
    let apiKey = 'default';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // Get from storage
    const webhookConfig = webhookStorage.get(apiKey) || {
      webhookUrl: null,
      webhookToken: null
    };

    console.log('[WEBHOOK-GET] Retrieved config for key:', apiKey.substring(0, 20) + '...');
    
    res.json({
      success: true,
      data: webhookConfig
    });

  } catch (error) {
    console.error('[WEBHOOK-GET] Error getting webhook config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook configuration'
    });
  }
});

export default router;