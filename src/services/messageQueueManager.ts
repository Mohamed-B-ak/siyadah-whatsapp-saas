import { Request } from 'express';

import { MessageQueueService } from '../../server/services/messageQueue';

export class MessageQueueManager {
  private static instance: MessageQueueManager;
  private messageQueueService: MessageQueueService | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): MessageQueueManager {
    if (!MessageQueueManager.instance) {
      MessageQueueManager.instance = new MessageQueueManager();
    }
    return MessageQueueManager.instance;
  }

  initialize(database: any) {
    if (!this.isInitialized) {
      this.messageQueueService = new MessageQueueService(database);
      this.isInitialized = true;
      console.log('📬 Message Queue Manager initialized');
    }
  }

  async shouldQueueMessage(sessionId: string): Promise<boolean> {
    if (!this.messageQueueService) {
      throw new Error('MessageQueueService not initialized');
    }

    const canSendImmediately =
      await this.messageQueueService.canSendImmediately(sessionId);
    return !canSendImmediately;
  }

  async addMessage(
    sessionId: string,
    sessionName: string,
    companyId: string,
    userId: string,
    phone: string,
    message: string,
    options: any = {},
    priority: number = 1
  ) {
    if (!this.messageQueueService) {
      throw new Error('MessageQueueService not initialized');
    }

    return await this.messageQueueService.addMessageToQueue(
      sessionId,
      sessionName,
      companyId,
      userId,
      phone,
      message,
      options,
      priority
    );
  }

  async getQueueStatus(sessionId: string) {
    if (!this.messageQueueService) {
      throw new Error('MessageQueueService not initialized');
    }

    return await this.messageQueueService.getQueueStatus(sessionId);
  }

  async clearQueue(sessionId: string) {
    if (!this.messageQueueService) {
      throw new Error('MessageQueueService not initialized');
    }

    return await this.messageQueueService.clearQueue(sessionId);
  }

  // Helper method to extract session info from request
  getSessionInfo(req: Request): {
    sessionId: string;
    sessionName: string;
    companyId?: string;
    userId?: string;
  } {
    const sessionName = req.params.session || req.client?.session || 'unknown';
    const sessionId = req.client?.session || sessionName;

    // Try to extract company/user info from request
    const companyId =
      req.body?.companyId || req.headers?.['x-company-id'] || 'unknown';
    const userId = req.body?.userId || req.headers?.['x-user-id'] || 'unknown';

    return {
      sessionId,
      sessionName,
      companyId: companyId as string,
      userId: userId as string,
    };
  }

  // Integration method for existing message controller
  async processMessageRequest(
    req: Request,
    phone: string,
    message: string,
    options: any = {},
    sendFunction: (phone: string, message: string, options: any) => Promise<any>
  ): Promise<{
    success: boolean;
    queued: boolean;
    messageId?: string;
    estimatedSendTime?: Date;
    result?: any;
    error?: string;
  }> {
    try {
      const sessionInfo = this.getSessionInfo(req);

      // CRITICAL FIX: Always add to queue first, let queue determine immediate vs delayed sending
      const queueResult = await this.addMessage(
        sessionInfo.sessionId,
        sessionInfo.sessionName,
        sessionInfo.companyId || 'unknown',
        sessionInfo.userId || 'unknown',
        phone,
        message,
        options
      );

      if (queueResult.queued) {
        // Message was queued for later delivery
        req.logger?.info(
          `📬 Message queued for ${sessionInfo.sessionName}: ${phone} (ID: ${queueResult.messageId})`
        );

        return {
          success: true,
          queued: true,
          messageId: queueResult.messageId,
          estimatedSendTime: queueResult.estimatedSendTime,
        };
      } else {
        // Message can be sent immediately (first message or 30+ seconds since last)
        try {
          const result = await sendFunction(phone, message, options);
          req.logger?.info(
            `📤 Message sent immediately for ${sessionInfo.sessionName}: ${phone}`
          );

          return {
            success: true,
            queued: false,
            result,
          };
        } catch (sendError: any) {
          req.logger?.error(
            `❌ Immediate send failed for ${sessionInfo.sessionName}: ${sendError.message}`
          );

          // If immediate send fails, the message is already in queue for retry
          return {
            success: true,
            queued: true,
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            error: `Immediate send failed, message queued for retry: ${sendError.message}`,
          };
        }
      }
    } catch (error: any) {
      req.logger?.error(`❌ Message processing error: ${error.message}`);
      return {
        success: false,
        queued: false,
        error: error.message,
      };
    }
  }

  // Method to integrate actual WhatsApp sending with queue processing
  setMessageSender(
    sender: (
      sessionId: string,
      phone: string,
      message: string,
      options: any
    ) => Promise<boolean>
  ) {
    if (this.messageQueueService) {
      // Replace the placeholder sendMessageViaWhatsApp method
      (this.messageQueueService as any).sendMessageViaWhatsApp = async (
        sessionId: string,
        messageTask: any
      ) => {
        if (messageTask.message === 'IMMEDIATE_SEND_MARKER') {
          return true; // Just update timing, don't actually send
        }
        return await sender(
          sessionId,
          messageTask.phone,
          messageTask.message,
          messageTask.options
        );
      };
    }
  }
}

export default MessageQueueManager.getInstance();
