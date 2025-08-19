/**
 * Session Status Polling Endpoint for Frontend
 * Optimized for Render.com deployment with clear status updates
 */
import { Router } from 'express';
import { storage } from './storage';
import { authenticateUser, type AuthenticatedRequest } from './saas-auth';
import { SessionStatus, SessionStatusManager } from './session-status';
import { SessionValidator } from './session-validator';

const router = Router();

// Get current session status for polling
router.get('/sessions/:sessionName/status', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    
    if (!userId || !companyId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    // Build full session ID
    const fullSessionId = SessionValidator.buildFullSessionId(companyId, sessionName);
    
    // Get session from database
    const sessionData = await storage.getSessionByName(fullSessionId);
    
    if (!sessionData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // Return comprehensive status response
    const statusResponse = SessionStatusManager.createStatusResponse(
      sessionData.status as SessionStatus,
      sessionData.qrCode || undefined,
      sessionData.qrCodeGeneratedAt || undefined
    );

    // Add additional metadata for frontend
    res.json({
      ...statusResponse,
      sessionId: sessionData.id,
      lastUpdated: sessionData.lastUpdated || sessionData.createdAt,
      pollingInterval: SessionStatusManager.getPollingInterval(sessionData.status as SessionStatus),
      shouldPoll: SessionStatusManager.shouldAllowPolling(sessionData.status as SessionStatus)
    });

  } catch (error) {
    console.error('[SESSION-STATUS] Error getting session status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get session status',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get QR code with polling support
router.get('/sessions/:sessionName/qr-poll', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionName } = req.params;
    const { timeout = '30' } = req.query; // Timeout in seconds
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    
    if (!userId || !companyId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    const fullSessionId = SessionValidator.buildFullSessionId(companyId, sessionName);
    const timeoutMs = Math.min(parseInt(timeout as string) * 1000, 60000); // Max 60 seconds
    const startTime = Date.now();

    // Poll for QR code with timeout
    while (Date.now() - startTime < timeoutMs) {
      const sessionData = await storage.getSessionByName(fullSessionId);
      
      if (!sessionData) {
        return res.status(404).json({ 
          success: false, 
          message: 'Session not found' 
        });
      }

      const currentStatus = sessionData.status as SessionStatus;
      
      // If QR is available, return it
      if (sessionData.qrCode && currentStatus === SessionStatus.QRCODE) {
        return res.json(SessionStatusManager.createStatusResponse(
          currentStatus,
          sessionData.qrCode,
          sessionData.qrCodeGeneratedAt || undefined,
          'QR code ready for scanning'
        ));
      }
      
      // If session is in terminal state, return status
      if (SessionStatusManager.isTerminalStatus(currentStatus)) {
        return res.json(SessionStatusManager.createStatusResponse(
          currentStatus,
          undefined,
          undefined,
          SessionStatusManager.getHumanReadableStatus(currentStatus)
        ));
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Timeout reached
    return res.json(SessionStatusManager.createStatusResponse(
      SessionStatus.TIMEOUT,
      undefined,
      undefined,
      'QR code generation timeout - please try again'
    ));

  } catch (error) {
    console.error('[SESSION-QR-POLL] Error during QR polling:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to poll for QR code',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;