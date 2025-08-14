import { Request, Response, NextFunction } from 'express';
// JWT functionality temporarily disabled - will implement after package fix
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  user?: any;
  company?: any;
}

// JWT Authentication middleware
export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'رمز الوصول مطلوب'
    });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString()) as any;
    
    if (decoded.type === 'company') {
      const company = await storage.getCompanyByEmail(decoded.email);
      if (!company || !company.isActive) {
        return res.status(401).json({
          success: false,
          message: 'الشركة غير موجودة أو غير نشطة'
        });
      }
      req.company = company;
    } else if (decoded.type === 'user') {
      const user = await storage.getUserByEmail(decoded.email);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'المستخدم غير موجود أو غير نشط'
        });
      }
      req.user = user;
    }

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'رمز الوصول غير صالح'
    });
  }
};

// Company-only access
export const requireCompany = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.company) {
    return res.status(403).json({
      success: false,
      message: 'يتطلب صلاحيات الشركة'
    });
  }
  next();
};

// User access (can be company or user)
export const requireUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user && !req.company) {
    return res.status(403).json({
      success: false,
      message: 'يتطلب صلاحيات المستخدم'
    });
  }
  next();
};

// Admin access (company admin role)
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.company && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      message: 'يتطلب صلاحيات الإدارة'
    });
  }
  next();
};

// Rate limiting middleware
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات'
      });
    }
    
    clientData.count++;
    next();
  };
};

// Generate simple token for now
export const generateJWT = (payload: any, expiresIn: string = '24h') => {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};