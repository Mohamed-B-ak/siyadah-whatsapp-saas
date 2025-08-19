import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Company registration endpoint
router.post('/companies/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required'
      });
    }

    // Create new company with generated API key
    const apiKey = `comp_${Math.random().toString(36).substring(2, 15)}`;
    
    const company = {
      id: Math.random().toString(36).substring(2, 15),
      name,
      email,
      phone,
      masterApiKey: apiKey,
      planType: 'basic',
      maxUsers: 10,
      maxSessions: 5,
      isActive: true,
      createdAt: new Date()
    };

    res.status(201).json({
      success: true,
      company,
      message: 'Company registered successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get company API keys
router.get('/companies/api-keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization header required' 
      });
    }

    const apiKey = authHeader.substring(7);
    
    // Mock response for demo purposes
    const mockKeys = [
      {
        id: 'comp_demo_key_1',
        name: 'مفتاح الإنتاج',
        createdAt: new Date(),
        isActive: true,
        permissions: 'full'
      },
      {
        id: 'comp_demo_key_2', 
        name: 'مفتاح التطوير',
        createdAt: new Date(Date.now() - 86400000), // Yesterday
        isActive: true,
        permissions: 'read'
      }
    ];

    res.json({
      success: true,
      keys: mockKeys,
      count: mockKeys.length
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API keys',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate new API key
router.post('/companies/api-keys', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization header required' 
      });
    }

    const { name, permissions, subclient, expiry } = req.body;
    
    // Generate new API key
    const newKey = 'comp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    
    const keyData = {
      id: newKey,
      key: newKey,
      name: name || 'مفتاح جديد',
      subclient: subclient || 'عام',
      permissions: permissions || 'full',
      expiry: expiry || 0,
      createdAt: new Date(),
      isActive: true
    };

    // In a real system, save to database
    // await storage.createAPIKey(keyData);

    res.json({
      success: true,
      key: keyData,
      message: 'تم إنشاء المفتاح بنجاح'
    });

  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create API key',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;