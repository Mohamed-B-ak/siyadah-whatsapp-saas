import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from './storage';
import { generateApiKey } from './utils/crypto';

const router = Router();

// Enterprise-grade rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number; blocked: boolean }>();

const advancedRateLimit = (maxRequests: number = 50, windowMs: number = 60000, blockDuration: number = 300000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip + (req.headers['user-agent'] || '');
    const now = Date.now();
    
    let clientData = rateLimitMap.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs, blocked: false };
      rateLimitMap.set(clientId, clientData);
    }
    
    if (clientData.blocked && now < clientData.resetTime + blockDuration) {
      return res.status(429).json({
        success: false,
        message: 'تم حظر عنوان IP مؤقتاً بسبب تجاوز الحد المسموح',
        blockedUntil: new Date(clientData.resetTime + blockDuration),
        retryAfter: Math.ceil((clientData.resetTime + blockDuration - now) / 1000)
      });
    }
    
    clientData.count++;
    
    if (clientData.count > maxRequests) {
      clientData.blocked = true;
      return res.status(429).json({
        success: false,
        message: 'تجاوزت الحد المسموح من الطلبات. تم حظر عنوان IP مؤقتاً',
        blockedFor: blockDuration / 1000,
        maxRequests,
        window: windowMs / 1000
      });
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));
    
    next();
  };
};

