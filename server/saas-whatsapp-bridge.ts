import { Router } from 'express';
import { storage } from './storage';
import { authenticateUser, authenticateSession, type AuthenticatedRequest } from './saas-auth';

const router = Router();

// Bridge SaaS authentication with WhatsApp API
router.use('/sessions', authenticateUser);

// Create WhatsApp session for authenticated user
router.post('/sessions/:sessionName/create', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    
    if (!userId || !companyId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Create session with full session ID that matches WPPConnect format
    const sessionId = `${companyId}_${sessionName}`;
    console.log(`[SESSION-CREATE] Creating session in database: ${sessionId}`);
    console.log(`[SESSION-CREATE] User: ${userId}, Company: ${companyId}, Name: ${sessionName}`);
    
    // Create session in database
    const sessionData = await storage.createSession({
      id: sessionId,
      userId: userId,
      companyId: companyId,
      sessionName: sessionName,
      status: 'initializing',
      qrCode: undefined,
      webhook: req.body.webhook,
      config: {
        autoClose: 0,
        qrTimeout: 0,
        authTimeoutMs: 0
      }
    });
    
    console.log(`[SESSION-CREATE] Session created successfully in database: ${sessionData.id}`);
    
    // Verify session was stored
    const verifySession = await storage.getSessionByName(sessionId);
    console.log(`[SESSION-VERIFY] Session verification: ${verifySession ? 'FOUND' : 'NOT FOUND'}`);
    
    if (!verifySession) {
      console.error(`[SESSION-ERROR] Failed to verify session creation for: ${sessionId}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Session creation verification failed' 
      });
    }

    // Start actual WhatsApp session
    const { getBaseUrl } = await import('./config/environment');
    const baseUrl = getBaseUrl();
    
    const whatsappResponse = await fetch(`${baseUrl}/api/${sessionData.id}/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: sessionData.webhook,
        waitQrCode: true
      })
    });

    const whatsappResult = await whatsappResponse.json();

    // Update session with WhatsApp response
    console.log(`[SESSION-UPDATE] Updating session ${sessionData.id} with QR code`);
    console.log(`[SESSION-UPDATE] QR code present: ${!!whatsappResult.qrcode}`);
    
    const updatedSession = await storage.updateSession(sessionData.id, {
      status: 'qr_pending',
      qrCode: whatsappResult.qrcode || null
    });
    
    console.log(`[SESSION-UPDATE] Session update result: ${!!updatedSession}`);

    res.json({
      success: true,
      session: sessionData,
      qrCode: whatsappResult.qrcode,
      message: 'Session created successfully'
    });

  } catch (error: any) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create session',
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get session QR code
router.get('/sessions/:sessionName/qrcode', authenticateUser, authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionId = req.sessionData?.id;
    
    if (!sessionId) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // First check if we have a stored QR code in database
    const sessionData = await storage.getSessionByName(sessionId);
    
    if (sessionData && sessionData.qrCode) {
      console.log(`[QR-DATABASE] Found stored QR code for session: ${sessionId}`);
      return res.json({
        success: true,
        qrCode: sessionData.qrCode,
        status: sessionData.status,
        source: 'database',
        generatedAt: sessionData.qrCodeGeneratedAt
      });
    }

    console.log(`[QR-DATABASE] No stored QR code found for session: ${sessionId}, fetching from WhatsApp API`);

    // Fallback: Get QR from WhatsApp API
    const { getBaseUrl } = await import('./config/environment');
    const baseUrl = getBaseUrl();
    
    const qrResponse = await fetch(`${baseUrl}/api/${sessionId}/qrcode-session`);
    
    if (qrResponse.headers.get('content-type')?.includes('image')) {
      // Return image directly
      const imageBuffer = await qrResponse.arrayBuffer();
      res.set('Content-Type', 'image/png');
      res.send(Buffer.from(imageBuffer));
    } else {
      // Return JSON with base64
      const qrData = await qrResponse.json();
      res.json({
        success: true,
        qrCode: qrData.qrcode || qrData.base64,
        status: qrData.status,
        source: 'live_api'
      });
    }

  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get QR code',
      error: error.message 
    });
  }
});

