import { Request, Response, Router } from 'express';
import { mongoConnection } from './mongodb';
import { migrateToMongoDB } from './migrate-to-mongodb';

const router = Router();

// Test MongoDB connection (primary database)
router.post('/test', async (req: Request, res: Response) => {
  try {
    const status = {
      mongodb: false
    };

    // Test MongoDB
    try {
      await mongoConnection.healthCheck();
      status.mongodb = true;
    } catch (error) {
      console.log('MongoDB test failed:', error);
    }

    res.json({
      success: true,
      status,
      message: 'MongoDB connection test completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error testing MongoDB connection: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// Get MongoDB status (primary database)
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      mongodb: false
    };

    // Check MongoDB
    try {
      await mongoConnection.healthCheck();
      status.mongodb = true;
    } catch (error) {
      console.log('MongoDB status check failed:', error);
    }

    res.json({
      success: true,
      status,
      active: 'mongodb',
      message: 'MongoDB status retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting MongoDB status: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// MongoDB is the only database - no switching needed
router.post('/switch', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MongoDB is the primary database - no switching available',
    active: 'mongodb'
  });
});

// Get MongoDB configuration
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = {
      current: 'mongodb',
      mongodb: {
        available: true,
        uri: 'Connected to MongoDB Atlas',
        status: 'Primary Database'
      }
    };

    res.json({
      success: true,
      config,
      message: 'MongoDB configuration retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting MongoDB config: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

// Migrate data from PostgreSQL to MongoDB
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    await migrateToMongoDB();
    
    res.json({
      success: true,
      message: 'Data migration from PostgreSQL to MongoDB completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during migration: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
});

export default router;