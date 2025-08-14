import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'express';
import saasRoutes from './saas-routes';
import whatsappSaasRoutes from './whatsapp-saas';

const app = express();

// Middleware أساسي
app.use(cors());
app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));

// مسارات SaaS الجديدة
app.use('/api/v2/saas', saasRoutes);
app.use('/api/v2/whatsapp', whatsappSaasRoutes);

// لوحة تحكم SaaS
app.get('/saas', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WPPConnect SaaS Platform</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px;
            }
            .header {
                text-align: center;
                color: white;
                margin-bottom: 40px;
            }
            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header p {
                font-size: 1.2rem;
                opacity: 0.9;
            }
            .cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 30px;
                margin-bottom: 40px;
            }
            .card {
                background: white;
                border-radius: 15px;
                padding: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
            }
            .card:hover {
                transform: translateY(-5px);
            }
            .card h2 {
                color: #5a6acf;
                margin-bottom: 15px;
                font-size: 1.5rem;
            }
            .card p {
                color: #666;
                line-height: 1.6;
                margin-bottom: 20px;
            }
            .endpoint {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin: 10px 0;
                border-left: 4px solid #5a6acf;
            }
            .method {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: bold;
                margin-right: 10px;
            }
            .post { background: #28a745; color: white; }
            .get { background: #007bff; color: white; }
            .put { background: #ffc107; color: black; }
            .delete { background: #dc3545; color: white; }
            .api-section {
                background: white;
                border-radius: 15px;
                padding: 30px;
                margin-top: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .code-block {
                background: #f1f3f4;
                border-radius: 8px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                margin: 10px 0;
                overflow-x: auto;
            }
            .feature-list {
                list-style: none;
                padding: 0;
            }
            .feature-list li {
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            .feature-list li:before {
                content: "✓ ";
                color: #28a745;
                font-weight: bold;
                margin-right: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 منصة WPPConnect SaaS</h1>
                <p>حلول WhatsApp API متعددة العملاء مع إدارة شاملة</p>
            </div>

            <div class="cards">
                <div class="card">
                    <h2>🏢 إدارة الشركات</h2>
                    <p>نظام شامل لإدارة الشركات والعملاء مع مفاتيح API منفصلة وحدود مخصصة لكل عميل</p>
                    <ul class="feature-list">
                        <li>تسجيل شركات جديدة</li>
                        <li>مفاتيح API رئيسية منفصلة</li>
                        <li>حدود مخصصة للمستخدمين والجلسات</li>
                        <li>خطط اشتراك متنوعة</li>
                    </ul>
                </div>

                <div class="card">
                    <h2>👥 إدارة المستخدمين</h2>
                    <p>إدارة المستخدمين الفرعيين تحت كل شركة مع صلاحيات وأدوار محددة</p>
                    <ul class="feature-list">
                        <li>مستخدمين فرعيين لكل شركة</li>
                        <li>مفاتيح API فردية</li>
                        <li>أدوار وصلاحيات مخصصة</li>
                        <li>تتبع النشاط والاستخدام</li>
                    </ul>
                </div>

                <div class="card">
                    <h2>📱 جلسات WhatsApp</h2>
                    <p>إدارة جلسات WhatsApp منفصلة لكل مستخدم مع QR Code تلقائي ومراقبة شاملة</p>
                    <ul class="feature-list">
                        <li>جلسات منفصلة لكل مستخدم</li>
                        <li>QR Code تلقائي</li>
                        <li>مراقبة الحالة المباشرة</li>
                        <li>سجل الرسائل الكامل</li>
                    </ul>
                </div>
            </div>

            <div class="api-section">
                <h2>📊 مسارات API الرئيسية</h2>
                
                <h3>🏢 إدارة الشركات</h3>
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <strong>/api/v2/saas/companies/register</strong>
                    <p>تسجيل شركة جديدة والحصول على Master API Key</p>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <strong>/api/v2/saas/companies/profile</strong>
                    <p>الحصول على معلومات الشركة (يتطلب Master API Key)</p>
                </div>

                <h3>👥 إدارة المستخدمين</h3>
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <strong>/api/v2/saas/users</strong>
                    <p>إنشاء مستخدم جديد والحصول على User API Key</p>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <strong>/api/v2/saas/users</strong>
                    <p>الحصول على قائمة المستخدمين</p>
                </div>

                <h3>📱 إدارة الجلسات</h3>
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <strong>/api/v2/saas/sessions</strong>
                    <p>إنشاء جلسة WhatsApp جديدة (يتطلب User API Key)</p>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <strong>/api/v2/whatsapp/sessions/{sessionName}/start</strong>
                    <p>بدء جلسة WhatsApp وتوليد QR Code</p>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <strong>/api/v2/whatsapp/sessions/{sessionName}/qrcode</strong>
                    <p>الحصول على QR Code للجلسة</p>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <strong>/api/v2/whatsapp/sessions/{sessionName}/send-message</strong>
                    <p>إرسال رسالة عبر الجلسة</p>
                </div>

                <h3>📊 التقارير والإحصائيات</h3>
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <strong>/api/v2/saas/analytics/company</strong>
                    <p>إحصائيات شاملة للشركة واستخدام الموارد</p>
                </div>

                <div class="code-block">
                    <strong>مثال على التسجيل:</strong><br>
                    POST /api/v2/saas/companies/register<br>
                    {<br>
                    &nbsp;&nbsp;"name": "شركة المثال",<br>
                    &nbsp;&nbsp;"email": "admin@example.com",<br>
                    &nbsp;&nbsp;"planType": "premium"<br>
                    }
                </div>

                <div class="code-block">
                    <strong>مثال على إنشاء مستخدم:</strong><br>
                    POST /api/v2/saas/users<br>
                    Authorization: Bearer [MASTER_API_KEY]<br>
                    {<br>
                    &nbsp;&nbsp;"name": "أحمد محمد",<br>
                    &nbsp;&nbsp;"email": "ahmed@example.com",<br>
                    &nbsp;&nbsp;"role": "user"<br>
                    }
                </div>

                <div class="code-block">
                    <strong>مثال على إرسال رسالة:</strong><br>
                    POST /api/v2/whatsapp/sessions/my-session/send-message<br>
                    Authorization: Bearer [USER_API_KEY]<br>
                    {<br>
                    &nbsp;&nbsp;"phone": "5521999999999",<br>
                    &nbsp;&nbsp;"message": "مرحباً من منصة SaaS!"<br>
                    }
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

export default app;