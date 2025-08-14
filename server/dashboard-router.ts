import { Router } from 'express';
import path from 'path';

const router = Router();

// Smart dashboard routing middleware
router.use('/dashboard', (req, res, next) => {
  // Check if this is an API request
  if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
    next();
    return;
  }

  // For HTML requests, check user role and redirect to appropriate dashboard
  const userRole = req.query.role || req.headers['x-user-role'];
  
  if (userRole === 'platform_owner') {
    res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
  } else if (userRole === 'company_admin' || userRole === 'admin') {
    res.sendFile(path.join(__dirname, '../public/company-dashboard.html'));
  } else if (userRole === 'subclient' || userRole === 'user') {
    res.sendFile(path.join(__dirname, '../public/subclient-dashboard.html'));
  } else {
    // Default to company dashboard
    res.sendFile(path.join(__dirname, '../public/company-dashboard.html'));
  }
});

// API endpoints for dashboard data
router.get('/api/dashboard/user-type', (req, res) => {
  // Mock user type detection - in real app this would check session/token
  const userTypes = [
    {
      role: 'platform_owner',
      name: 'مالك المنصة',
      dashboard: '/admin-dashboard.html',
      permissions: ['manage_all_companies', 'manage_all_users', 'system_settings']
    },
    {
      role: 'company_admin',
      name: 'مدير الشركة',
      dashboard: '/company-dashboard.html',
      permissions: ['manage_subclients', 'manage_api_keys', 'view_company_stats']
    },
    {
      role: 'subclient',
      name: 'عميل فرعي',
      dashboard: '/subclient-dashboard.html',
      permissions: ['use_api', 'view_usage', 'request_permissions']
    }
  ];

  // Default to company admin for demo
  res.json({
    success: true,
    data: userTypes[1] // company_admin
  });
});

router.get('/api/dashboard/navigation/:role', (req, res) => {
  const { role } = req.params;
  
  const navigationMenus = {
    platform_owner: [
      { id: 'dashboard', name: 'لوحة القيادة', icon: 'fas fa-chart-pie' },
      { id: 'companies', name: 'إدارة الشركات', icon: 'fas fa-building' },
      { id: 'users', name: 'إدارة المستخدمين', icon: 'fas fa-users' },
      { id: 'api-keys', name: 'مفاتيح API', icon: 'fas fa-key' },
      { id: 'sessions', name: 'جلسات WhatsApp', icon: 'fas fa-mobile-alt' },
      { id: 'analytics', name: 'التحليلات', icon: 'fas fa-chart-line' },
      { id: 'security', name: 'الأمان', icon: 'fas fa-shield-alt' },
      { id: 'settings', name: 'الإعدادات', icon: 'fas fa-cog' }
    ],
    company_admin: [
      { id: 'dashboard', name: 'لوحة القيادة', icon: 'fas fa-chart-pie' },
      { id: 'subclients', name: 'العملاء الفرعيين', icon: 'fas fa-users' },
      { id: 'api-keys', name: 'مفاتيح API', icon: 'fas fa-key' },
      { id: 'sessions', name: 'جلسات WhatsApp', icon: 'fas fa-mobile-alt' },
      { id: 'usage', name: 'تقارير الاستخدام', icon: 'fas fa-chart-bar' },
      { id: 'billing', name: 'الفواتير', icon: 'fas fa-credit-card' },
      { id: 'settings', name: 'إعدادات الشركة', icon: 'fas fa-cog' }
    ],
    subclient: [
      { id: 'dashboard', name: 'لوحة القيادة', icon: 'fas fa-chart-pie' },
      { id: 'api-key', name: 'مفتاح API', icon: 'fas fa-key' },
      { id: 'usage', name: 'تقرير الاستخدام', icon: 'fas fa-chart-bar' },
      { id: 'permissions', name: 'الصلاحيات', icon: 'fas fa-shield-alt' },
      { id: 'activity', name: 'سجل النشاطات', icon: 'fas fa-history' },
      { id: 'support', name: 'الدعم الفني', icon: 'fas fa-life-ring' }
    ]
  };

  res.json({
    success: true,
    data: navigationMenus[role] || navigationMenus.company_admin
  });
});

// Security middleware for API key management
router.use('/api/keys', (req, res, next) => {
  // In real implementation, validate API key and check permissions
  next();
});

router.post('/api/keys/generate', (req, res) => {
  const { keyName, subclientId, permissions, expiryDays } = req.body;
  
  // Generate secure API key
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const keyType = subclientId ? 'user' : 'comp';
  const apiKey = `${keyType}_${randomString}_${timestamp}`;
  
  // In real implementation, store in database with encryption
  res.json({
    success: true,
    data: {
      id: `key_${timestamp}`,
      name: keyName,
      apiKey: apiKey,
      permissions: permissions || 'read',
      expiryDate: expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null,
      createdAt: new Date(),
      status: 'active'
    },
    message: 'تم توليد مفتاح API بنجاح'
  });
});

