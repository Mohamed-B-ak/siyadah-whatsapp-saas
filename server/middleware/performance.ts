import { Request, Response, NextFunction } from 'express';
import { logApiRequest } from '../utils/logger';

export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const milliseconds = seconds * 1000 + nanoseconds / 1000000;
    
    // Log the request performance
    logApiRequest(req, res, milliseconds);
    
    // Only add headers if response hasn't been sent
    if (!res.headersSent) {
      res.set('X-Response-Time', `${milliseconds.toFixed(2)}ms`);
    }
  });
  
  next();
};

// Memory usage monitor
export const memoryMonitor = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const mbUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };
    
    // Log if memory usage is high
    if (mbUsage.heapUsed > 500) { // 500MB threshold
      console.warn('🚨 High memory usage detected:', mbUsage);
    }
  }, 60000); // Check every minute
};

// Request rate limiter
export const rateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  const requests = new Map();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter((time: number) => time > windowStart);
      requests.set(key, userRequests);
    } else {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs/1000} seconds.`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    next();
  };
};

export default performanceMonitor;