import { MongoStorage } from '../mongodb';

class SessionManager {
  private sessions = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private storage: MongoStorage;

  constructor() {
    this.storage = new MongoStorage();
    
    // Start cleanup process every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 300000);
    
    console.log('🧹 Session cleanup manager initialized');
  }

  // Add session to memory tracking
  trackSession(sessionId: string, sessionData: any) {
    this.sessions.set(sessionId, {
      ...sessionData,
      lastActivity: Date.now(),
      createdAt: Date.now()
    });
  }

  // Update session activity
  updateActivity(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  // Get session info
  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  // Remove session
  removeSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  // Cleanup inactive sessions
  private async cleanupInactiveSessions() {
    const now = Date.now();
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > inactivityThreshold) {
        try {
          // Update session status in database
          await this.storage.updateSession(sessionId, {
            status: 'inactive',
            lastActivity: new Date(session.lastActivity)
          });

          // Remove from memory
          this.sessions.delete(sessionId);
          cleanedCount++;
          
          console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
        } catch (error) {
          console.error(`❌ Failed to cleanup session ${sessionId}:`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Session cleanup completed: ${cleanedCount} sessions removed`);
    }
  }

  // Get session statistics
  getStats() {
    const now = Date.now();
    let activeSessions = 0;
    let inactiveSessions = 0;

    for (const [, session] of this.sessions) {
      if (now - session.lastActivity < 300000) { // 5 minutes
        activeSessions++;
      } else {
        inactiveSessions++;
      }
    }

    return {
      total: this.sessions.size,
      active: activeSessions,
      inactive: inactiveSessions,
      memoryUsage: process.memoryUsage()
    };
  }

  // Destroy session manager
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    console.log('🧹 Session manager destroyed');
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default SessionManager;