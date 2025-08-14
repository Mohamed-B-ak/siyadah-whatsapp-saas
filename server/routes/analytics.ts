import { Router } from 'express';
import { authenticateCompany } from '../middleware/auth';
import { MongoStorage } from '../mongodb';

const router = Router();
const storage = new MongoStorage();

// Get company analytics
router.get('/company', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const users = await storage.getUsersByCompany(company.id);
    const sessions = await storage.getSessionsByCompany(company.id);

    const analytics = {
      company: {
        name: company.name,
        plan: company.planType,
        createdAt: company.createdAt
      },
      usage: {
        totalUsers: users.length,
        totalSessions: sessions.length,
        activeUsers: users.filter(u => u.isActive).length,
        activeSessions: sessions.filter(s => s.status === 'connected').length
      },
      performance: {
        messagesThisMonth: Math.floor(Math.random() * 1000), // TODO: Implement real metrics
        successRate: 98.5,
        averageResponseTime: '1.2s'
      }
    };

    return res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

export default router;