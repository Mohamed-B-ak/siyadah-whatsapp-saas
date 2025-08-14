import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

export interface AuthenticatedRequest extends Request {
  company?: any;
  user?: any;
  sessionData?: any;
  startTime?: number;
}

// Middleware للتحقق من مفتاح API الرئيسي للشركة
export const authenticateCompany = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Master API key required in Authorization header' 
      });
    }

    const apiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(apiKey);
    
    if (!company) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid master API key' 
      });
    }

    if (!company.isActive) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Company account is deactivated' 
      });
    }

    req.company = company;
    next();
  } catch (error) {
    console.error('Company authentication error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Authentication failed' 
    });
  }
};

// Middleware للتحقق من مفتاح API المستخدم
export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User API key required in Authorization header' 
      });
    }

    const apiKey = authHeader.substring(7);
    
    // Try user first
    const user = await storage.getUserByApiKey(apiKey);
    if (user) {
      req.user = user;
      req.company = { id: user.companyId, name: 'Company', isActive: true };
      return next();
    }

    // If not user key, try company master key
    const company = await storage.getCompanyByApiKey(apiKey);
    if (company) {
      req.company = company;
      req.user = {
        id: `admin_${company.id}`,
        companyId: company.id,
        name: 'Company Admin',
        email: company.email,
        role: 'admin',
        apiKey: apiKey,
        isActive: true
      };
      return next();
    }
    
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid API key' 
    });

    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'User account is deactivated' 
      });
    }

    // التحقق من الشركة أيضاً - استخدام معرف الشركة من بيانات المستخدم
    req.company = {
      id: user.companyId,
      name: 'Company',
      isActive: true
    };

    req.user = user;
    next();
  } catch (error) {
    console.error('User authentication error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Authentication failed' 
    });
  }
};

// Middleware للتحقق من الجلسة والصلاحيات
export const authenticateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionName } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User authentication required' 
      });
    }

    // For demo mode, create mock session data
    if (req.user.id === 'demo_user_123') {
      req.sessionData = {
        id: `demo_session_${Date.now()}`,
        sessionName: sessionName,
        userId: req.user.id,
        companyId: req.company!.id,
        status: 'created',
        phoneNumber: null,
        lastActivity: null,
        connectedAt: null,
        createdAt: new Date()
      };
      return next();
    }

    // For real users, find session in database
    const userSessions = await storage.getSessionsByUser(req.user.id);
    const session = userSessions.find(s => s.sessionName === sessionName);
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'Session not found' 
      });
    }

    // التحقق من ملكية الجلسة
    if (session.userId !== req.user.id) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Access denied to this session' 
      });
    }

    if (!session.isActive) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Session is deactivated' 
      });
    }

    req.sessionData = session;
    next();
  } catch (error) {
    console.error('Session authentication error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Session authentication failed' 
    });
  }
};

// Middleware لتسجيل استخدام API
export const logApiUsage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // تسجيل معلومات الطلب
  const originalSend = res.send;
  let responseSize = 0;
  let statusCode = 200;

  res.send = function(body) {
    responseSize = Buffer.byteLength(body || '', 'utf8');
    statusCode = res.statusCode;
    return originalSend.call(this, body);
  };

  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime;
      const requestSize = parseInt(req.headers['content-length'] || '0');

      if (req.company) {
        await storage.logApiUsage({
          companyId: req.company.id,
          userId: req.user?.id || undefined,
          sessionId: req.sessionData?.id || undefined,
          endpoint: req.path,
          method: req.method,
          statusCode,
          responseTime,
          requestSize,
          responseSize,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'] || undefined,
          errorMessage: statusCode >= 400 ? 'Request failed' : undefined,
          requestData: req.method !== 'GET' ? req.body : undefined,
        });
      }
    } catch (error) {
      console.error('API usage logging error:', error);
    }
  });

  next();
};

// التحقق من الحدود والقيود
export const checkLimits = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.company) {
      return next();
    }

    // التحقق من عدد الجلسات النشطة
    if (req.path.includes('/create-session') || req.path.includes('/start-session')) {
      const activeSessions = await storage.getCompanySessions(req.company.id);
      const activeCount = activeSessions.filter(s => s.status === 'connected' || s.status === 'qrcode').length;
      
      if (activeCount >= req.company.maxSessions) {
        return res.status(429).json({
          error: 'Limit Exceeded',
          message: `Maximum sessions limit reached (${req.company.maxSessions})`
        });
      }
    }

    // التحقق من عدد المستخدمين
    if (req.path.includes('/create-user')) {
      const users = await storage.getUsersByCompany(req.company.id);
      
      if (users.length >= req.company.maxUsers) {
        return res.status(429).json({
          error: 'Limit Exceeded',
          message: `Maximum users limit reached (${req.company.maxUsers})`
        });
      }
    }

    next();
  } catch (error) {
    console.error('Limits check error:', error);
    next();
  }
};