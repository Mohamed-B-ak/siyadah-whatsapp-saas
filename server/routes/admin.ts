import { Router } from 'express';
import { authenticateCompany } from '../middleware/auth';
import { MongoStorage } from '../mongodb';

const router = Router();
const storage = new MongoStorage();

// Get all companies (admin only)
router.get('/companies', authenticateCompany, async (req: any, res) => {
  try {
    const companies = await storage.getAllCompanies();
    return res.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error('Get companies error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get companies'
    });
  }
});

// Get system statistics
router.get('/stats', authenticateCompany, async (req: any, res) => {
  try {
    const companies = await storage.getAllCompanies();
    const users = await storage.getAllUsers();
    const sessions = await storage.getAllSessions();

    const stats = {
      totalCompanies: companies.length,
      totalUsers: users.length,
      totalSessions: sessions.length,
      activeCompanies: companies.filter(c => c.isActive).length,
      activeUsers: users.filter(u => u.isActive).length,
      activeSessions: sessions.filter(s => s.status === 'connected').length
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

export default router;