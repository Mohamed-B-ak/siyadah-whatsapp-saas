import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// نقطة نهاية تسجيل شركة جديدة
router.post('/companies/register', async (req, res) => {
  try {
    const { company, admin } = req.body;
    
    if (!company?.name || !company?.email || !admin?.firstName || !admin?.email) {
      return res.status(400).json({
        success: false,
        message: 'البيانات المطلوبة ناقصة'
      });
    }

    // إنشاء الشركة
    const newCompany = await storage.createCompany({
      name: company.name,
      email: company.email,
      industry: company.industry || '',
      size: company.size || '',
      planType: company.planType || 'basic',
      settings: JSON.stringify({
        maxUsers: company.planType === 'basic' ? 5 : company.planType === 'premium' ? 20 : 999,
        maxSessions: company.planType === 'basic' ? 10 : company.planType === 'premium' ? 50 : 999,
        maxMessages: company.planType === 'basic' ? 1000 : company.planType === 'premium' ? 10000 : 999999
      })
    });

    // إنشاء المستخدم الإداري
    const adminUser = await storage.createUser({
      companyId: newCompany.id,
      firstName: admin.firstName,
      lastName: admin.lastName || '',
      email: admin.email,
      phone: admin.phone || '',
      role: 'admin'
    });

    res.json({
      success: true,
      data: {
        company: newCompany,
        admin: adminUser,
        masterApiKey: newCompany.masterApiKey,
        userApiKey: adminUser.apiKey
      },
      message: 'تم إنشاء الحساب بنجاح'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الحساب'
    });
  }
});

// نقطة نهاية تسجيل الدخول
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // للعرض التوضيحي - نقبل بيانات ثابتة
    if (email === 'admin@company.com' && password === 'admin123') {
      const demoData = {
        company: {
          id: 'demo_company',
          name: 'شركة التقنية المتقدمة',
          email: 'admin@company.com',
          planType: 'premium'
        },
        user: {
          id: 'demo_user',
          firstName: 'أحمد',
          lastName: 'محمد',
          email: 'admin@company.com',
          role: 'admin'
        },
        apiKey: 'demo_api_key_123456789'
      };

      return res.json({
        success: true,
        data: {
          companyInfo: demoData.company,
          userInfo: demoData.user,
          apiKey: demoData.apiKey
        },
        message: 'تم تسجيل الدخول بنجاح'
      });
    }

    // محاولة البحث عن المستخدم في قاعدة البيانات
    // هذا مكان لإضافة منطق المصادقة الحقيقي لاحقاً

    res.status(401).json({
      success: false,
      message: 'بيانات الدخول غير صحيحة'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تسجيل الدخول'
    });
  }
});

export default router;