// Advanced password validation
const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('كلمة المرور يجب أن تكون 12 حرف على الأقل');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل');
  }
  
  // Check against common passwords
  const commonPasswords = [
    'password123', '123456789', 'qwerty123', 'admin123', 'password!',
    'Password123', '12345678', 'password1', 'welcome123'
  ];
  
  if (commonPasswords.includes(password)) {
    errors.push('كلمة المرور شائعة جداً، يرجى اختيار كلمة مرور أقوى');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Email validation with domain checking
const validateEmail = async (email: string): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('تنسيق البريد الإلكتروني غير صحيح');
    return { valid: false, errors };
  }
  
  // Check for disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'guerrillamail.com', 'tempmail.org',
    'mailinator.com', 'throawaway.email', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1];
  if (disposableDomains.includes(domain)) {
    errors.push('لا يُسمح باستخدام عناوين البريد المؤقتة');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Advanced company registration with validation
router.post('/register/company', advancedRateLimit(10, 60000), async (req, res) => {
  try {
    const { name, email, password, planType = 'basic', businessType, country, phone } = req.body;
    
    // Comprehensive validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول الأساسية مطلوبة',
        required: ['name', 'email', 'password']
      });
    }
    
    // Validate email
    const emailValidation = await validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صالح',
        errors: emailValidation.errors
      });
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور لا تلبي متطلبات الأمان',
        errors: passwordValidation.errors
      });
    }
    
    // Check if company already exists
    const existingCompany = await storage.getCompanyByEmail(email);
    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: 'شركة مسجلة بهذا البريد الإلكتروني مسبقاً'
      });
    }
    
    // Validate plan type
    const validPlans = ['basic', 'premium', 'enterprise'];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'نوع الخطة غير صحيح',
        validPlans
      });
    }
    
    // Hash password with high cost
    const saltRounds = 14;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Generate secure API keys
    const masterApiKey = generateApiKey('comp');
    const apiSecret = crypto.randomBytes(32).toString('hex');
    
    // Set plan limits
    const planLimits = {
      basic: { maxUsers: 10, maxSessions: 5, maxMessages: 1000, price: 29 },
      premium: { maxUsers: 50, maxSessions: 25, maxMessages: 10000, price: 99 },
      enterprise: { maxUsers: 100, maxSessions: 50, maxMessages: -1, price: 299 }
    };
    
    const limits = planLimits[planType as keyof typeof planLimits];
    
    // Create company with enhanced data
    const company = await storage.createCompany({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      masterApiKey,
      apiSecret,
      planType,
      businessType: businessType || 'other',
      country: country || 'SA',
      phone: phone || null,
      maxUsers: limits.maxUsers,
      maxSessions: limits.maxSessions,
      maxMessages: limits.maxMessages,
      monthlyPrice: limits.price,
      isActive: true,
      emailVerified: false,
      securityLevel: 'standard',
      twoFactorEnabled: false,
      lastPasswordChange: new Date(),
      loginAttempts: 0,
      lockedUntil: null
    });
    
    // Log security event
    console.log(`🔐 [SECURITY] Company registration: ${company.email} from IP: ${req.ip}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب الشركة بنجاح',
      data: {
        id: company.id,
        name: company.name,
        email: company.email,
        masterApiKey: company.masterApiKey,
        planType: company.planType,
        limits: {
          maxUsers: company.maxUsers,
          maxSessions: company.maxSessions,
          maxMessages: company.maxMessages
        },
        nextSteps: [
          'تأكيد البريد الإلكتروني',
          'إنشاء أول مستخدم',
          'إعداد جلسة WhatsApp'
        ]
      }
    });
    
  } catch (error) {
    console.error('🚨 [ERROR] Company registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced user registration with company validation
router.post('/register/user', advancedRateLimit(20, 60000), async (req, res) => {
  try {
    const { name, email, password, companyId, role = 'user', permissions = ['read', 'write'] } = req.body;
    
    // Validation
    if (!name || !email || !password || !companyId) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة',
        required: ['name', 'email', 'password', 'companyId']
      });
    }
    
    // Validate email
    const emailValidation = await validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صالح',
        errors: emailValidation.errors
      });
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور لا تلبي متطلبات الأمان',
        errors: passwordValidation.errors
      });
    }
    
    // Check company exists and is active
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company || !company.isActive) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة أو غير نشطة'
      });
    }
    
    // Check user limit
    const existingUsers = await storage.getUsersByCompany(company.id);
    if (existingUsers.length >= company.maxUsers) {
      return res.status(403).json({
        success: false,
        message: `تم الوصول للحد الأقصى من المستخدمين (${company.maxUsers})`,
        upgrade: 'يرجى ترقية خطة الاشتراك لإضافة المزيد من المستخدمين'
      });
    }
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'مستخدم مسجل بهذا البريد الإلكتروني مسبقاً'
      });
    }
    
    // Validate role and permissions
    const validRoles = ['admin', 'manager', 'user'];
    const validPermissions = ['read', 'write', 'admin', 'delete'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'دور المستخدم غير صحيح',
        validRoles
      });
    }
    
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'صلاحيات غير صحيحة',
        invalidPermissions,
        validPermissions
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 14);
    
    // Generate API key
    const apiKey = generateApiKey('user');
    
    // Create user
    const user = await storage.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      apiKey,
      companyId: company.id,
      role,
      permissions,
      isActive: true,
      emailVerified: false,
      lastLoginAt: null,
      loginAttempts: 0,
      lockedUntil: null,
      sessionLimit: role === 'admin' ? company.maxSessions : Math.min(5, company.maxSessions)
    });
    
    // Log security event
    console.log(`🔐 [SECURITY] User registration: ${user.email} for company: ${company.name} from IP: ${req.ip}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب المستخدم بنجاح',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        apiKey: user.apiKey,
        companyId: user.companyId,
        role: user.role,
        permissions: user.permissions,
        sessionLimit: user.sessionLimit,
        nextSteps: [
          'تأكيد البريد الإلكتروني',
          'إنشاء جلسة WhatsApp',
          'بدء إرسال الرسائل'
        ]
      }
    });
    
  } catch (error) {
    console.error('🚨 [ERROR] User registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Secure login with advanced features
router.post('/login', advancedRateLimit(15, 60000), async (req, res) => {
  try {
    const { email, password, type, rememberMe = false } = req.body;
    
    if (!email || !password || !type) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور ونوع الحساب مطلوبة'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    let account: any = null;
    
    // Get account based on type
    if (type === 'company') {
      account = await storage.getCompanyByEmail(normalizedEmail);
    } else if (type === 'user') {
      account = await storage.getUserByEmail(normalizedEmail);
    } else {
      return res.status(400).json({
        success: false,
        message: 'نوع الحساب غير صحيح',
        validTypes: ['company', 'user']
      });
    }
    
    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      });
    }
    
    // Check if account is locked
    if (account.lockedUntil && new Date(account.lockedUntil) > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'الحساب مقفل مؤقتاً بسبب محاولات تسجيل دخول فاشلة',
        lockedUntil: account.lockedUntil,
        retryAfter: Math.ceil((new Date(account.lockedUntil).getTime() - Date.now()) / 1000)
      });
    }
    
    // Check if account is active
    if (!account.isActive) {
      return res.status(403).json({
        success: false,
        message: 'الحساب غير نشط، يرجى التواصل مع الإدارة'
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, account.passwordHash);
    
    if (!validPassword) {
      // Increment login attempts
      const attempts = (account.loginAttempts || 0) + 1;
      const lockDuration = attempts >= 5 ? 30 * 60 * 1000 : 0; // 30 minutes after 5 attempts
      
      const updateData: any = { loginAttempts: attempts };
      if (lockDuration > 0) {
        updateData.lockedUntil = new Date(Date.now() + lockDuration);
      }
      
      if (type === 'company') {
        await storage.updateCompany(account.id, updateData);
      } else {
        await storage.updateUser(account.id, updateData);
      }
      
      console.log(`🚨 [SECURITY] Failed login attempt for ${normalizedEmail} (${attempts}/5) from IP: ${req.ip}`);
      
      return res.status(401).json({
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة',
        attemptsRemaining: Math.max(0, 5 - attempts),
        warningMessage: attempts >= 3 ? 'محاولتان أخريان قبل قفل الحساب' : undefined
      });
    }
    
    // Reset login attempts on successful login
    const resetData: any = { 
      loginAttempts: 0, 
      lockedUntil: null,
      lastLoginAt: new Date()
    };
    
    if (type === 'company') {
      await storage.updateCompany(account.id, resetData);
    } else {
      await storage.updateUser(account.id, resetData);
    }
    
    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = rememberMe 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Log successful login
    console.log(`✅ [SECURITY] Successful login: ${normalizedEmail} (${type}) from IP: ${req.ip}`);
    
    // Return enhanced login response
    const responseData: any = {
      id: account.id,
      name: account.name,
      email: account.email,
      type,
      sessionToken,
      expiresAt,
      lastLoginAt: account.lastLoginAt,
      securityInfo: {
        passwordLastChanged: account.lastPasswordChange,
        twoFactorEnabled: account.twoFactorEnabled || false,
        securityLevel: account.securityLevel || 'standard'
      }
    };
    
    if (type === 'company') {
      responseData.masterApiKey = account.masterApiKey;
      responseData.planType = account.planType;
      responseData.limits = {
        maxUsers: account.maxUsers,
        maxSessions: account.maxSessions,
        maxMessages: account.maxMessages
      };
    } else {
      responseData.apiKey = account.apiKey;
      responseData.companyId = account.companyId;
      responseData.role = account.role;
      responseData.permissions = account.permissions;
    }
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: responseData
    });
    
  } catch (error) {
    console.error('🚨 [ERROR] Login failed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تسجيل الدخول',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Password change endpoint
router.post('/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword, type } = req.body;
    
    if (!email || !currentPassword || !newPassword || !type) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }
    
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة لا تلبي متطلبات الأمان',
        errors: passwordValidation.errors
      });
    }
    
    // Get account
    let account: any = null;
    if (type === 'company') {
      account = await storage.getCompanyByEmail(email.toLowerCase().trim());
    } else {
      account = await storage.getUserByEmail(email.toLowerCase().trim());
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'الحساب غير موجود'
      });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة'
      });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 14);
    
    // Update password
    const updateData = {
      passwordHash: hashedNewPassword,
      lastPasswordChange: new Date()
    };
    
    if (type === 'company') {
      await storage.updateCompany(account.id, updateData);
    } else {
      await storage.updateUser(account.id, updateData);
    }
    
    console.log(`🔐 [SECURITY] Password changed for: ${email} from IP: ${req.ip}`);
    
    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
      securityTip: 'تأكد من استخدام كلمة مرور قوية وفريدة'
    });
    
  } catch (error) {
    console.error('🚨 [ERROR] Password change failed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تغيير كلمة المرور'
    });
  }
});

export default router;