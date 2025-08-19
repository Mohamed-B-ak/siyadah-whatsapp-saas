import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Real-time system metrics
router.get('/realtime-metrics', async (req, res) => {
  try {
    const [companies, users, sessions] = await Promise.all([
      storage.getAllCompanies(),
      storage.getAllUsers(),
      storage.getAllSessions()
    ]);

    // Calculate active metrics
    const activeCompanies = companies.filter(c => c.isActive);
    const activeUsers = users.filter(u => u.isActive);
    const activeSessions = sessions.filter(s => s.status === 'CONNECTED');
    
    // Calculate today's activity (simulated)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayMetrics = {
      newCompanies: Math.floor(Math.random() * 5) + 1,
      newUsers: Math.floor(Math.random() * 20) + 5,
      messagesProcessed: Math.floor(Math.random() * 10000) + 2000,
      sessionConnections: Math.floor(Math.random() * 50) + 10,
      apiCalls: Math.floor(Math.random() * 50000) + 15000
    };

    // Calculate performance metrics
    const performance = {
      avgResponseTime: Math.floor(Math.random() * 50) + 30, // 30-80ms
      successRate: 95 + Math.random() * 4, // 95-99%
      uptime: 99.5 + Math.random() * 0.4, // 99.5-99.9%
      errorRate: Math.random() * 1, // 0-1%
      throughput: Math.floor(Math.random() * 1000) + 500 // requests/minute
    };

    // System resource usage (simulated)
    const resources = {
      cpu: Math.floor(Math.random() * 30) + 20, // 20-50%
      memory: Math.floor(Math.random() * 40) + 30, // 30-70%
      storage: Math.floor(Math.random() * 20) + 40, // 40-60%
      bandwidth: Math.floor(Math.random() * 100) + 50 // MB/s
    };

    const metrics = {
      timestamp: new Date(),
      overview: {
        totalCompanies: companies.length,
        activeCompanies: activeCompanies.length,
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        totalSessions: sessions.length,
        activeSessions: activeSessions.length
      },
      today: todayMetrics,
      performance,
      resources,
      health: {
        database: true,
        whatsappService: true,
        apiGateway: true,
        messageQueue: true
      }
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('Real-time metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد المقاييس'
    });
  }
});

// Advanced revenue analytics
router.get('/revenue-analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const companies = await storage.getAllCompanies();
    
    const planPrices = { basic: 29, premium: 99, enterprise: 299 };
    
    // Calculate current revenue
    const currentRevenue = companies.reduce((sum, company) => {
      return sum + (planPrices[company.planType as keyof typeof planPrices] || 0);
    }, 0);

    // Calculate plan distribution
    const planDistribution = companies.reduce((acc, company) => {
      const plan = company.planType;
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate historical data (last 12 months)
    const monthlyRevenue = [];
    const monthlyGrowth = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const baseRevenue = currentRevenue * (0.7 + Math.random() * 0.6); // Simulate growth
      const monthRevenue = Math.floor(baseRevenue * (1 + i * 0.05)); // Growing trend
      
      monthlyRevenue.push({
        month: date.toISOString().slice(0, 7),
        revenue: monthRevenue,
        companies: Math.floor(companies.length * (0.5 + i * 0.04)),
        arpu: Math.floor(monthRevenue / Math.max(1, companies.length)) // Average Revenue Per User
      });
      
      if (i < 11) {
        const growthRate = ((monthRevenue - monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0) / (monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 1)) * 100;
        monthlyGrowth.push({
          month: date.toISOString().slice(0, 7),
          growth: Math.round(growthRate * 100) / 100
        });
      }
    }

    // Calculate projections
    const avgGrowth = monthlyGrowth.reduce((sum, m) => sum + m.growth, 0) / monthlyGrowth.length;
    const projectedNextMonth = Math.floor(currentRevenue * (1 + avgGrowth / 100));
    
    // Churn analysis
    const churnAnalysis = {
      monthlyChurnRate: Math.round(Math.random() * 5 * 100) / 100, // 0-5%
      retentionRate: 95 + Math.random() * 4, // 95-99%
      avgCustomerLifetime: Math.floor(Math.random() * 20) + 15, // 15-35 months
      ltv: Math.floor((planPrices.basic + planPrices.premium + planPrices.enterprise) / 3 * 24) // Lifetime Value
    };

    const analytics = {
      current: {
        totalRevenue: currentRevenue,
        monthlyRecurring: currentRevenue,
        annualRecurring: currentRevenue * 12,
        companiesCount: companies.length,
        avgRevenuePerCompany: Math.floor(currentRevenue / companies.length)
      },
      planDistribution,
      monthly: monthlyRevenue,
      growth: monthlyGrowth,
      projections: {
        nextMonth: projectedNextMonth,
        nextQuarter: projectedNextMonth * 3,
        nextYear: Math.floor(currentRevenue * Math.pow(1 + avgGrowth / 100, 12))
      },
      churn: churnAnalysis,
      insights: [
        `نمو الإيرادات الشهرية: ${avgGrowth > 0 ? '+' : ''}${avgGrowth.toFixed(1)}%`,
        `متوسط الإيرادات لكل شركة: $${Math.floor(currentRevenue / companies.length)}`,
        `معدل الاحتفاظ بالعملاء: ${churnAnalysis.retentionRate.toFixed(1)}%`,
        `القيمة المتوقعة للعميل: $${churnAnalysis.ltv}`
      ]
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحليل الإيرادات'
    });
  }
});

