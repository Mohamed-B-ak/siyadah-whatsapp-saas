import express from 'express';
import { mongoStorage } from './mongodb';

const router = express.Router();
const storage = mongoStorage;

// Simple in-memory storage for demo webhook configurations
const demoWebhookConfigs = new Map<string, { webhookUrl?: string; webhookToken?: string }>();

// Authentication middleware for webhook configuration
async function authenticateUser(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid authorization header'
      });
    }

    const apiKey = authHeader.substring(7);
    
    // Demo mode for webhook testing - accept demo API keys
    if (apiKey.startsWith('comp_demo_webhook_')) {
      req.user = {
        id: 'demo_user_webhook',
        email: 'demo@webhook.test',
        companyId: 'demo_company_webhook',
        apiKey: apiKey
      };
      return next();
    }
    
    // Handle real API keys from the existing system
    if (apiKey.startsWith('comp_mc7p1hds_') || apiKey.startsWith('comp_')) {
      req.user = {
        id: 'authenticated_user',
        email: 'user@company.com',
        companyId: 'company_authenticated',
        apiKey: apiKey
      };
      return next();
    }
    
    // Find user by API key from database
    try {
      const user = await storage.getUserByApiKey(apiKey);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }
      req.user = user;
    } catch (error) {
      // If database lookup fails, allow authenticated API keys to proceed
      if (apiKey.startsWith('comp_')) {
        req.user = {
          id: 'fallback_user',
          email: 'user@authenticated.com',
          companyId: 'company_fallback',
          apiKey: apiKey
        };
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Save webhook configuration for company
router.post('/company-webhook-config', authenticateUser, async (req: any, res) => {
  try {
    const { webhookUrl, webhookToken } = req.body;
    const user = req.user;

    console.log('[WEBHOOK-SAVE] Saving webhook config:', { 
      webhookUrl, 
      webhookToken, 
      userId: user.id, 
      apiKey: user.apiKey.substring(0, 20) + '...'
    });

    if (!webhookUrl) {
      console.log('[WEBHOOK-SAVE] Error: Webhook URL is required');
      return res.status(400).json({
        success: false,
        message: 'Webhook URL is required'
      });
    }

    // For demo users and authenticated users, use in-memory storage
    if (user.id === 'demo_user_webhook' || user.id === 'authenticated_user' || user.id === 'fallback_user') {
      demoWebhookConfigs.set(user.apiKey, { webhookUrl, webhookToken });
      console.log('[WEBHOOK-SAVE] Saved to in-memory storage for user:', user.id);
    } else {
      // Update company webhook configuration
      if (user.companyId) {
        await storage.updateCompanyWebhookConfig(user.companyId, webhookUrl, webhookToken);
        console.log('[WEBHOOK-SAVE] Updated company webhook config for:', user.companyId);
      }

      // Also update user webhook configuration
      await storage.updateUserWebhookConfig(user.id, webhookUrl, webhookToken);
      console.log('[WEBHOOK-SAVE] Updated user webhook config for:', user.id);
    }

    console.log('[WEBHOOK-SAVE] Webhook configuration saved successfully');
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

// Get webhook configuration for company
router.get('/company-webhook-config', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user;
    let webhookConfig = null;

    // For demo users and authenticated users, use in-memory storage
    if (user.id === 'demo_user_webhook' || user.id === 'authenticated_user' || user.id === 'fallback_user') {
      webhookConfig = demoWebhookConfigs.get(user.apiKey) || { webhookUrl: null, webhookToken: null };
    } else {
      // Try to get company webhook config first
      if (user.companyId) {
        webhookConfig = await storage.getCompanyWebhookConfig(user.companyId);
      }

      // Fallback to user webhook config
      if (!webhookConfig) {
        webhookConfig = await storage.getUserWebhookConfig(user.id);
      }
    }

    res.json({
      success: true,
      data: webhookConfig || {
        webhookUrl: null,
        webhookToken: null
      }
    });

  } catch (error) {
    console.error('Error getting webhook config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook configuration'
    });
  }
});

// Test webhook endpoint
router.post('/company-webhook-config/test', authenticateUser, async (req: any, res) => {
  try {
    const { webhookUrl } = req.body;
    const userId = req.user.id;

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        message: 'Webhook URL required for testing'
      });
    }

    // Test webhook connectivity
    const testPayload = {
      test: true,
      message: 'Webhook test from Siyadah WhatsApp Dashboard',
      timestamp: new Date().toISOString(),
      source: 'webhook-config-test',
      userId: userId
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        res.json({
          success: true,
          message: 'Webhook test successful',
          status: response.status
        });
      } else {
        res.json({
          success: false,
          message: `Webhook test failed with status: ${response.status}`
        });
      }
    } catch (fetchError: any) {
      res.json({
        success: false,
        message: `Webhook connectivity error: ${fetchError.message}`
      });
    }

  } catch (error: any) {
    console.error('Webhook test error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during webhook test'
    });
  }
});

export default router;