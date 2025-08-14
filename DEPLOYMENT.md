# دليل النشر - WhatsApp SaaS Platform

## متطلبات النشر

### البيئة
- Node.js 20+
- PostgreSQL 16+
- Chrome/Chromium for WhatsApp Web

### متغيرات البيئة المطلوبة
```bash
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-secure-session-secret-here
REPL_ID=your-replit-id
ISSUER_URL=https://replit.com/oidc
REPLIT_DOMAINS=your-domain.replit.app
```

## خطوات النشر

### 1. تجهيز الكود
```bash
# تثبيت التبعيات
npm install

# تشغيل الاختبارات
npm test

# بناء المشروع
npm run build

# تدقيق الكود
npm run lint
```

### 2. إعداد قاعدة البيانات
```bash
# تشغيل migrations
npm run db:push

# إدراج البيانات الأساسية
npm run db:seed
```

### 3. نشر على Replit
```bash
# رفع الكود
git add .
git commit -m "Ready for production"
git push origin main

# تفعيل Deployments في Replit
# Configure environment variables
# Deploy to production
```

### 4. نشر على Vercel
```bash
# تثبيت Vercel CLI
npm i -g vercel

# نشر
vercel --prod

# إعداد متغيرات البيئة
vercel env add DATABASE_URL
vercel env add SESSION_SECRET
```

### 5. نشر على Heroku
```bash
# إنشاء تطبيق Heroku
heroku create your-app-name

# إضافة PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# إعداد متغيرات البيئة
heroku config:set SESSION_SECRET=your-secret

# نشر
git push heroku main
```

## فحوصات ما بعد النشر

### 1. اختبار الصحة
```bash
curl https://your-domain.com/health
```

### 2. اختبار APIs
```bash
curl -X GET "https://your-domain.com/api/v1/subclients" \
  -H "Authorization: Bearer comp_demo_master_123"
```

### 3. اختبار الواجهات
- افتح `/company-dashboard.html`
- تحقق من تحميل البيانات
- اختبر إنشاء عميل فرعي

## مراقبة الأداء

### مقاييس مهمة
- Response Time < 500ms
- Uptime > 99.9%
- Memory Usage < 512MB
- Database Connections < 20

### أدوات المراقبة
- Lighthouse للأداء
- New Relic للخادم
- Sentry للأخطاء

## الأمان في الإنتاج

### SSL/TLS
- استخدم HTTPS دائماً
- تأكد من شهادات SSL صالحة

### مفاتيح API
- لا تعرض مفاتيح في الكود
- استخدم متغيرات البيئة
- دوّر المفاتيح دورياً

### قاعدة البيانات
- اتصالات مشفرة
- نسخ احتياطية يومية
- فحص أمني شهري

## استكشاف الأخطاء

### أخطاء شائعة
1. **Port already in use**: قم بإعادة تشغيل الخادم
2. **Database connection failed**: تحقق من DATABASE_URL
3. **Chrome not found**: ثبت chromium

### سجلات (Logs)
```bash
# عرض السجلات
heroku logs --tail

# فلترة سجلات الأخطاء
heroku logs --tail | grep ERROR
```

## النسخ الاحتياطية

### قاعدة البيانات
```bash
# إنشاء نسخة احتياطية
pg_dump $DATABASE_URL > backup.sql

# استعادة النسخة
psql $DATABASE_URL < backup.sql
```

### الملفات
- رفع الكود لـ Git
- نسخ الإعدادات للـ cloud storage

## التحديثات

### تحديث النظام
1. اختبار التحديث محلياً
2. إنشاء نسخة احتياطية
3. نشر على staging
4. اختبار شامل
5. نشر للإنتاج
6. مراقبة لمدة 24 ساعة

### Rollback
```bash
# العودة للإصدار السابق
heroku rollback v123
```

---

## Quick Deploy Commands

### Replit Deploy
```bash
# Auto-deploy enabled
git push origin main
```

### Vercel Deploy
```bash
vercel --prod
```

### Heroku Deploy
```bash
git push heroku main
```

تم تجهيز النظام بالكامل للنشر الفوري على أي منصة سحابية.