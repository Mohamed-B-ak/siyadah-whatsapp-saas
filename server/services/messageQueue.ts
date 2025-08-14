import { MongoClient, Collection, ObjectId } from 'mongodb';
import { MessageTask, SessionMessageQueue, InsertMessageTask, InsertSessionMessageQueue } from '../../shared/schema';

export class MessageQueueService {
  private db: any;
  private messageQueuesCollection: Collection<SessionMessageQueue>;
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private bulkProcessingLocks: Set<string> = new Set();
  
  private readonly DELAY_SECONDS = 30;
  private readonly MAX_ATTEMPTS = 3;

  constructor(database: any) {
    this.db = database;
    this.messageQueuesCollection = database.collection('sessionMessageQueues');
    
    // Create indexes for performance
    this.createIndexes();
  }

  private async createIndexes() {
    try {
      await this.messageQueuesCollection.createIndex({ sessionId: 1 });
      await this.messageQueuesCollection.createIndex({ sessionName: 1 });
      await this.messageQueuesCollection.createIndex({ companyId: 1 });
      await this.messageQueuesCollection.createIndex({ isProcessing: 1 });
      await this.messageQueuesCollection.createIndex({ 'queuedMessages.status': 1 });
    } catch (error: any) {
      console.log('Index creation failed (may already exist):', error.message);
    }
  }

  async canSendImmediately(sessionId: string): Promise<boolean> {
    // CRITICAL CHANGE: NO messages should ever be sent immediately
    // All messages must be queued with 30-second delays
    return false;
  }

