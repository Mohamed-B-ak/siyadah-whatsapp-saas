import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Email notification templates
const emailTemplates = {
  welcome: {
    subject: 'مرحباً بك في منصة WhatsApp API',
    body: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">مرحباً بك!</h1>
        <p>شكراً لانضمامك إلى منصة WhatsApp API. حسابك جاهز للاستخدام.</p>
        <p><strong>معلومات حسابك:</strong></p>
        <ul>
          <li>البريد الإلكتروني: {{email}}</li>
          <li>نوع الحساب: {{accountType}}</li>
          <li>الخطة: {{planType}}</li>
        </ul>
        <a href="{{dashboardUrl}}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          الذهاب إلى لوحة التحكم
        </a>
      </div>
    `
  },
  planUpgrade: {
    subject: 'تم ترقية خطة اشتراكك بنجاح',
    body: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">تم ترقية خطتك!</h1>
        <p>تم ترقية خطة اشتراكك بنجاح إلى {{newPlan}}.</p>
        <p><strong>الميزات الجديدة:</strong></p>
        <ul>
          <li>عدد المستخدمين: {{maxUsers}}</li>
          <li>عدد الجلسات: {{maxSessions}}</li>
          <li>عدد الرسائل: {{maxMessages}}</li>
        </ul>
      </div>
    `
  },
  securityAlert: {
    subject: 'تنبيه أمني - نشاط مشبوه',
    body: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">تنبيه أمني</h1>
        <p>تم اكتشاف نشاط مشبوه في حسابك:</p>
        <p><strong>التفاصيل:</strong></p>
        <ul>
          <li>النشاط: {{activity}}</li>
          <li>التوقيت: {{timestamp}}</li>
          <li>عنوان IP: {{ipAddress}}</li>
        </ul>
        <p>إذا لم تكن أنت، يرجى تغيير كلمة المرور فوراً.</p>
      </div>
    `
  }
};

// Send notification
router.post('/send', async (req, res) => {
  try {
    const { 
      recipientId, 
      type = 'email', 
      template, 
      data = {}, 
      priority = 'normal',
      scheduled = null 
    } = req.body;

    if (!recipientId || !template) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستقبل ونوع القالب مطلوبان'
      });
    }

    // Get recipient info
    let recipient;
    if (recipientId.startsWith('comp_')) {
      recipient = await storage.getCompanyByApiKey(recipientId);
    } else if (recipientId.startsWith('user_')) {
      recipient = await storage.getUserByApiKey(recipientId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'معرف المستقبل غير صالح'
      });
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'المستقبل غير موجود'
      });
    }

    // Validate template
    if (!emailTemplates[template as keyof typeof emailTemplates]) {
      return res.status(400).json({
        success: false,
        message: 'قالب الإشعار غير موجود',
        availableTemplates: Object.keys(emailTemplates)
      });
    }

    const templateData = emailTemplates[template as keyof typeof emailTemplates];
    
    // Replace template variables
    let subject = templateData.subject;
    let body = templateData.body;
    
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    });

    // Create notification record
    const notification = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      type,
      template,
      subject,
      body,
      data,
      priority,
      status: scheduled ? 'scheduled' : 'sent',
      scheduledAt: scheduled ? new Date(scheduled) : null,
      sentAt: scheduled ? null : new Date(),
      createdAt: new Date(),
      attempts: scheduled ? 0 : 1,
      lastAttempt: scheduled ? null : new Date(),
      errorMessage: null
    };

    // Simulate sending (in real implementation, integrate with email service)
    if (!scheduled) {
      console.log(`📧 [NOTIFICATION] Sent ${type} to ${recipient.email}: ${subject}`);
    } else {
      console.log(`⏰ [NOTIFICATION] Scheduled ${type} for ${scheduled}: ${subject}`);
    }

    res.status(201).json({
      success: true,
      message: scheduled ? 'تم جدولة الإشعار بنجاح' : 'تم إرسال الإشعار بنجاح',
      data: {
        notificationId: notification.id,
        status: notification.status,
        scheduledAt: notification.scheduledAt,
        sentAt: notification.sentAt
      }
    });

  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال الإشعار'
    });
  }
});

// Get notification templates
router.get('/templates', (req, res) => {
  const templates = Object.keys(emailTemplates).map(key => ({
    name: key,
    subject: emailTemplates[key as keyof typeof emailTemplates].subject,
    variables: extractVariables(emailTemplates[key as keyof typeof emailTemplates].body)
  }));

  res.json({
    success: true,
    data: templates
  });
});

// Get notification history
router.get('/history/:recipientId', async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { limit = 50, status = 'all' } = req.query;

    // Simulate notification history
    const notifications = [
      {
        id: 'notif_001',
        type: 'email',
        template: 'welcome',
        subject: 'مرحباً بك في منصة WhatsApp API',
        status: 'sent',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        attempts: 1
      },
      {
        id: 'notif_002',
        type: 'email', 
        template: 'planUpgrade',
        subject: 'تم ترقية خطة اشتراكك بنجاح',
        status: 'sent',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        attempts: 1
      }
    ];

    const filteredNotifications = status === 'all' 
      ? notifications 
      : notifications.filter(n => n.status === status);

    res.json({
      success: true,
      data: {
        notifications: filteredNotifications.slice(0, Number(limit)),
        total: filteredNotifications.length,
        filters: {
          applied: { status, limit },
          available: {
            statuses: ['sent', 'failed', 'scheduled', 'pending'],
            templates: Object.keys(emailTemplates)
          }
        }
      }
    });

  } catch (error) {
    console.error('Notification history error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في استرداد تاريخ الإشعارات'
    });
  }
});

// Bulk notifications
router.post('/bulk', async (req, res) => {
  try {
    const { recipients, template, data = {}, type = 'email' } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'قائمة المستقبلين مطلوبة ويجب أن تحتوي على عنصر واحد على الأقل'
      });
    }

    if (recipients.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إرسال أكثر من 1000 إشعار في الطلب الواحد'
      });
    }

    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each recipient
    for (const recipientId of recipients) {
      try {
        // Simulate sending notification
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate delay
        results.successful++;
        console.log(`📧 [BULK] Sent to ${recipientId}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          recipientId,
          error: 'فشل في الإرسال'
        });
      }
    }

    const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    res.json({
      success: true,
      message: `تم معالجة ${results.total} إشعار`,
      data: {
        batchId,
        results,
        template,
        processedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Bulk notification error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإرسال المجمع'
    });
  }
});

// Helper function to extract template variables
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  return matches ? matches.map(match => match.replace(/[{}]/g, '')) : [];
}

export default router;