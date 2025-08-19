import { Router } from 'express';
import { authenticateCompany } from '../middleware/auth';
import { MongoStorage } from '../mongodb';

const router = Router();
const storage = new MongoStorage();

// Create WhatsApp session
router.post('/sessions', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const { sessionName, webhook } = req.body;
    
    const finalSessionName = sessionName || `session_${Date.now()}`;
    
    const sessionData = {
      userId: `admin_${company.id}`,
      companyId: company.id,
      sessionName: finalSessionName,
      status: 'initializing',
      qrCode: null,
      webhook: webhook || null,
      config: {
        autoClose: 0,
        qrTimeout: 0,
        authTimeoutMs: 0
      }
    };

    const session = await storage.createSession(sessionData);
    
    // Also start the actual WhatsApp session
    try {
      const axios = require('axios');
      await axios.post(`http://localhost:5000/api/${finalSessionName}/start-session`, {
        webhook: webhook || '',
        waitQrCode: true
      }, {
        headers: { 'Authorization': req.headers.authorization }
      });
      
      // Update session status
      sessionData.status = 'starting';
      await storage.updateSession(session.id, { status: 'starting' });
      
    } catch (startError) {
      console.log('WhatsApp session start initiated (may timeout, this is normal)');
    }
    
    return res.json({
      success: true,
      session,
      message: 'Session created successfully',
      qrAvailable: `GET /api/v1/whatsapp/sessions/${finalSessionName}/qr`
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create session'
    });
  }
});

// Send message
router.post('/sessions/:sessionName/send', authenticateCompany, async (req: any, res) => {
  try {
    const { sessionName } = req.params;
    const { phone, message } = req.body;
    const company = req.company;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone and message are required'
      });
    }

    // Store message in database
    const messageData = {
      sessionId: sessionName,
      companyId: company.id,
      userId: company.id,
      phone: phone,
      message: message,
      direction: 'outbound',
      status: 'sent'
    };

    await storage.createMessage(messageData);

    return res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        sessionName,
        phone,
        message,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Get session status
router.get('/sessions/:sessionName/status', authenticateCompany, async (req: any, res) => {
  try {
    const { sessionName } = req.params;
    const company = req.company;

    const session = await storage.getSessionByName(sessionName);
    
    if (!session || session.companyId !== company.id) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    return res.json({
      success: true,
      status: session.status || 'disconnected',
      sessionName,
      createdAt: session.createdAt
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check status'
    });
  }
});

// Generate QR code - redirect to actual WhatsApp API
router.get('/sessions/:sessionName/qr', authenticateCompany, async (req: any, res) => {
  try {
    const { sessionName } = req.params;
    const company = req.company;

    // First ensure session exists in our database
    const session = await storage.getSessionByName(sessionName);
    if (!session || session.companyId !== company.id) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Redirect to actual WhatsApp QR endpoint
    const qrUrl = `/api/${sessionName}/qrcode-session`;
    
    // If JSON requested, proxy the response
    if (req.headers.accept?.includes('application/json')) {
      try {
        const axios = require('axios');
        const qrResponse = await axios.get(`http://localhost:5000${qrUrl}`, {
          headers: { 'Authorization': req.headers.authorization }
        });
        
        return res.json({
          success: true,
          qrCode: qrResponse.data,
          sessionName,
          message: 'QR code generated from WhatsApp API'
        });
      } catch (apiError) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp API not ready. Try creating session first.',
          hint: `Use: POST /api/${sessionName}/start-session`
        });
      }
    } else {
      // Redirect to actual QR endpoint
      return res.redirect(qrUrl);
    }
  } catch (error) {
    console.error('QR generation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

// List sessions
router.get('/sessions', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const sessions = await storage.getSessionsByCompany(company.id);
    
    return res.json({
      success: true,
      sessions: sessions.map(s => ({
        sessionName: s.sessionName,
        status: s.status,
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list sessions'
    });
  }
});

export default router;