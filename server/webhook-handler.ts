import { Router } from 'express';
import { storage } from './storage';
import { webhookValidator } from './webhook-validator';
import { SessionStatus, SessionStatusManager } from './session-status';

const router = Router();

// Webhook endpoint for receiving WhatsApp messages
router.post('/webhook-handler', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));
    
    // Handle different webhook events
    if (webhookData.event === 'onmessage') {
      const { 
        session, 
        from, 
        to, 
        body, 
        type, 
        timestamp,
        id: messageId 
      } = webhookData;
      
      // Find session by WhatsApp session name
      const sessionData = await storage.getSession(session);
      
      if (sessionData) {
        // Log incoming message
        await storage.logMessage({
          sessionId: sessionData.id,
          userId: sessionData.userId,
          companyId: sessionData.companyId,
          type: 'incoming',
          from: from,
          to: to,
          content: body,
          status: 'received',
          whatsappMessageId: messageId,
          timestamp: new Date(timestamp * 1000)
        });
        
        console.log(`Message logged for session ${session}: ${from} -> ${body}`);
      }
    } else if (webhookData.event === 'onqr') {
      // QR code event
      const { session, qrcode } = webhookData;
      console.log(`[WEBHOOK] QR code generated for session ${session}`);
      
      // Update session with QR code
      const sessionData = await storage.getSession(session);
      if (sessionData) {
        await storage.updateSession(sessionData.id, {
          qrCode: qrcode,
          status: SessionStatus.QRCODE,
          whatsappStatus: 'QRCODE',
          qrCodeGeneratedAt: new Date()
        });
        console.log(`[WEBHOOK] Session ${session} status updated to QRCODE`);
      }
    } else if (webhookData.event === 'onstatechange') {
      // Status change event
      const { session, state } = webhookData;
      console.log(`[WEBHOOK] Session ${session} state changed to: ${state}`);
      
      // Update session status with proper enum mapping
      const sessionData = await storage.getSession(session);
      if (sessionData) {
        let newStatus: SessionStatus;
        switch (state) {
          case 'CONNECTED':
            newStatus = SessionStatus.CONNECTED;
            break;
          case 'QRCODE':
            newStatus = SessionStatus.QRCODE;
            break;
          case 'DISCONNECTED':
            newStatus = SessionStatus.DISCONNECTED;
            break;
          case 'CONNECTING':
            newStatus = SessionStatus.CONNECTING;
            break;
          default:
            newStatus = SessionStatus.ERROR;
        }
        
        await storage.updateSession(sessionData.id, {
          whatsappStatus: state,
          status: newStatus,
          lastUpdated: new Date()
        });
        console.log(`[WEBHOOK] Session ${session} status updated to ${newStatus}`);
      }
    }
    
    // Always respond with success
    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      event: webhookData.event 
    });
    
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Webhook processing failed',
      error: error.message 
    });
  }
});

// Test webhook endpoint
router.get('/webhook-test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});

// Get webhook logs for a session
router.get('/webhook-logs/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await storage.getMessageHistory(sessionId, 50);
    
    res.json({
      success: true,
      messages: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook logs',
      error: error.message
    });
  }
});

export default router;