import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { MongoStorage } from './mongodb';
import { generateApiKey } from './utils/crypto';

const router = express.Router();
const storage = new MongoStorage();

interface RegisterRequest {
  type: 'company' | 'user';
  name: string;
  email: string;
  password: string;
  companyId?: string;
  planType?: 'basic' | 'premium' | 'enterprise';
}

interface LoginRequest {
  type: 'company' | 'user';
  email: string;
  password: string;
}

// Company Registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { type, name, email, password, companyId, planType }: RegisterRequest = req.body;

    if (!type || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (type === 'company') {
      // Check if company email already exists
      const existingCompany = await storage.getCompanyByEmail?.(email);
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مسجل مسبقاً'
        });
      }

      // Create company
      const masterApiKey = generateApiKey('comp');
      const company = await storage.createCompany({
        name,
        email,
        password: hashedPassword,
        masterApiKey,
        planType: planType || 'basic',
        maxUsers: planType === 'enterprise' ? 100 : planType === 'premium' ? 50 : 10,
        maxSessions: planType === 'enterprise' ? 50 : planType === 'premium' ? 25 : 5,
        isActive: true
      });

      res.json({
        success: true,
        message: 'تم إنشاء الشركة بنجاح',
        data: {
          id: company.id,
          name: company.name,
          email: company.email,
          masterApiKey: company.masterApiKey,
          type: 'company'
        }
      });

    } else if (type === 'user') {
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'معرف الشركة مطلوب للمستخدمين'
        });
      }

      // Check if user email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مسجل مسبقاً'
        });
      }

      // Create user
      const apiKey = generateApiKey('user');
      const user = await storage.createUser({
        name,
        email,
        passwordHash: hashedPassword,
        companyId,
        apiKey,
        role: 'user',
        permissions: ['read', 'write'],
        status: 'active',
        isActive: true
      });

      res.json({
        success: true,
        message: 'تم إنشاء المستخدم بنجاح',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
          companyId: user.companyId,
          type: 'user'
        }
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    console.log(`[UNIFIED-AUTH] Login request received:`, JSON.stringify(req.body));
    const { type, email, password }: LoginRequest = req.body;

    if (!type || !email || !password) {
      console.log(`[UNIFIED-AUTH] Missing fields - type: ${type}, email: ${email}, password: ${!!password}`);
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    if (type === 'company') {
      console.log(`[UNIFIED-AUTH] Processing company login for: ${email}`);
      const company = await storage.getCompanyByEmail?.(email);
      
      if (!company) {
        console.log(`[UNIFIED-AUTH] Company not found: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }

      console.log(`[UNIFIED-AUTH] Company found: ${company.name}`);
      // Check both password fields for compatibility
      const passwordField = company.password;
      console.log(`[UNIFIED-AUTH] Password field exists: ${!!passwordField}`);
      
      if (!passwordField) {
        console.log(`[UNIFIED-AUTH] No password hash found for ${email}`);
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }

      console.log(`[UNIFIED-AUTH] Starting password verification...`);
      const validPassword = await bcrypt.compare(password, passwordField);
      console.log(`[UNIFIED-AUTH] Password verification result: ${validPassword}`);
      
      if (!validPassword) {
        console.log(`[UNIFIED-AUTH] Password verification failed for ${email}`);
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }

      console.log(`[UNIFIED-AUTH] Authentication successful for ${email}`);
      const responseData = {
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: {
          id: company.id,
          name: company.name,
          email: company.email,
          masterApiKey: company.masterApiKey,
          messagingApiKey: company.messagingApiKey,
          type: 'company'
        }
      };
      
      console.log(`[UNIFIED-AUTH] Sending response:`, JSON.stringify(responseData));
      return res.json(responseData);

    } else if (type === 'user') {
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
          companyId: user.companyId,
          type: 'user'
        }
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Profile endpoint
router.get('/profile', async (req: Request, res: Response) => {
  try {
    // For demo purposes, return Mohamed's company profile
    // In a real app, this would use session/token authentication
    const company = await storage.getCompanyByEmail('mohamed@akacha.tn');
    
    if (company) {
      res.json({
        success: true,
        user: {
          id: company.id,
          name: company.name,
          email: company.email,
          masterApiKey: company.masterApiKey,
          messagingApiKey: company.messagingApiKey,
          type: 'company'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;