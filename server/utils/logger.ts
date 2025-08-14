import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'siyadah-whatsapp' },
  transports: [
    // Error logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Combined logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Console output in development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

// Performance logging helper
export class PerformanceLogger {
  private startTime: [number, number];
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = process.hrtime();
  }

  end(additionalData?: any) {
    const [seconds, nanoseconds] = process.hrtime(this.startTime);
    const milliseconds = seconds * 1000 + nanoseconds / 1000000;

    logger.info('Performance Metrics', {
      operation: this.operation,
      duration: `${milliseconds.toFixed(2)}ms`,
      ...additionalData
    });

    return milliseconds;
  }
}

// API request logger
export const logApiRequest = (req: any, res: any, duration: number) => {
  logger.info('API Request', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration.toFixed(2)}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    company: req.company?.name || 'Unknown',
    user: req.user?.email || 'Unknown'
  });
};

// WhatsApp operation logger
export const logWhatsAppOperation = (operation: string, sessionId: string, success: boolean, details?: any) => {
  logger.info('WhatsApp Operation', {
    operation,
    sessionId,
    success,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Error logger with context
export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

export default logger;