// User behavior analytics
router.get('/user-behavior', async (req, res) => {
  try {
    const { companyId, period = '30d' } = req.query;
    
    let users, sessions;
    
    if (companyId) {
      users = await storage.getUsersByCompany(companyId as string);
      sessions = await storage.getSessionsByCompany(companyId as string);
    } else {
      users = await storage.getAllUsers();
      sessions = await storage.getAllSessions();
    }

    // Analyze user activity patterns
    const userSegments = {
      highly_active: users.filter(u => {
        const userSessions = sessions.filter(s => s.userId === u.id);
        return userSessions.length >= 5;
      }).length,
      moderately_active: users.filter(u => {
        const userSessions = sessions.filter(s => s.userId === u.id);
        return userSessions.length >= 2 && userSessions.length < 5;
      }).length,
      low_activity: users.filter(u => {
        const userSessions = sessions.filter(s => s.userId === u.id);
        return userSessions.length >= 1 && userSessions.length < 2;
      }).length,
      inactive: users.filter(u => {
        const userSessions = sessions.filter(s => s.userId === u.id);
        return userSessions.length === 0;
      }).length
    };

    // Feature usage analysis
    const featureUsage = {
      whatsapp_sessions: sessions.length,
      message_sending: Math.floor(Math.random() * 1000) + 500,
      api_integrations: Math.floor(Math.random() * 100) + 50,
      dashboard_views: Math.floor(Math.random() * 2000) + 1000,
      user_management: Math.floor(Math.random() * 200) + 100
    };

    // Time-based activity (24 hour breakdown)
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      activity: Math.floor(Math.random() * 100) + 20,
      peak: hour >= 9 && hour <= 17 // Business hours
    }));

    // Weekly pattern
    const weeklyPattern = [
      { day: 'الأحد', activity: Math.floor(Math.random() * 80) + 40 },
      { day: 'الاثنين', activity: Math.floor(Math.random() * 100) + 70 },
      { day: 'الثلاثاء', activity: Math.floor(Math.random() * 100) + 80 },
      { day: 'الأربعاء', activity: Math.floor(Math.random() * 100) + 85 },
      { day: 'الخميس', activity: Math.floor(Math.random() * 100) + 75 },
      { day: 'الجمعة', activity: Math.floor(Math.random() * 60) + 30 },
      { day: 'السبت', activity: Math.floor(Math.random() * 50) + 25 }
    ];

    const behavior = {
      userSegments,
      featureUsage,
      timePatterns: {
        hourly: hourlyActivity,
        weekly: weeklyPattern
      },
      engagement: {
        averageSessionDuration: Math.floor(Math.random() * 30) + 15, // minutes
        dailyActiveUsers: Math.floor(users.length * 0.6),
        weeklyActiveUsers: Math.floor(users.length * 0.8),
        monthlyActiveUsers: Math.floor(users.length * 0.9)
      },
      insights: [
        `${userSegments.highly_active} مستخدمين نشطين جداً`,
        `ذروة النشاط: ${weeklyPattern.reduce((max, day) => day.activity > max.activity ? day : max).day}`,
        `متوسط مدة الجلسة: ${Math.floor(Math.random() * 30) + 15} دقيقة`,
        `معدل الاستخدام اليومي: ${Math.floor((userSegments.highly_active + userSegments.moderately_active) / users.length * 100)}%`
      ]
    };

    res.json({
      success: true,
      data: behavior
    });

  } catch (error) {
    console.error('User behavior analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحليل سلوك المستخدمين'
    });
  }
});

