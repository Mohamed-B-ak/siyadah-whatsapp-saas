import { Router } from 'express';
import { storage } from './storage';
import crypto from 'crypto';

const router = Router();

// Webhook management system
router.get('/webhooks', async (req, res) => {
  try {
    const { companyId } = req.query;
    
    // Simulate webhook configurations
    const webhooks = [
      {
        id: 'webhook_001',
        name: 'إشعارات الرسائل الواردة',
        url: 'https://api.company.com/whatsapp/incoming',
        events: ['message.received', 'message.read'],
        isActive: true,
        secret: 'whook_secret_' + crypto.randomBytes(16).toString('hex'),
        lastTriggered: new Date(Date.now() - 1000 * 60 * 30),
        successRate: 98.5,
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential'
        }
      },
      {
        id: 'webhook_002', 
        name: 'تحديثات حالة الجلسة',
        url: 'https://api.company.com/whatsapp/status',
        events: ['session.connected', 'session.disconnected'],
        isActive: true,
        secret: 'whook_secret_' + crypto.randomBytes(16).toString('hex'),
        lastTriggered: new Date(Date.now() - 1000 * 60 * 60 * 2),
        successRate: 99.2,
        retryPolicy: {
          maxRetries: 5,
          backoffStrategy: 'linear'
        }
      }
    ];

    res.json({
      success: true,
      data: {
        webhooks,
        statistics: {
          totalWebhooks: webhooks.length,
          activeWebhooks: webhooks.filter(w => w.isActive).length,
          avgSuccessRate: webhooks.reduce((sum, w) => sum + w.successRate, 0) / webhooks.length,
          totalEvents: ['message.received', 'message.read', 'message.sent', 'session.connected', 'session.disconnected', 'qr.generated']
        }
      }
    });

  } catch (error) {
    console.error('Webhooks error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد الـ webhooks'
    });
  }
});

// Create new webhook
router.post('/webhooks', async (req, res) => {
  try {
    const { name, url, events, retryPolicy = { maxRetries: 3, backoffStrategy: 'exponential' } } = req.body;
    
    if (!name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والرابط والأحداث مطلوبة'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'رابط الـ webhook غير صالح'
      });
    }

    // Validate events
    const validEvents = [
      'message.received', 'message.sent', 'message.read', 'message.failed',
      'session.connected', 'session.disconnected', 'session.timeout',
      'qr.generated', 'qr.scanned', 'user.created', 'user.updated'
    ];

    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'أحداث غير صالحة',
        invalidEvents,
        validEvents
      });
    }

    const webhook = {
      id: 'webhook_' + crypto.randomBytes(8).toString('hex'),
      name: name.trim(),
      url: url.trim(),
      events,
      isActive: true,
      secret: 'whook_secret_' + crypto.randomBytes(16).toString('hex'),
      createdAt: new Date(),
      lastTriggered: null,
      successRate: 100,
      retryPolicy,
      statistics: {
        totalTriggers: 0,
        successfulTriggers: 0,
        failedTriggers: 0,
        lastError: null
      }
    };

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الـ webhook بنجاح',
      data: webhook
    });

  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الـ webhook'
    });
  }
});

