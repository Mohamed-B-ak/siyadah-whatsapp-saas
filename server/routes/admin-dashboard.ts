import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Admin dashboard overview
router.get('/overview', async (req, res) => {
  try {
    // Get all system data
    const [companies, users, sessions] = await Promise.all([
      storage.getAllCompanies(),
      storage.getAllUsers(), 
      storage.getAllSessions()
    ]);

    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.isActive).length;
    
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'CONNECTED').length;

    // Calculate plan distribution
    const planDistribution = companies.reduce((acc, company) => {
      acc[company.planType] = (acc[company.planType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate revenue (simulated)
    const monthlyRevenue = companies.reduce((sum, company) => {
      const planPrices = { basic: 29, premium: 99, enterprise: 299 };
      return sum + (planPrices[company.planType as keyof typeof planPrices] || 0);
    }, 0);

    const overview = {
      totals: {
        companies: totalCompanies,
        users: totalUsers,
        sessions: totalSessions,
        revenue: monthlyRevenue
      },
      active: {
        companies: activeCompanies,
        users: activeUsers,
        sessions: activeSessions
      },
      planDistribution,
      growth: {
        companies: Math.round(Math.random() * 15 + 5), // 5-20% growth
        users: Math.round(Math.random() * 20 + 10), // 10-30% growth
        revenue: Math.round(Math.random() * 25 + 15) // 15-40% growth
      },
      systemHealth: {
        uptime: 99.5 + Math.random() * 0.4,
        avgResponseTime: Math.round(50 + Math.random() * 30),
        errorRate: Math.round(Math.random() * 1 * 100) / 100
      }
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد بيانات النظام'
    });
  }
});

// Get all companies with details
router.get('/companies', async (req, res) => {
  try {
    const companies = await storage.getAllCompanies();
    
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const users = await storage.getUsersByCompany(company.id);
        const sessions = await storage.getSessionsByCompany(company.id);
        
        return {
          ...company,
          stats: {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.isActive).length,
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.status === 'CONNECTED').length
          }
        };
      })
    );

    res.json({
      success: true,
      data: companiesWithStats
    });

  } catch (error) {
    console.error('Companies list error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد قائمة الشركات'
    });
  }
});

// Get system logs (simulated)
router.get('/logs', async (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    // Simulate system logs
    const logs = [
      {
        id: 1,
        timestamp: new Date(),
        level: 'info',
        message: 'Company "Tech Solutions" created new user',
        source: 'auth-service',
        details: { companyId: 'comp_123', userId: 'user_456' }
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 300000),
        level: 'warning',
        message: 'Session timeout for user_789',
        source: 'whatsapp-service',
        details: { sessionId: 'session_abc' }
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 600000),
        level: 'error',
        message: 'Failed to send message - API rate limit exceeded',
        source: 'message-service',
        details: { apiKey: 'user_***', attempts: 3 }
      }
    ];

    const filteredLogs = level === 'all' 
      ? logs 
      : logs.filter(log => log.level === level);

    res.json({
      success: true,
      data: filteredLogs.slice(0, Number(limit))
    });

  } catch (error) {
    console.error('System logs error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد سجلات النظام'
    });
  }
});

// Update company status
router.patch('/companies/:companyId/status', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { isActive } = req.body;

    const updatedCompany = await storage.updateCompany(companyId, { isActive });
    
    if (!updatedCompany) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: `تم ${isActive ? 'تفعيل' : 'إلغاء تفعيل'} الشركة بنجاح`,
      data: updatedCompany
    });

  } catch (error) {
    console.error('Update company status error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الشركة'
    });
  }
});

// System maintenance actions
router.post('/maintenance/:action', async (req, res) => {
  try {
    const { action } = req.params;
    
    let result;
    
    switch (action) {
      case 'cleanup-sessions':
        // Simulate cleanup
        result = { cleaned: Math.floor(Math.random() * 10 + 5) };
        break;
        
      case 'backup-database':
        // Simulate backup
        result = { 
          backupId: `backup_${Date.now()}`,
          size: `${Math.floor(Math.random() * 500 + 100)}MB`
        };
        break;
        
      case 'clear-logs':
        // Simulate log clearing
        result = { cleared: Math.floor(Math.random() * 1000 + 500) };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'إجراء صيانة غير معروف'
        });
    }

    res.json({
      success: true,
      message: `تم تنفيذ إجراء ${action} بنجاح`,
      data: result
    });

  } catch (error) {
    console.error('Maintenance action error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تنفيذ إجراء الصيانة'
    });
  }
});

export default router;