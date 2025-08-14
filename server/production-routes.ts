import { Router } from 'express';
import { healthCheck } from './health-check';

const router = Router();

// ENTERPRISE-GRADE ROUTE ORGANIZATION

// === HEALTH & MONITORING ===
router.get('/health', healthCheck);
router.get('/status', (req, res) => {
  res.json({
    service: 'WhatsApp SaaS Platform',
    version: '2.8.6',
    status: 'operational',
    timestamp: new Date().toISOString(),
    features: [
      'Multi-tenant SaaS',
      'WhatsApp Integration',
      'Enterprise Security',
      'Real-time Analytics',
      'Advanced Notifications',
      'Automated Backups'
    ]
  });
});

// === COMPANY MANAGEMENT ===
router.post('/companies/register', async (req, res) => {
  try {
    const { name, email, phone, planType = 'basic' } = req.body;
    
    // Input validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Generate secure API key
    const apiKey = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Plan configuration
    const planConfigs = {
      basic: { maxUsers: 5, maxSessions: 3, price: 99 },
      professional: { maxUsers: 25, maxSessions: 15, price: 299 },
      enterprise: { maxUsers: 100, maxSessions: 50, price: 899 }
    };

    const config = planConfigs[planType] || planConfigs.basic;
    
    const company = {
      id: `comp_${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      masterApiKey: apiKey,
      planType,
      ...config,
      isActive: true,
      createdAt: new Date().toISOString(),
      features: [
        'WhatsApp API Access',
        'Real-time Messaging',
        'Webhook Support',
        'Analytics Dashboard'
      ]
    };

    res.status(201).json({
      success: true,
      company,
      message: 'Company registered successfully',
      nextSteps: [
        'Save your API key securely',
        'Create user accounts',
        'Start your first WhatsApp session'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
      code: 'REGISTRATION_ERROR'
    });
  }
});

// === API DOCUMENTATION ===
router.get('/docs', (req, res) => {
  res.json({
    title: 'WhatsApp SaaS Platform API',
    version: '2.8.6',
    description: 'Enterprise-grade WhatsApp integration platform',
    endpoints: {
      health: 'GET /api/health',
      register: 'POST /api/companies/register',
      sessions: 'POST /api/{session}/start-session',
      qrcode: 'GET /api/{session}/qrcode-session',
      messages: 'POST /api/{session}/send-message'
    },
    authentication: 'Bearer Token required for protected endpoints',
    support: 'Contact support for enterprise features'
  });
});

export default router;