// نسخة مبسطة من نظام SaaS للاختبار السريع
import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// تسجيل شركة جديدة (مبسط)
router.post('/companies/register', async (req, res) => {
  try {
    const { name, email, planType = 'basic' } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and email are required'
      });
    }

    const company = await storage.createCompany({
      name,
      email,
      planType,
      maxUsers: planType === 'premium' ? 20 : 5,
      maxSessions: planType === 'premium' ? 50 : 10,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Company registered successfully',
      data: {
        id: company.id,
        name: company.name,
        email: company.email,
        planType: company.planType
      },
      masterApiKey: company.masterApiKey
    });
  } catch (error: any) {
    console.error('Company registration error:', error);
    res.status(400).json({
      error: 'Registration Failed',
      message: error.message || 'Failed to register company'
    });
  }
});

// إنشاء مستخدم (مبسط)
router.post('/users', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Master API key required' });
    }

    const masterApiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(masterApiKey);
    
    if (!company) {
      return res.status(401).json({ error: 'Invalid master API key' });
    }

    const { name, email, role = 'user' } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and email are required'
      });
    }

    const user = await storage.createUser({
      companyId: company.id,
      name,
      email,
      role,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        apiKey: user.apiKey
      }
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(400).json({
      error: 'Creation Failed',
      message: error.message || 'Failed to create user'
    });
  }
});

// إنشاء جلسة (مبسط)
router.post('/sessions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'User API key required' });
    }

    const userApiKey = authHeader.substring(7);
    const user = await storage.getUserByApiKey(userApiKey);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid user API key' });
    }

    const { sessionName } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Session name is required'
      });
    }

    const session = await storage.createSession({
      userId: user.id,
      companyId: user.companyId,
      sessionName,
      status: 'disconnected',
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(400).json({
      error: 'Creation Failed',
      message: error.message || 'Failed to create session'
    });
  }
});

// حالة النظام
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'SaaS system operational',
      message: 'Multi-tenant WhatsApp API platform is running',
      endpoints: {
        registerCompany: 'POST /api/v2/simple/companies/register',
        createUser: 'POST /api/v2/simple/users',
        createSession: 'POST /api/v2/simple/sessions'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'System Error',
      message: error.message || 'Failed to get system status'
    });
  }
});

export default router;