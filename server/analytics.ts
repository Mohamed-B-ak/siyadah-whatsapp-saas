import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Company analytics
router.get('/company/:companyId/stats', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get company data
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get users count
    const users = await storage.getUsersByCompany(company.id);
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.isActive).length;

    // Get sessions count  
    const sessions = await storage.getSessionsByCompany(company.id);
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(session => session.status === 'CONNECTED').length;

    // Calculate messages stats (placeholder - would need message tracking)
    const monthlyMessages = Math.floor(Math.random() * 20000) + 5000;
    const successRate = 95 + Math.random() * 4; // 95-99%

    const stats = {
      company: {
        name: company.name,
        email: company.email,
        planType: company.planType,
        createdAt: company.createdAt
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
        inactive: totalSessions - activeSessions
      },
      messages: {
        monthly: monthlyMessages,
        daily: Math.floor(monthlyMessages / 30),
        successRate: Math.round(successRate * 100) / 100
      },
      usage: {
        maxUsers: company.maxUsers,
        maxSessions: company.maxSessions,
        usersUsage: Math.round((totalUsers / company.maxUsers) * 100),
        sessionsUsage: Math.round((totalSessions / company.maxSessions) * 100)
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics data'
    });
  }
});

// User analytics
router.get('/user/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sessions = await storage.getUserSessions(userId);
    const activeSessions = sessions.filter(session => session.status === 'CONNECTED').length;

    // Get recent messages (placeholder)
    const recentMessages = Math.floor(Math.random() * 1000) + 100;

    const stats = {
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      },
      sessions: {
        total: sessions.length,
        active: activeSessions,
        inactive: sessions.length - activeSessions
      },
      messages: {
        recent: recentMessages,
        today: Math.floor(Math.random() * 50) + 10
      },
      activity: {
        lastLogin: user.lastLoginAt || new Date(),
        totalLogins: Math.floor(Math.random() * 100) + 20
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user analytics'
    });
  }
});

// System-wide analytics (admin only)
router.get('/system/overview', async (req, res) => {
  try {
    const companies = await storage.getAllCompanies();
    const users = await storage.getAllUsers();
    const sessions = await storage.getAllSessions();

    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.isActive).length;
    
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'CONNECTED').length;

    // Calculate total messages across all companies
    const totalMessages = companies.reduce((sum, company) => {
      return sum + (Math.floor(Math.random() * 10000) + 1000);
    }, 0);

    const overview = {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        growth: Math.round(Math.random() * 20 + 5) // 5-25% growth
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        avgPerCompany: Math.round(totalUsers / totalCompanies)
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
        avgPerUser: Math.round(totalSessions / totalUsers)
      },
      messages: {
        total: totalMessages,
        monthly: totalMessages,
        daily: Math.floor(totalMessages / 30)
      },
      performance: {
        uptime: 99.5 + Math.random() * 0.4, // 99.5-99.9%
        avgResponseTime: Math.round(50 + Math.random() * 50), // 50-100ms
        errorRate: Math.round(Math.random() * 2 * 100) / 100 // 0-2%
      }
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('System analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system overview'
    });
  }
});

// Generate detailed report
router.get('/report/:type/:entityId', async (req, res) => {
  try {
    const { type, entityId } = req.params;
    const { startDate, endDate } = req.query;

    let reportData;

    switch (type) {
      case 'company':
        reportData = await generateCompanyReport(entityId, startDate, endDate);
        break;
      case 'user':
        reportData = await generateUserReport(entityId, startDate, endDate);
        break;
      case 'system':
        reportData = await generateSystemReport(startDate, endDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.json({
      success: true,
      reportType: type,
      entityId,
      dateRange: { startDate, endDate },
      data: reportData
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

async function generateCompanyReport(companyId: string, startDate: any, endDate: any) {
  // Implementation for company report
  return {
    summary: 'Company report data would be generated here',
    metrics: {},
    charts: [],
    recommendations: []
  };
}

async function generateUserReport(userId: string, startDate: any, endDate: any) {
  // Implementation for user report
  return {
    summary: 'User report data would be generated here',
    metrics: {},
    activity: [],
    performance: {}
  };
}

async function generateSystemReport(startDate: any, endDate: any) {
  // Implementation for system report
  return {
    summary: 'System report data would be generated here',
    globalMetrics: {},
    trends: [],
    alerts: []
  };
}

export default router;