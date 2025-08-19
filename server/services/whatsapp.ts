import { logger, PerformanceLogger } from '../utils/logger';
import { WhatsAppError, handleError } from '../utils/errors';
import { cache, cacheSession, getCachedSession } from '../utils/cache';
import { storage } from '../storage';
// import { InsertMessage } from '../../shared/schema';

// WhatsApp integration service
export class WhatsAppService {
  private baseUrl: string;
  private sessions: Map<string, any> = new Map();

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      this.baseUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'siyadah-whatsapp-saas.onrender.com'}`;
    } else {
      this.baseUrl = `http://localhost:${process.env.PORT || 5000}`;
    }
  }

  async createSession(sessionName: string, userId: string, companyId: string): Promise<any> {
    const perf = new PerformanceLogger(`WhatsApp session creation: ${sessionName}`);
    
    try {
      // Check cache first
      const cached = getCachedSession(sessionName);
      if (cached && cached.status === 'connected') {
        perf.end('from cache');
        return cached;
      }

      // Create session via existing WPPConnect API
      const response = await fetch(`${this.baseUrl}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: sessionName, waitQrCode: true }),
      });

      if (!response.ok) {
        throw new WhatsAppError(`Failed to create session: ${response.statusText}`);
      }

      const sessionData = await response.json();
      
      // Store in database
      const session = await storage.createSession({
        sessionName,
        userId,
        companyId,
        status: 'initializing'
      });

      // Cache the session
      cacheSession(sessionName, { ...sessionData, dbId: session.id });
      
      perf.end('new session created');
      logger.info(`WhatsApp session created: ${sessionName} for user: ${userId}`);
      
      return { ...sessionData, dbId: session.id };
    } catch (error) {
      await handleError(error, null, companyId, userId);
      throw error;
    }
  }

  async getQRCode(sessionName: string): Promise<string> {
    const perf = new PerformanceLogger(`QR code generation: ${sessionName}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/qrcode-session?sessionkey=${sessionName}&image=true`);
      
      if (!response.ok) {
        throw new WhatsAppError(`Failed to get QR code: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let qrData: string;

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        qrData = data.qrcode || data.base64 || '';
      } else {
        // Handle binary PNG response
        const buffer = await response.arrayBuffer();
        qrData = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
      }

      perf.end();
      return qrData;
    } catch (error) {
      await handleError(error);
      throw error;
    }
  }

  async getSessionStatus(sessionName: string): Promise<any> {
    try {
      // Check cache first
      const cached = getCachedSession(sessionName);
      if (cached) {
        return { status: cached.status || 'unknown', sessionName };
      }

      const response = await fetch(`${this.baseUrl}/check-connection-session?sessionkey=${sessionName}`);
      
      if (!response.ok) {
        throw new WhatsAppError(`Failed to check session status: ${response.statusText}`);
      }

      const statusData = await response.json();
      
      // Update cache and database
      cacheSession(sessionName, statusData);
      
      if (statusData.status === 'CONNECTED') {
        await this.updateSessionStatus(sessionName, 'connected');
      }

      return statusData;
    } catch (error) {
      await handleError(error);
      throw error;
    }
  }

  async sendMessage(sessionName: string, phone: string, message: string, userId: string, companyId: string): Promise<any> {
    const perf = new PerformanceLogger(`Message send: ${sessionName} to ${phone}`);
    
    try {
      // Validate session status
      const status = await this.getSessionStatus(sessionName);
      if (status.status !== 'CONNECTED') {
        throw new WhatsAppError('Session is not connected');
      }

      // Send message via existing API
      const response = await fetch(`${this.baseUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionkey: sessionName,
          phone,
          message,
        }),
      });

      if (!response.ok) {
        throw new WhatsAppError(`Failed to send message: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log message to database (temporarily disabled for compilation)
      // const session = await this.getSessionFromDB(sessionName);
      // if (session) {
      //   await storage.createMessage({
      //     sessionId: session.id,
      //     from: sessionName,
      //     to: phone,
      //     body: message,
      //     type: 'text',
      //     direction: 'outbound',
      //     status: result.status || 'sent',
      //     wppMessageId: result.messageId || null,
      //   });
      // }

      perf.end(`status: ${result.status}`);
      logger.info(`Message sent: ${sessionName} to ${phone}`);
      
      return result;
    } catch (error) {
      await handleError(error, null, companyId, userId);
      throw error;
    }
  }

  async closeSession(sessionName: string): Promise<boolean> {
    const perf = new PerformanceLogger(`Session close: ${sessionName}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/close-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionkey: sessionName }),
      });

      const success = response.ok;
      
      if (success) {
        // Clean up cache and update database
        cache.delete(`session:${sessionName}`);
        await this.updateSessionStatus(sessionName, 'disconnected');
      }

      perf.end(`success: ${success}`);
      return success;
    } catch (error) {
      await handleError(error as Error);
      return false;
    }
  }

  private async updateSessionStatus(sessionName: string, status: string): Promise<void> {
    try {
      const session = await this.getSessionFromDB(sessionName);
      if (session) {
        await storage.updateSession(session.id, { 
          status,
          lastActivity: new Date(),
          ...(status === 'connected' && { connectedAt: new Date() }),
        });
      }
    } catch (error) {
      logger.error('Failed to update session status:', error);
    }
  }

  private async getSessionFromDB(sessionName: string) {
    try {
      const sessions = await storage.getSessionsByCompany('comp_demo'); // This should be dynamic
      return sessions.find(s => s.sessionName === sessionName);
    } catch (error) {
      logger.error('Failed to get session from DB:', error);
      return null;
    }
  }

  // Handle incoming messages (webhook integration)
  async handleIncomingMessage(data: any): Promise<void> {
    try {
      const { sessionName, phone, message, messageId } = data;
      
      const session = await this.getSessionFromDB(sessionName);
      if (!session) {
        logger.warn(`Received message for unknown session: ${sessionName}`);
        return;
      }

      // Store incoming message
      await storage.createMessage({
        sessionId: session.id,
        userId: session.userId,
        companyId: session.companyId,
        phone,
        message,
        direction: 'inbound',
        status: 'received',
        messageId,
      });

      logger.info(`Incoming message stored: ${sessionName} from ${phone}`);
    } catch (error) {
      await handleError(error);
    }
  }
}

export const whatsappService = new WhatsAppService();
