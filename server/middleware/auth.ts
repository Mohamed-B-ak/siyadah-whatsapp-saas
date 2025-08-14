import { Request, Response, NextFunction } from 'express';
import { MongoStorage } from '../mongodb';

const storage = new MongoStorage();

export interface AuthenticatedRequest extends Request {
  company?: any;
  user?: any;
}

// Company authentication middleware
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

// User authentication middleware
export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required'
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
  } catch (error) {
    console.error('User authentication error:', error);
    return res.status(500).json({
      error: 'Authentication Error',
      message: 'Internal server error'
    });
  }
};