router.post('/api/keys/rotate/:keyId', (req, res) => {
  const { keyId } = req.params;
  
  // Generate new API key
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const apiKey = `user_${randomString}_${timestamp}_rotated`;
  
  res.json({
    success: true,
    data: {
      id: keyId,
      apiKey: apiKey,
      rotatedAt: new Date(),
      status: 'active'
    },
    message: 'تم تدوير مفتاح API بنجاح'
  });
});

router.delete('/api/keys/:keyId', (req, res) => {
  const { keyId } = req.params;
  
  res.json({
    success: true,
    message: 'تم إلغاء مفتاح API بنجاح'
  });
});

// Usage tracking endpoints
router.get('/api/usage/daily/:userId?', (req, res) => {
  const { userId } = req.params;
  
  // Mock usage data
  const usageData = {
    date: new Date().toISOString().split('T')[0],
    messagesCount: Math.floor(Math.random() * 5000) + 1000,
    apiCalls: Math.floor(Math.random() * 10000) + 2000,
    dataTransferred: Math.floor(Math.random() * 1000) + 100, // MB
    successRate: (Math.random() * 5 + 95).toFixed(1), // 95-100%
    limits: {
      messagesPerDay: 5000,
      apiCallsPerDay: 15000,
      dataPerMonth: 10000 // MB
    }
  };
  
  res.json({
    success: true,
    data: usageData
  });
});

// Permissions management
router.get('/api/permissions/:userId', (req, res) => {
  const { userId } = req.params;
  
  const permissions = [
    { name: 'send_messages', label: 'إرسال الرسائل النصية', granted: true },
    { name: 'send_media', label: 'إرسال الصور والملفات', granted: true },
    { name: 'read_status', label: 'قراءة حالة الرسائل', granted: true },
    { name: 'manage_contacts', label: 'إدارة جهات الاتصال', granted: false },
    { name: 'create_groups', label: 'إنشاء مجموعات', granted: false },
    { name: 'webhook_access', label: 'استقبال الرسائل عبر Webhook', granted: false },
    { name: 'bulk_messages', label: 'إرسال رسائل جماعية', granted: false }
  ];
  
  res.json({
    success: true,
    data: permissions
  });
});

router.post('/api/permissions/request', (req, res) => {
  const { userId, permissionType, reason } = req.body;
  
  // In real implementation, create permission request in database
  res.json({
    success: true,
    data: {
      requestId: `req_${Date.now()}`,
      status: 'pending',
      submittedAt: new Date()
    },
    message: 'تم إرسال طلب الصلاحيات بنجاح'
  });
});

// Activity logging
router.get('/api/activity/:userId', (req, res) => {
  const { userId } = req.params;
  const { limit = 10 } = req.query;
  
  const activities = [
    {
      id: 1,
      type: 'message_sent',
      title: 'إرسال رسالة نصية',
      description: 'إلى +966501234567',
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      icon: 'envelope',
      status: 'success'
    },
    {
      id: 2,
      type: 'media_sent',
      title: 'إرسال صورة',
      description: 'إلى +966507654321',
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      icon: 'image',
      status: 'success'
    },
    {
      id: 3,
      type: 'api_key_updated',
      title: 'تحديث مفتاح API',
      description: 'تدوير مفتاح API',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      icon: 'key',
      status: 'info'
    },
    {
      id: 4,
      type: 'login',
      title: 'تسجيل دخول',
      description: 'من عنوان IP: 192.168.1.100',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      icon: 'sign-in-alt',
      status: 'success'
    }
  ];
  
  res.json({
    success: true,
    data: activities.slice(0, parseInt(limit as string))
  });
});

// Notifications and alerts
router.get('/api/notifications/:userId?', (req, res) => {
  const notifications = [
    {
      id: 1,
      type: 'info',
      title: 'تحديث النظام',
      message: 'سيتم إجراء صيانة دورية يوم الجمعة من 2-4 صباحاً',
      timestamp: new Date(),
      read: false
    },
    {
      id: 2,
      type: 'warning',
      title: 'تنبيه الاستخدام',
      message: 'تم استهلاك 85% من حصة الرسائل الشهرية',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: false
    },
    {
      id: 3,
      type: 'success',
      title: 'تم تفعيل الميزة الجديدة',
      message: 'يمكنك الآن استخدام ميزة الرسائل المجدولة',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      read: true
    }
  ];
  
  res.json({
    success: true,
    data: notifications
  });
});

export default router;