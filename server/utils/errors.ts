import { logger } from './logger';
import { storage } from '../storage';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode: string;

  constructor(message: string, statusCode: number = 500, errorCode: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorCode = errorCode;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class WhatsAppError extends AppError {
  constructor(message: string) {
    super(message, 502, 'WHATSAPP_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// Global error handler
export async function handleError(
  error: Error,
  req?: any,
  companyId?: string,
  userId?: string,
  sessionId?: string
): Promise<void> {
  const isOperational = error instanceof AppError && error.isOperational;
  
  // Log error details
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    isOperational,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
    companyId,
    userId,
    sessionId,
  });

  // Log to database for critical errors
  if (!isOperational || (error instanceof AppError && error.statusCode >= 500)) {
    try {
      await storage.logError({
        companyId: companyId || null,
        userId: userId || null,
        sessionId: sessionId || null,
        errorType: error.constructor.name,
        errorMessage: error.message,
        stackTrace: error.stack || '',
        endpoint: req?.originalUrl || null,
        severity: error instanceof AppError && error.statusCode >= 500 ? 'critical' : 'error',
        metadata: JSON.stringify({
          statusCode: error instanceof AppError ? error.statusCode : 500,
          errorCode: error instanceof AppError ? error.errorCode : 'UNKNOWN',
          ip: req?.ip,
          userAgent: req?.get('User-Agent'),
        }),
      });
    } catch (logError) {
      logger.error('Failed to log error to database:', logError);
    }
  }

  // Exit process for unhandled errors in production
  if (!isOperational && process.env.NODE_ENV === 'production') {
    logger.error('Unhandled error detected. Shutting down gracefully...');
    process.exit(1);
  }
}

// Error response formatter
export function formatErrorResponse(error: Error): {
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
  };
} {
  const isAppError = error instanceof AppError;
  
  return {
    error: {
      message: isAppError ? error.message : 'Internal server error',
      code: isAppError ? error.errorCode : 'INTERNAL_ERROR',
      statusCode: isAppError ? error.statusCode : 500,
      timestamp: new Date().toISOString(),
    },
  };
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Process error handlers
process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught Exception:', error);
  await handleError(error);
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  await handleError(new Error(reason));
  process.exit(1);
});