// Get session QR code (alternative endpoint)
router.get('/sessions/:sessionName/qr', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    
    if (!userId || !companyId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    // Construct full session ID that matches creation format
    const fullSessionId = `${companyId}_${sessionName}`;
    
    console.log(`[QR-REQUEST] QR code requested for session: ${sessionName} -> ${fullSessionId}`);

    // First check if we have a stored QR code in database (PRIORITY)
    const sessionData = await storage.getSessionByName(fullSessionId);
    
    if (sessionData && sessionData.qrCode) {
      console.log(`[QR-REQUEST] QR code data found for session: ${fullSessionId}`);
      console.log(`[QR-REQUEST] urlcode present: ${!!sessionData.qrCode.includes('2@')}`);
      console.log(`[QR-REQUEST] qrcode present: ${!!sessionData.qrCode}`);
      console.log(`[QR-REQUEST] Client status: ${sessionData.status || 'unknown'}`);
      
      let qrCodeToReturn = sessionData.qrCode;
      
      // If we have urlcode, convert it to QR image
      if (sessionData.qrCode.includes('2@') && !sessionData.qrCode.startsWith('data:')) {
        try {
          const QRCode = require('qrcode');
          const pngBuffer = await QRCode.toBuffer(sessionData.qrCode, {
            type: 'png',
            quality: 0.92,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          qrCodeToReturn = `data:image/png;base64,${pngBuffer.toString('base64')}`;
          console.log(`[QR-REQUEST] Fresh PNG buffer generated - Size: ${pngBuffer.length} bytes`);
          
        } catch (qrError) {
          console.error('[QR-REQUEST] Error generating QR PNG:', qrError);
          qrCodeToReturn = sessionData.qrCode; // Fallback to stored data
        }
      }
      
      console.log(`[QR-REQUEST] QR code length: ${qrCodeToReturn.length}`);
      console.log(`[QR-REQUEST] QR code format: ${qrCodeToReturn.substring(0, 30)}...`);
      
      return res.json({
        success: true,
        qrCode: qrCodeToReturn,
        status: sessionData.status,
        source: 'database',
        generatedAt: sessionData.qrCodeGeneratedAt
      });
    } else {
      console.warn(`[QR-REQUEST] Session not found in database: ${fullSessionId}`);
    }

    console.log(`[QR-REQUEST] No stored QR code found for session: ${fullSessionId}, attempting WhatsApp API`);

    // Fallback: Get QR from WhatsApp API
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'siyadah-whatsapp-saas.onrender.com'}`
      : 'http://localhost:5000';
      
    const qrResponse = await fetch(`${baseUrl}/api/${fullSessionId}/qrcode-session`);
    
    if (qrResponse.headers.get('content-type')?.includes('image')) {
      // Convert image to base64 for JSON response
      const imageBuffer = await qrResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      res.json({
        success: true,
        qrCode: `data:image/png;base64,${base64}`,
        status: 'qr_pending',
        source: 'live_api'
      });
    } else {
      // Return JSON with base64
      const qrData = await qrResponse.json();
      res.json({
        success: true,
        qrCode: qrData.qrcode || qrData.base64,
        status: qrData.status,
        source: 'live_api'
      });
    }

  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get QR code',
      error: error.message 
    });
  }
});

// Check session status
router.get('/sessions/:sessionName/status', authenticateUser, authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionId = req.sessionData?.id;
    
    if (!sessionId) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Get status from WhatsApp API
    const { getBaseUrl } = await import('./config/environment');
    const baseUrl = getBaseUrl();
      
    const statusResponse = await fetch(`${baseUrl}/api/${sessionId}/status-session`);
    const statusData = await statusResponse.json();

    // Update session in database
    await storage.updateSession(sessionId, {
      status: statusData.status === 'CONNECTED' ? 'connected' : 
              statusData.status === 'QRCODE' ? 'qr_pending' : 'disconnected'
    });

    res.json({
      success: true,
      status: statusData.status,
      sessionInfo: req.sessionData,
      whatsappData: statusData
    });

  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check status',
      error: error.message 
    });
  }
});

// Send message through authenticated session
router.post('/sessions/:sessionName/send-message', authenticateUser, authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionId = req.sessionData?.id;
    const { phone, message } = req.body;
    
    if (!sessionId) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Phone and message are required' });
    }

    // Send message through WhatsApp API
    const { getBaseUrl } = await import('./config/environment');
    const baseUrl = getBaseUrl();
      
    const messageResponse = await fetch(`${baseUrl}/api/${sessionId}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });

    const messageResult = await messageResponse.json();

    // Log message in database (skip if not available)
    try {
      if (storage.logMessage) {
        await storage.logMessage({
          sessionId: sessionId,
          userId: req.user?.id || '',
          companyId: req.user?.companyId || '',
          type: 'outgoing',
          from: sessionId,
          to: phone,
          content: message,
          status: messageResult.status || 'sent',
          whatsappMessageId: messageResult.id
        });
      }
    } catch (logError) {
      console.warn('Message logging skipped:', logError);
    }

    // Log API usage
    await storage.logApiUsage({
      userId: req.user?.id,
      companyId: req.user?.companyId,
      endpoint: 'send-message',
      method: 'POST',

      responseStatus: messageResponse.status,
      responseTime: Date.now() - (req.startTime || Date.now())
    });

    res.json({
      success: true,
      messageId: messageResult.id,
      status: messageResult.status,
      result: messageResult
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message',
      error: error.message 
    });
  }
});

// Get user's sessions
router.get('/sessions', authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }

    const sessions = await storage.getUserSessions(userId);
    
    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get sessions',
      error: error.message 
    });
  }
});

// Delete session
router.delete('/sessions/:sessionName', authenticateUser, authenticateSession, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionId = req.sessionData?.id;
    
    if (!sessionId) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Close WhatsApp session
    try {
      const { getBaseUrl } = await import('./config/environment');
      const baseUrl = getBaseUrl();
        
      await fetch(`${baseUrl}/api/${sessionId}/close-session`, {
        method: 'POST'
      });
    } catch (error) {
      console.log('WhatsApp session close error (may be already closed):', error.message);
    }

    // Delete from database
    await storage.deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete session',
      error: error.message 
    });
  }
});

export default router;