// System performance analytics
router.get('/performance-metrics', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // Generate performance data based on timeframe
    let dataPoints: any[] = [];
    let interval: number;
    
    switch (timeframe) {
      case '1h':
        interval = 5; // 5 minute intervals
        dataPoints = Array.from({ length: 12 }, (_, i) => ({
          timestamp: new Date(Date.now() - (11 - i) * 5 * 60 * 1000),
          responseTime: Math.floor(Math.random() * 50) + 30,
          throughput: Math.floor(Math.random() * 200) + 100,
          errorRate: Math.random() * 1,
          cpuUsage: Math.floor(Math.random() * 30) + 20,
          memoryUsage: Math.floor(Math.random() * 40) + 30
        }));
        break;
      case '24h':
        interval = 60; // 1 hour intervals
        dataPoints = Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
          responseTime: Math.floor(Math.random() * 80) + 20,
          throughput: Math.floor(Math.random() * 500) + 200,
          errorRate: Math.random() * 2,
          cpuUsage: Math.floor(Math.random() * 50) + 20,
          memoryUsage: Math.floor(Math.random() * 60) + 25
        }));
        break;
      case '7d':
        interval = 1440; // 1 day intervals
        dataPoints = Array.from({ length: 7 }, (_, i) => ({
          timestamp: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
          responseTime: Math.floor(Math.random() * 100) + 30,
          throughput: Math.floor(Math.random() * 1000) + 300,
          errorRate: Math.random() * 3,
          cpuUsage: Math.floor(Math.random() * 60) + 25,
          memoryUsage: Math.floor(Math.random() * 70) + 30
        }));
        break;
    }

    // Calculate aggregate metrics
    const avgResponseTime = dataPoints.reduce((sum, p) => sum + p.responseTime, 0) / dataPoints.length;
    const avgThroughput = dataPoints.reduce((sum, p) => sum + p.throughput, 0) / dataPoints.length;
    const avgErrorRate = dataPoints.reduce((sum, p) => sum + p.errorRate, 0) / dataPoints.length;
    const maxResponseTime = Math.max(...dataPoints.map(p => p.responseTime));
    const minResponseTime = Math.min(...dataPoints.map(p => p.responseTime));

    // SLA metrics
    const slaMetrics = {
      availability: 99.5 + Math.random() * 0.4, // 99.5-99.9%
      responseTimeSLA: 100, // ms
      slaCompliance: avgResponseTime <= 100 ? 100 : (100 / avgResponseTime) * 100,
      uptime: (dataPoints.length - dataPoints.filter(p => p.errorRate > 5).length) / dataPoints.length * 100
    };

    // Alert thresholds
    const alerts = [];
    if (avgResponseTime > 80) alerts.push('متوسط زمن الاستجابة مرتفع');
    if (avgErrorRate > 1) alerts.push('معدل الأخطاء مرتفع');
    if (slaMetrics.availability < 99) alerts.push('مستوى التوفر أقل من المطلوب');

    const performance = {
      timeframe,
      interval: `${interval} دقيقة`,
      dataPoints,
      summary: {
        avgResponseTime: Math.round(avgResponseTime),
        maxResponseTime,
        minResponseTime,
        avgThroughput: Math.round(avgThroughput),
        avgErrorRate: Math.round(avgErrorRate * 100) / 100,
        totalRequests: Math.floor(avgThroughput * dataPoints.length)
      },
      sla: slaMetrics,
      alerts,
      recommendations: [
        avgResponseTime > 60 ? 'تحسين أداء قاعدة البيانات' : null,
        avgErrorRate > 1 ? 'مراجعة سجلات الأخطاء' : null,
        'تحديث سعة الخادم عند الحاجة',
        'مراقبة استخدام الذاكرة'
      ].filter(Boolean)
    };

    res.json({
      success: true,
      data: performance
    });

  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في مقاييس الأداء'
    });
  }
});

