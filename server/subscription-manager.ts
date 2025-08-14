import { Router } from 'express';
import { storage } from './storage';
import { authenticateJWT, requireCompany, AuthenticatedRequest } from './auth-middleware';

const router = Router();

// Subscription plans
const PLANS = {
  basic: {
    name: 'Basic',
    maxUsers: 10,
    maxSessions: 5,
    maxMessages: 1000,
    price: 29,
    features: ['WhatsApp API', 'Basic Support', 'Dashboard']
  },
  premium: {
    name: 'Premium',
    maxUsers: 50,
    maxSessions: 25,
    maxMessages: 10000,
    price: 99,
    features: ['WhatsApp API', 'Priority Support', 'Advanced Dashboard', 'Analytics']
  },
  enterprise: {
    name: 'Enterprise',
    maxUsers: 100,
    maxSessions: 50,
    maxMessages: -1, // Unlimited
    price: 299,
    features: ['WhatsApp API', '24/7 Support', 'Custom Dashboard', 'Advanced Analytics', 'Custom Integrations']
  }
};

// Get available plans
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    data: PLANS
  });
});

// Get company's current subscription
router.get('/current', authenticateJWT, requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const company = req.company;
    const currentPlan = PLANS[company.planType as keyof typeof PLANS];
    
    // Get usage statistics
    const users = await storage.getUsersByCompany(company.id);
    const sessions = await storage.getSessionsByCompany(company.id);
    
    const usage = {
      users: {
        current: users.length,
        limit: currentPlan.maxUsers,
        percentage: Math.round((users.length / currentPlan.maxUsers) * 100)
      },
      sessions: {
        current: sessions.length,
        limit: currentPlan.maxSessions,
        percentage: Math.round((sessions.length / currentPlan.maxSessions) * 100)
      },
      messages: {
        current: Math.floor(Math.random() * currentPlan.maxMessages || 800), // Placeholder
        limit: currentPlan.maxMessages,
        percentage: currentPlan.maxMessages === -1 ? 0 : Math.round((800 / currentPlan.maxMessages) * 100)
      }
    };

    res.json({
      success: true,
      data: {
        currentPlan: {
          type: company.planType,
          ...currentPlan
        },
        usage,
        billingInfo: {
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: 'active'
        }
      }
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد معلومات الاشتراك'
    });
  }
});

// Upgrade/downgrade subscription
router.post('/change', authenticateJWT, requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { newPlan } = req.body;
    const company = req.company;

    if (!PLANS[newPlan as keyof typeof PLANS]) {
      return res.status(400).json({
        success: false,
        message: 'خطة اشتراك غير صالحة'
      });
    }

    const planDetails = PLANS[newPlan as keyof typeof PLANS];

    // Check if downgrade is possible (usage constraints)
    const users = await storage.getUsersByCompany(company.id);
    const sessions = await storage.getSessionsByCompany(company.id);

    if (users.length > planDetails.maxUsers) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن التراجع للخطة ${planDetails.name}. لديك ${users.length} مستخدمين والحد الأقصى للخطة الجديدة ${planDetails.maxUsers}`
      });
    }

    if (sessions.length > planDetails.maxSessions) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن التراجع للخطة ${planDetails.name}. لديك ${sessions.length} جلسات والحد الأقصى للخطة الجديدة ${planDetails.maxSessions}`
      });
    }

    // Update company plan
    const updatedCompany = await storage.updateCompany(company.id, {
      planType: newPlan,
      maxUsers: planDetails.maxUsers,
      maxSessions: planDetails.maxSessions
    });

    res.json({
      success: true,
      message: `تم تغيير الاشتراك إلى خطة ${planDetails.name} بنجاح`,
      data: {
        newPlan: {
          type: newPlan,
          ...planDetails
        },
        effectiveDate: new Date()
      }
    });

  } catch (error) {
    console.error('Plan change error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تغيير خطة الاشتراك'
    });
  }
});

// Get billing history
router.get('/billing-history', authenticateJWT, requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // Simulate billing history
    const history = [
      {
        id: 1,
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        plan: 'Premium',
        amount: 99,
        status: 'paid'
      },
      {
        id: 2,
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        plan: 'Basic',
        amount: 29,
        status: 'paid'
      }
    ];

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Billing history error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد تاريخ الفوترة'
    });
  }
});

// Usage analytics
router.get('/usage-analytics', authenticateJWT, requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const company = req.company;
    const { period = '30d' } = req.query;

    // Get daily usage for the period
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const dailyUsage = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dailyUsage.push({
        date: date.toISOString().split('T')[0],
        messages: Math.floor(Math.random() * 200) + 50,
        sessions: Math.floor(Math.random() * 10) + 1,
        users: Math.floor(Math.random() * 5) + 1
      });
    }

    const currentPlan = PLANS[company.planType as keyof typeof PLANS];
    const totalMessages = dailyUsage.reduce((sum, day) => sum + day.messages, 0);

    res.json({
      success: true,
      data: {
        period,
        currentPlan: {
          type: company.planType,
          ...currentPlan
        },
        summary: {
          totalMessages,
          avgDailyMessages: Math.round(totalMessages / days),
          peakMessages: Math.max(...dailyUsage.map(d => d.messages)),
          utilizationRate: currentPlan.maxMessages === -1 ? 0 : Math.round((totalMessages / currentPlan.maxMessages) * 100)
        },
        dailyUsage
      }
    });

  } catch (error) {
    console.error('Usage analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد تحليلات الاستخدام'
    });
  }
});

export default router;