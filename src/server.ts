/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import companyAPIRoutes from '../server/company-api-routes';
import dashboardRouter from '../server/dashboard-router';
// إضافة نظام SaaS مباشرة للخادم الحالي
import saasRoutes from '../server/saas-routes';
// إضافة نسخة مبسطة للاختبار
import saasSimple from '../server/saas-simple';
import saasWhatsappBridge from '../server/saas-whatsapp-bridge';
import subclientAPI from '../server/subclient-api';
import webhookHandler from '../server/webhook-handler';
import simpleWebhookRouter from '../server/simple-webhook-router';
// Clean routes only
// MongoDB-only APIs
// MongoDB-only authentication
// إضافة دعم MongoDB وإدارة قواعد البيانات
import databaseRoutes from '../server/database-routes';
// Clean system without demo auth
// Clean authentication system
import config from './config';
import { initServer } from './index';

const { app } = initServer(config);

// UNIFIED API ARCHITECTURE - Enterprise Grade
import unifiedRoutes from '../server/routes';
app.use('/api/v1', unifiedRoutes); // Unified API structure

// Legacy compatibility routes
app.use('/api/v1', saasRoutes); // Advanced SaaS features (legacy)
app.use('/saas/api', saasWhatsappBridge); // WhatsApp integration (legacy)
app.use('/', webhookHandler); // Webhook handling
app.use('/api/webhook', simpleWebhookRouter); // Webhook configuration API
app.use('/', dashboardRouter);
app.use('/api/database', databaseRoutes); // Database management API

// Authentication system - now handled by unified routes
import authRoutes from '../server/unified-auth';
app.use('/auth', authRoutes);

// Unified API v1 routes
import whatsappRoutes from '../server/routes/whatsapp';
app.use('/api/v1/whatsapp', whatsappRoutes);

// Enterprise features (legacy compatibility)
import advancedAnalytics from '../server/advanced-analytics';
import enterpriseFeatures from '../server/enterprise-features';
import notificationSystem from '../server/notification-system';
import backupSystem from '../server/backup-system';

app.use('/api/analytics/advanced', advancedAnalytics);
app.use('/api/enterprise', enterpriseFeatures);
app.use('/api/notifications', notificationSystem);
app.use('/api/backup', backupSystem);

// Initialize enterprise middleware
import { performanceMonitor, memoryMonitor } from '../server/middleware/performance';
import { sessionManager } from '../server/services/session-manager';

app.use(performanceMonitor);
memoryMonitor();

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'up' },
      whatsapp: { status: 'up', activeSessions: sessionManager.getStats().active },
      system: { 
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    },
    version: '2.8.6'
  };
  res.json(health);
});

console.log('🚀 Siyadah WhatsApp Enterprise Platform Ready');
console.log('📊 Unified API: /api/v1/*');
console.log('📈 Performance monitoring active');
console.log('🧹 Session management initialized');

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Enhanced console messaging for port 5000
const startupMessage = async () => {
  // Initialize database
  try {
    const { seedDatabase } = await import('../server/seed');
    await seedDatabase();
  } catch (error) {
    console.warn('Database seeding skipped:', error instanceof Error ? error.message : error);
  }

  console.log('\n=== Siyadah WhatsApp SaaS Platform ===');
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log('📚 Available API Endpoints:');
  console.log('   • Company API: /api/v1/company');
  console.log('   • Sub-client API: /api/v1/subclient');
  console.log('   • Health Check: /api/health');
  console.log('   • API Docs: /api/docs');
  console.log('   • WhatsApp Bridge: /saas/api');
  console.log('🔑 Authentication:');
  console.log('     Register companies and users via /auth/register');
  console.log('     Login via /auth/login');
  console.log('📖 Documentation: Visit /api/docs for full API reference');
  console.log('📋 Register: /register.html | Login: /login.html');
  console.log('================================\n');
};

// Call startup message after server initialization
setTimeout(startupMessage, 2000);

// Clean routes - no demo pages
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.get('/register', (req, res) => {
  res.redirect('/register.html');
});

app.get('/login', (req, res) => {
  res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin-dashboard.html');
});

app.get('/company-dashboard', (req, res) => {
  res.redirect('/company-dashboard.html');
});

app.get('/user-dashboard', (req, res) => {
  res.redirect('/user-dashboard.html');
});

app.get('/enterprise', (req, res) => {
  res.redirect('/enterprise-dashboard.html');
});

app.get('/monitoring', (req, res) => {
  res.redirect('/system-monitoring.html');
});

// لوحة تحكم العميل
app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard.html');
});

// قائمة التنقل الإدارية
app.get('/menu', (req, res) => {
  res.redirect('/navigation-menu.html');
});
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Check if port is already in use before starting
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server successfully started on ${HOST}:${PORT}`);
});

// Handle port already in use error
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please wait a moment and try again.`);
    console.log('🔄 Attempting to restart in 5 seconds...');
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});