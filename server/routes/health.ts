import { Router } from 'express';
import { mongoConnection } from '../mongodb';

const router = Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const mongoStatus = await mongoConnection.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        server: 'running',
        mongodb: mongoStatus ? 'connected' : 'disconnected',
        whatsapp: 'available'
      },
      version: '2.8.6'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;