// API rate limiting and quotas
router.get('/rate-limits/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة'
      });
    }

    // Define rate limits based on plan
    const planLimits = {
      basic: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        messagesPerDay: 1000,
        sessionsLimit: 5,
        webhooksLimit: 2
      },
      premium: {
        requestsPerMinute: 200,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        messagesPerDay: 10000,
        sessionsLimit: 25,
        webhooksLimit: 10
      },
      enterprise: {
        requestsPerMinute: 500,
        requestsPerHour: 20000,
        requestsPerDay: 200000,
        messagesPerDay: -1, // unlimited
        sessionsLimit: 50,
        webhooksLimit: 50
      }
    };

    const limits = planLimits[company.planType as keyof typeof planLimits];
    
    // Simulate current usage
    const currentUsage = {
      requestsThisMinute: Math.floor(Math.random() * limits.requestsPerMinute * 0.7),
      requestsThisHour: Math.floor(Math.random() * limits.requestsPerHour * 0.5),
      requestsToday: Math.floor(Math.random() * limits.requestsPerDay * 0.3),
      messagesToday: Math.floor(Math.random() * (limits.messagesPerDay === -1 ? 5000 : limits.messagesPerDay) * 0.4),
      activeSessions: Math.floor(Math.random() * limits.sessionsLimit * 0.6),
      activeWebhooks: Math.floor(Math.random() * limits.webhooksLimit * 0.8)
    };

    const rateLimits = {
      planType: company.planType,
      limits,
      currentUsage,
      remaining: {
        requestsPerMinute: limits.requestsPerMinute - currentUsage.requestsThisMinute,
        requestsPerHour: limits.requestsPerHour - currentUsage.requestsThisHour,
        requestsPerDay: limits.requestsPerDay - currentUsage.requestsToday,
        messagesPerDay: limits.messagesPerDay === -1 ? -1 : limits.messagesPerDay - currentUsage.messagesToday,
        sessions: limits.sessionsLimit - currentUsage.activeSessions,
        webhooks: limits.webhooksLimit - currentUsage.activeWebhooks
      },
      resetTimes: {
        minute: new Date(Math.ceil(Date.now() / 60000) * 60000),
        hour: new Date(Math.ceil(Date.now() / 3600000) * 3600000),
        day: new Date(new Date().setHours(24, 0, 0, 0))
      },
      warnings: []
    };

    // Add warnings for high usage
    if (currentUsage.requestsThisMinute > limits.requestsPerMinute * 0.8) {
      rateLimits.warnings.push('اقتراب من حد الطلبات في الدقيقة');
    }
    if (currentUsage.requestsToday > limits.requestsPerDay * 0.9) {
      rateLimits.warnings.push('اقتراب من حد الطلبات اليومية');
    }

    res.json({
      success: true,
      data: rateLimits
    });

  } catch (error) {
    console.error('Rate limits error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد حدود المعدل'
    });
  }
});

// Advanced security monitoring
router.get('/security-logs/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 100, severity = 'all' } = req.query;

    // Simulate security events
    const securityEvents = [
      {
        id: 'sec_001',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        type: 'authentication',
        severity: 'medium',
        event: 'Multiple failed login attempts',
        details: {
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          attempts: 3,
          email: 'user@company.com'
        },
        action: 'Account temporarily locked',
        resolved: true
      },
      {
        id: 'sec_002',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        type: 'api_abuse',
        severity: 'high',
        event: 'Rate limit exceeded significantly',
        details: {
          apiKey: 'user_***',
          requestCount: 1500,
          limit: 1000,
          endpoint: '/api/send-message'
        },
        action: 'API key temporarily suspended',
        resolved: false
      },
      {
        id: 'sec_003',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
        type: 'suspicious_activity',
        severity: 'low',
        event: 'Unusual login location',
        details: {
          ip: '203.0.113.45',
          location: 'Unknown Location',
          previousLocation: 'Riyadh, SA'
        },
        action: 'Email notification sent',
        resolved: true
      }
    ];

    const filteredEvents = severity === 'all' 
      ? securityEvents 
      : securityEvents.filter(e => e.severity === severity);

    const securitySummary = {
      totalEvents: securityEvents.length,
      activeThreats: securityEvents.filter(e => !e.resolved).length,
      severityBreakdown: {
        high: securityEvents.filter(e => e.severity === 'high').length,
        medium: securityEvents.filter(e => e.severity === 'medium').length,
        low: securityEvents.filter(e => e.severity === 'low').length
      },
      lastIncident: securityEvents[0]?.timestamp,
      recommendations: [
        'تفعيل المصادقة الثنائية',
        'مراجعة صلاحيات المستخدمين',
        'تحديث كلمات المرور بانتظام',
        'مراقبة النشاط غير الطبيعي'
      ]
    };

    res.json({
      success: true,
      data: {
        summary: securitySummary,
        events: filteredEvents.slice(0, Number(limit)),
        filters: {
          applied: { severity, limit },
          available: {
            severities: ['low', 'medium', 'high'],
            types: ['authentication', 'api_abuse', 'suspicious_activity', 'data_access']
          }
        }
      }
    });

  } catch (error) {
    console.error('Security logs error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد سجلات الأمان'
    });
  }
});