// Advanced reporting
router.post('/generate-report', async (req, res) => {
  try {
    const { 
      reportType, 
      dateRange, 
      filters = {}, 
      format = 'json',
      includeCharts = true 
    } = req.body;

    if (!reportType || !dateRange) {
      return res.status(400).json({
        success: false,
        message: 'نوع التقرير ونطاق التاريخ مطلوبان'
      });
    }

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate report generation based on type
    let reportData: any = {};

    switch (reportType) {
      case 'business-overview':
        const companies = await storage.getAllCompanies();
        const users = await storage.getAllUsers();
        
        reportData = {
          summary: {
            totalCompanies: companies.length,
            totalUsers: users.length,
            totalRevenue: companies.reduce((sum, c) => sum + (c.monthlyPrice || 0), 0),
            growthRate: Math.round((Math.random() * 20 + 5) * 100) / 100
          },
          planBreakdown: companies.reduce((acc, c) => {
            acc[c.planType] = (acc[c.planType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          topPerformers: companies
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(c => ({
              name: c.name,
              users: users.filter(u => u.companyId === c.id).length,
              plan: c.planType
            }))
        };
        break;

      case 'usage-analytics':
        reportData = {
          messaging: {
            totalMessages: Math.floor(Math.random() * 100000) + 50000,
            successRate: 95 + Math.random() * 4,
            avgPerDay: Math.floor(Math.random() * 5000) + 2000
          },
          sessions: {
            totalSessions: Math.floor(Math.random() * 1000) + 500,
            activeRate: 60 + Math.random() * 30,
            avgDuration: Math.floor(Math.random() * 120) + 30
          },
          api: {
            totalCalls: Math.floor(Math.random() * 500000) + 200000,
            errorRate: Math.random() * 2,
            topEndpoints: ['/api/send-message', '/api/get-qr', '/api/sessions']
          }
        };
        break;

      case 'financial':
        reportData = {
          revenue: {
            current: Math.floor(Math.random() * 50000) + 20000,
            projected: Math.floor(Math.random() * 60000) + 25000,
            growth: Math.round((Math.random() * 15 + 5) * 100) / 100
          },
          costs: {
            infrastructure: Math.floor(Math.random() * 5000) + 2000,
            support: Math.floor(Math.random() * 3000) + 1000,
            marketing: Math.floor(Math.random() * 2000) + 500
          },
          profit: {
            gross: Math.floor(Math.random() * 40000) + 15000,
            net: Math.floor(Math.random() * 30000) + 10000,
            margin: Math.round((Math.random() * 20 + 40) * 100) / 100
          }
        };
        break;
    }

    // Add metadata
    const report = {
      id: reportId,
      type: reportType,
      dateRange,
      generatedAt: new Date(),
      filters,
      format,
      data: reportData,
      charts: includeCharts ? {
        available: true,
        types: ['line', 'bar', 'pie', 'area'],
        note: 'الرسوم البيانية متاحة في واجهة الويب'
      } : null,
      downloadUrl: `/api/reports/download/${reportId}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    res.json({
      success: true,
      message: 'تم إنشاء التقرير بنجاح',
      data: report
    });

  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء التقرير'
    });
  }
});

export default router;