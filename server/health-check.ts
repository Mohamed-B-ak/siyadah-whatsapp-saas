import { Request, Response } from 'express';
import { mongoConnection } from './mongodb';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    whatsapp: {
      status: 'up' | 'down';
      activeSessions: number;
    };
    system: {
      uptime: number;
      memory: {
        used: number;
        total: number;
      };
    };
  };
  version: string;
}

export async function healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Check database
    const dbStartTime = Date.now();
    const dbHealthy = await mongoConnection.healthCheck();
    const dbResponseTime = Date.now() - dbStartTime;

    // Check WhatsApp sessions (basic check)
    const activeSessions = 0; // Will be updated with actual session count

    // System metrics
    const memUsage = process.memoryUsage();
    
    const health: SystemHealth = {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealthy ? 'up' : 'down',
          responseTime: dbResponseTime
        },
        whatsapp: {
          status: 'up',
          activeSessions
        },
        system: {
          uptime: process.uptime(),
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal
          }
        }
      },
      version: '2.8.6'
    };

    res.status(dbHealthy ? 200 : 503).json(health);
    
  } catch (error) {
    const health: SystemHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'down'
        },
        whatsapp: {
          status: 'down',
          activeSessions: 0
        },
        system: {
          uptime: process.uptime(),
          memory: {
            used: 0,
            total: 0
          }
        }
      },
      version: '2.8.6'
    };

    res.status(503).json(health);
  }
}