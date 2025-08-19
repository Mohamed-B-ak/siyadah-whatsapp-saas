import { Router } from 'express';
import bcrypt from 'bcrypt';
import { MongoStorage } from '../mongodb';
import { generateApiKey } from '../utils/crypto';

const router = Router();
const storage = new MongoStorage();

// Company Registration
router.post('/register', async (req, res) => {
  try {
    const { type, name, email, password, planType } = req.body;

    if (!type || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (type === 'company') {
      const existingCompany = await storage.getCompanyByEmail(email);
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      const masterApiKey = generateApiKey('comp');
      const company = await storage.createCompany({
        name,
        email,
        password: hashedPassword,
        planType: planType || 'basic',
        masterApiKey,
        maxUsers: 10,
        maxSessions: 5,
        isActive: true
      });

      return res.json({
        success: true,
        message: 'Company registered successfully',
        data: {
          id: company.id,
          name: company.name,
          email: company.email,
          masterApiKey: company.masterApiKey,
          planType: company.planType
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid registration type'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Company Login
router.post('/login', async (req, res) => {
  try {
    console.log(`[AUTH] Login request received:`, JSON.stringify(req.body));
    const { type, email, password } = req.body;

    if (!type || !email || !password) {
      console.log(`[AUTH] Missing fields - type: ${type}, email: ${email}, password: ${!!password}`);
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (type === 'company') {
      console.log(`[AUTH] Processing company login for: ${email}`);
      console.log(`[AUTH] Company login attempt with password length: ${password ? password.length : 0}`);
      const company = await storage.getCompanyByEmail(email);
      
      if (!company) {
        console.log(`[LOGIN-DEBUG] Company not found: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      console.log(`[AUTH] Company retrieved: ${company.name}`);
      console.log(`[AUTH] Company ID: ${company.id}`);
      console.log(`[AUTH] Password hash exists: ${!!company.password}`);
      console.log(`[AUTH] Company active: ${company.isActive}`);
      
      if (!company.password) {
        console.log(`[AUTH] ERROR: No password hash found for ${email}`);
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }
      
      console.log(`[AUTH] Starting password verification...`);
      const isValidPassword = await bcrypt.compare(password, company.password);
      console.log(`[AUTH] Password verification result: ${isValidPassword}`);
      
      if (!isValidPassword) {
        console.log(`[AUTH] FAILED: Password verification failed for ${email}`);
        return res.status(401).json({
          success: false,
          message: 'بيانات تسجيل الدخول غير صحيحة'
        });
      }
      
      console.log(`[AUTH] SUCCESS: Authentication successful for ${email}`);
      console.log(`[AUTH] Preparing response data...`);

      const responseData = {
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: {
          id: company.id,
          name: company.name,
          email: company.email,
          masterApiKey: company.masterApiKey,
          type: 'company'
        }
      };

      console.log(`[AUTH] Sending response:`, JSON.stringify(responseData));
      return res.status(200).json(responseData);
    }

    console.log(`[AUTH] Invalid login type: ${type}`);
    return res.status(400).json({
      success: false,
      message: 'Invalid login type'
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

export default router;