// White-label customization
router.get('/branding/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة'
      });
    }

    // Default branding settings
    const branding = {
      companyId: company.id,
      logo: {
        primary: '/assets/logos/default-logo.png',
        favicon: '/assets/logos/default-favicon.ico',
        darkMode: '/assets/logos/default-logo-dark.png'
      },
      colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#28a745',
        background: '#ffffff',
        text: '#333333'
      },
      typography: {
        fontFamily: 'Cairo, sans-serif',
        headingFont: 'Cairo, sans-serif',
        fontSize: {
          base: '16px',
          heading: '24px',
          small: '14px'
        }
      },
      customDomain: {
        enabled: company.planType === 'enterprise',
        domain: company.planType === 'enterprise' ? `${company.name.toLowerCase().replace(/\s+/g, '')}.whatsapp-api.com` : null,
        sslEnabled: true
      },
      features: {
        removeBranding: company.planType !== 'basic',
        customFooter: company.planType === 'enterprise',
        customEmailTemplates: company.planType !== 'basic',
        apiDocsBranding: company.planType === 'enterprise'
      },
      dashboard: {
        title: `${company.name} - WhatsApp API`,
        welcomeMessage: `مرحباً بك في منصة ${company.name}`,
        supportEmail: 'support@company.com',
        helpUrl: 'https://help.company.com'
      }
    };

    res.json({
      success: true,
      data: branding
    });

  } catch (error) {
    console.error('Branding error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد إعدادات العلامة التجارية'
    });
  }
});

// Update branding settings
router.put('/branding/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { logo, colors, typography, dashboard } = req.body;
    
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة'
      });
    }

    // Validate plan permissions
    if (company.planType === 'basic' && (logo || colors)) {
      return res.status(403).json({
        success: false,
        message: 'تخصيص العلامة التجارية يتطلب خطة Premium أو Enterprise'
      });
    }

    // Validate color formats
    if (colors) {
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      for (const [key, value] of Object.entries(colors)) {
        if (typeof value === 'string' && !colorRegex.test(value)) {
          return res.status(400).json({
            success: false,
            message: `لون غير صالح: ${key}`,
            expectedFormat: '#FFFFFF أو #FFF'
          });
        }
      }
    }

    // Simulate update
    const updatedBranding = {
      companyId: company.id,
      logo: logo || {},
      colors: colors || {},
      typography: typography || {},
      dashboard: dashboard || {},
      updatedAt: new Date(),
      previewUrl: `https://preview.whatsapp-api.com/${company.id}`
    };

    res.json({
      success: true,
      message: 'تم تحديث إعدادات العلامة التجارية بنجاح',
      data: updatedBranding
    });

  } catch (error) {
    console.error('Update branding error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث إعدادات العلامة التجارية'
    });
  }
});

// API usage analytics for enterprise
router.get('/api-analytics/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { period = '7d' } = req.query;
    
    const company = await storage.getCompanyByApiKey(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'الشركة غير موجودة'
      });
    }

    // Generate analytics data
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const apiUsage = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      
      return {
        date: date.toISOString().split('T')[0],
        totalRequests: Math.floor(Math.random() * 1000) + 200,
        successfulRequests: Math.floor(Math.random() * 950) + 180,
        failedRequests: Math.floor(Math.random() * 50) + 5,
        avgResponseTime: Math.floor(Math.random() * 100) + 50,
        topEndpoints: [
          { endpoint: '/api/send-message', count: Math.floor(Math.random() * 500) + 100 },
          { endpoint: '/api/get-qr', count: Math.floor(Math.random() * 200) + 50 },
          { endpoint: '/api/sessions', count: Math.floor(Math.random() * 150) + 30 }
        ]
      };
    });

    const totalRequests = apiUsage.reduce((sum, day) => sum + day.totalRequests, 0);
    const totalSuccess = apiUsage.reduce((sum, day) => sum + day.successfulRequests, 0);
    const avgResponseTime = apiUsage.reduce((sum, day) => sum + day.avgResponseTime, 0) / apiUsage.length;

    const analytics = {
      period,
      summary: {
        totalRequests,
        successRate: Math.round((totalSuccess / totalRequests) * 100),
        avgResponseTime: Math.round(avgResponseTime),
        peakDay: apiUsage.reduce((max, day) => day.totalRequests > max.totalRequests ? day : max)
      },
      dailyUsage: apiUsage,
      endpointAnalytics: {
        mostUsed: '/api/send-message',
        leastUsed: '/api/analytics',
        errorProne: '/api/send-bulk-message',
        fastest: '/api/health'
      },
      recommendations: [
        totalRequests > 10000 ? 'فكر في ترقية الخطة للحصول على حدود أعلى' : null,
        avgResponseTime > 100 ? 'تحسين أداء الطلبات مطلوب' : null,
        'استخدم التخزين المؤقت للطلبات المتكررة',
        'راقب معدلات الخطأ بانتظام'
      ].filter(Boolean)
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('API analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحليلات API'
    });
  }
});

export default router;