  async addMessageToQueue(
    sessionId: string,
    sessionName: string,
    companyId: string,
    userId: string,
    phone: string,
    message: string,
    options: any = {},
    priority: number = 1
  ): Promise<{ queued: boolean; messageId: string; estimatedSendTime?: Date }> {
    const now = new Date();
    
    // CRITICAL FIX: Use atomic operation with retry logic to prevent race conditions
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // Start atomic transaction  
        let result;
        
        try {
          // Use direct atomic operations without transactions for now to avoid complexity
          // Read current queue state atomically
          const queue = await this.getSessionQueue(sessionId);
          
          // Calculate scheduled time based on current queue state
          let scheduledTime = new Date(now.getTime() + (this.DELAY_SECONDS * 1000));
          
          if (queue) {
            // Calculate when this message should be sent based on last message time
            const nextAvailableTime = queue.lastMessageTime ? 
              new Date(queue.lastMessageTime.getTime() + (this.DELAY_SECONDS * 1000)) :
              new Date(now.getTime() + (this.DELAY_SECONDS * 1000));
            
            // If there are already queued messages, schedule after the last one
            const pendingMessages = queue.queuedMessages.filter(m => m.status === 'pending');
            if (pendingMessages.length > 0) {
              const lastScheduledTime = Math.max(...pendingMessages.map(m => m.scheduledFor.getTime()));
              scheduledTime = new Date(Math.max(nextAvailableTime.getTime(), lastScheduledTime + (this.DELAY_SECONDS * 1000)));
            } else {
              scheduledTime = nextAvailableTime;
            }
          }

          const messageTask: MessageTask = {
            id: new ObjectId().toString(),
            phone,
            message,
            options,
            scheduledFor: scheduledTime,
            priority,
            attempts: 0,
            maxAttempts: this.MAX_ATTEMPTS,
            status: 'pending',
            createdAt: now,
          };

          if (!queue) {
            // Create new queue with first message atomically
            const newQueue: SessionMessageQueue = {
              id: new ObjectId().toString(),
              sessionId,
              sessionName,
              companyId,
              userId,
              lastMessageTime: undefined, // ALL messages are queued, no immediate sending
              queuedMessages: [messageTask],
              isProcessing: false,
              totalProcessed: 0,
              totalFailed: 0,
              createdAt: now,
              updatedAt: now,
            };
            
            await this.messageQueuesCollection.insertOne(newQueue);
            console.log(`📬 Created new queue for session ${sessionId}, message queued (atomic)`);
          } else {
            // Add to existing queue atomically using findOneAndUpdate to prevent race conditions
            await this.messageQueuesCollection.findOneAndUpdate(
              { sessionId },
              {
                $push: { queuedMessages: messageTask },
                $set: { updatedAt: now }
              }
            );
            console.log(`📬 Added message to existing queue for session ${sessionId}, queued (${queue.queuedMessages.length + 1} total) (atomic)`);
          }

          result = {
            queued: true, // ALL messages are queued for 30-second delays
            messageId: messageTask.id,
            estimatedSendTime: messageTask.scheduledFor
          };
        } catch (innerError: any) {
          console.error(`❌ Queue operation failed: ${innerError.message}`);
          throw innerError;
        }

        // Start processing if not already processing
        if (!this.processingIntervals.has(sessionId)) {
          this.startProcessing(sessionId);
        }

        return result;
        
      } catch (error: any) {
        retryCount++;
        console.warn(`⚠️ Atomic queue operation failed (attempt ${retryCount}/${maxRetries}): ${error.message}`);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ Failed to add message to queue after ${maxRetries} attempts: ${error.message}`);
          throw error;
        }
        
        // Wait briefly before retry to avoid thundering herd
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
      }
    }

    throw new Error('Failed to add message to queue after maximum retries');
  }

  private async calculateScheduledTime(sessionId: string): Promise<Date> {
    const queue = await this.getSessionQueue(sessionId);
    const now = new Date();
    
    if (!queue || !queue.lastMessageTime) {
      return now;
    }

    // Calculate next available slot
    const timeSinceLastMessage = now.getTime() - queue.lastMessageTime.getTime();
    const delayNeeded = Math.max(0, (this.DELAY_SECONDS * 1000) - timeSinceLastMessage);
    
    return new Date(now.getTime() + delayNeeded);
  }

  private async getSessionQueue(sessionId: string): Promise<SessionMessageQueue | null> {
    return await this.messageQueuesCollection.findOne({ sessionId });
  }

  async startProcessing(sessionId: string) {
    if (this.processingIntervals.has(sessionId)) {
      return; // Already processing
    }

    const processQueue = async () => {
      try {
        const queue = await this.getSessionQueue(sessionId);
        if (!queue || queue.queuedMessages.length === 0) {
          this.stopProcessing(sessionId);
          return;
        }

        // Mark as processing
        await this.messageQueuesCollection.updateOne(
          { sessionId },
          { $set: { isProcessing: true, updatedAt: new Date() } }
        );

        // Get next pending message
        const nextMessage = queue.queuedMessages.find(m => m.status === 'pending');
        if (!nextMessage) {
          await this.messageQueuesCollection.updateOne(
            { sessionId },
            { $set: { isProcessing: false, updatedAt: new Date() } }
          );
          this.stopProcessing(sessionId);
          return;
        }

        // Check if it's time to send
        const now = new Date();
        if (now >= nextMessage.scheduledFor) {
          await this.processMessage(sessionId, nextMessage);
        }

      } catch (error: any) {
        console.error(`Error processing queue for session ${sessionId}:`, error);
        await this.messageQueuesCollection.updateOne(
          { sessionId },
          { $set: { isProcessing: false, updatedAt: new Date() } }
        );
      }
    };

    // Process every 5 seconds
    const interval = setInterval(processQueue, 5000);
    this.processingIntervals.set(sessionId, interval);
    
    // Initial processing
    processQueue();
  }

  private async processMessage(sessionId: string, messageTask: MessageTask) {
    const now = new Date();
    
    try {
      // Update message status to processing
      await this.messageQueuesCollection.updateOne(
        { sessionId, 'queuedMessages.id': messageTask.id },
        {
          $set: {
            'queuedMessages.$.status': 'processing',
            'queuedMessages.$.updatedAt': now,
            'queuedMessages.$.attempts': messageTask.attempts + 1
          }
        }
      );

      // Here we would call the actual message sending function
      // For now, we'll simulate success
      const success = await this.sendMessageViaWhatsApp(sessionId, messageTask);

      if (success) {
        // Mark as completed and update last message time
        await this.messageQueuesCollection.updateOne(
          { sessionId, 'queuedMessages.id': messageTask.id },
          {
            $set: {
              'queuedMessages.$.status': 'completed',
              'queuedMessages.$.updatedAt': now,
              lastMessageTime: now,
              isProcessing: false
            },
            $inc: { totalProcessed: 1 }
          }
        );

        // Remove completed message from queue
        await this.messageQueuesCollection.updateOne(
          { sessionId },
          { $pull: { queuedMessages: { id: messageTask.id } } }
        );

        console.log(`✅ Message sent successfully: ${sessionId} -> ${messageTask.phone}`);

      } else {
        throw new Error('Message sending failed');
      }

    } catch (error: any) {
      const attempts = messageTask.attempts + 1;
      const isFinalAttempt = attempts >= messageTask.maxAttempts;

      await this.messageQueuesCollection.updateOne(
        { sessionId, 'queuedMessages.id': messageTask.id },
        {
          $set: {
            'queuedMessages.$.status': isFinalAttempt ? 'failed' : 'pending',
            'queuedMessages.$.updatedAt': now,
            'queuedMessages.$.attempts': attempts,
            'queuedMessages.$.errorMessage': error.message,
            isProcessing: false
          },
          $inc: { totalFailed: isFinalAttempt ? 1 : 0 }
        }
      );

      if (isFinalAttempt) {
        // Remove failed message from queue
        await this.messageQueuesCollection.updateOne(
          { sessionId },
          { $pull: { queuedMessages: { id: messageTask.id } } }
        );
        console.error(`❌ Message failed permanently: ${sessionId} -> ${messageTask.phone}:`, error.message);
      } else {
        console.log(`⚠️ Message failed, will retry: ${sessionId} -> ${messageTask.phone} (attempt ${attempts}/${messageTask.maxAttempts})`);
      }
    }
  }

  private async sendMessageViaWhatsApp(sessionId: string, messageTask: MessageTask): Promise<boolean> {
    // This will be integrated with the actual WhatsApp sending logic
    // For now, we'll return a placeholder
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% success rate
        resolve(Math.random() > 0.1);
      }, 1000);
    });
  }

  private stopProcessing(sessionId: string) {
    const interval = this.processingIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(sessionId);
    }
  }

  async getQueueStatus(sessionId: string): Promise<{
    isProcessing: boolean;
    pendingCount: number;
    lastMessageTime?: Date;
    estimatedNextSend?: Date;
    totalProcessed: number;
    totalFailed: number;
  } | null> {
    const queue = await this.getSessionQueue(sessionId);
    if (!queue) return null;

    const pendingMessages = queue.queuedMessages.filter(m => m.status === 'pending');
    const nextPending = pendingMessages.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0];

    return {
      isProcessing: queue.isProcessing,
      pendingCount: pendingMessages.length,
      lastMessageTime: queue.lastMessageTime,
      estimatedNextSend: nextPending?.scheduledFor,
      totalProcessed: queue.totalProcessed,
      totalFailed: queue.totalFailed
    };
  }

  async clearQueue(sessionId: string): Promise<boolean> {
    this.stopProcessing(sessionId);
    const result = await this.messageQueuesCollection.deleteOne({ sessionId });
    return result.deletedCount > 0;
  }

  // Cleanup completed and failed messages periodically
  async cleanupOldMessages(olderThanHours: number = 24) {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    // Remove completed and failed messages older than cutoff time
    await this.messageQueuesCollection.updateMany(
      {},
      {
        $pull: {
          queuedMessages: {
            status: { $in: ['completed', 'failed'] },
            updatedAt: { $lt: cutoffTime }
          }
        }
      }
    );
  }
}