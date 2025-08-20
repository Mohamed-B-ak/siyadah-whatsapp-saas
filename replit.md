# Overview

This is a comprehensive WhatsApp SaaS platform built on WPPConnect technology with Arabic language support and enterprise-grade features. The system provides a multi-tenant architecture that allows companies to manage WhatsApp API integrations, user accounts, and messaging services through a unified platform. The application offers both Arabic and English interfaces with RTL (Right-to-Left) support, real-time messaging capabilities, QR code authentication, webhook integrations, and advanced analytics.

**🚀 DEPLOYMENT STATUS: RENDER.COM PRODUCTION READY ✅**
- **COMPLETED**: All TypeScript compilation errors resolved (0 errors from original 51)
- **VERIFIED**: Clean production build with successful TypeScript and Babel compilation
- Specialized Dockerfile with Chrome browser dependencies
- Complete render.yaml infrastructure configuration
- Comprehensive deployment guide included
- Webhook filtering optimized for incoming messages only
- Production-ready MongoDB integration
- **FIXED**: npm install command updated for render.com compatibility
- **FIXED**: TypeScript ESLint dependency conflicts resolved
- **FIXED**: Husky Git hooks disabled in production environment
- **FIXED**: TypeScript compiler availability during build process
- **FIXED**: All error handling patterns with proper type checking
- **FIXED**: Schema alignment issues (ObjectId types, required properties)
- **FIXED**: Crypto cipher method corrections for Node.js compatibility
- **FIXED**: Message creation webhook integration with proper schema compliance
- **DEPLOYMENT READY**: System successfully passes npm run build with 0 errors (August 20, 2025)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
- **Framework**: Express.js with TypeScript for type safety and modern development practices
- **Multi-tenant SaaS Design**: Company-based isolation with master API keys and sub-user management
- **Authentication**: JWT-based authentication with company and user-level access controls
- **Session Management**: Automated session lifecycle management with intelligent cleanup
- **API Design**: RESTful API with versioning (v1, v2) and comprehensive error handling

## Database Architecture
- **Primary Database**: MongoDB Atlas with connection string-based configuration
- **Data Models**: Companies, Users, Sessions, Messages, API Usage Logs, and Error Logs
- **Indexing Strategy**: Optimized indexes on email, API keys, company relationships, and session identifiers
- **Migration Support**: Built-in migration system from legacy PostgreSQL to MongoDB

## WhatsApp Integration
- **Core Library**: WPPConnect Team's WhatsApp Web API wrapper
- **Session Management**: Multi-session support (up to 50 concurrent sessions)
- **QR Code Generation**: High-quality PNG QR codes (11KB+) with retry mechanisms
- **Message Queue**: Advanced message queuing system for reliable delivery
- **Webhook System**: Real-time webhook notifications for incoming messages and status updates

## Frontend Architecture
- **Multi-language Support**: Arabic (RTL) and English interfaces with dynamic switching
- **Dashboard Types**: Admin dashboard, company dashboard, and user dashboard with role-based access
- **Real-time Updates**: Socket.IO integration for live session status and message notifications
- **Responsive Design**: Mobile-first design with cross-browser compatibility

## Security Architecture
- **API Key Management**: Hierarchical API key system (master keys for companies, individual keys for users)
- **Rate Limiting**: Advanced rate limiting with IP blocking and progressive penalties
- **Input Validation**: Zod schema validation for all API endpoints
- **Password Security**: bcrypt hashing with salt rounds for secure password storage

## Enterprise Features
- **Analytics System**: Real-time system metrics, performance monitoring, and usage analytics
- **Backup System**: Automated backup creation with compression and retention policies
- **Notification System**: Email notification templates for welcome, upgrades, and security alerts
- **Deployment Management**: Multi-environment deployment with health checks and version tracking

# External Dependencies

## Core WhatsApp Integration
- **@wppconnect-team/wppconnect**: Primary WhatsApp Web API integration library
- **Chromium Browser**: Headless browser engine for WhatsApp Web automation (via Nix store)
- **Chrome/Chromium**: Required for WhatsApp Web session management

## Database Services
- **MongoDB Atlas**: Primary database service with cloud hosting
- **Connection String**: MongoDB connection managed via environment variables

## Authentication & Security
- **bcrypt**: Password hashing and verification
- **jsonwebtoken**: JWT token generation and validation (temporarily disabled, using base64 encoding)
- **OpenID Connect**: OIDC integration for enterprise authentication

## File Storage & Processing
- **AWS S3**: File storage for media and attachments via AWS SDK v3
- **Multer**: File upload handling and processing
- **QRCode**: QR code generation for WhatsApp authentication
- **Archiver**: File compression and backup creation

## Communication & Notifications
- **Socket.IO**: Real-time bidirectional communication
- **Webhook System**: HTTP webhook delivery for external integrations
- **Email Templates**: HTML email generation for notifications

## Development & Monitoring
- **Winston**: Comprehensive logging system with file and console outputs
- **Swagger**: API documentation generation and interactive testing
- **ESLint & Prettier**: Code quality and formatting tools
- **Jest**: Testing framework for unit and integration tests

## External Services Integration
- **Stripe**: Payment processing for subscription management
- **Replit**: Platform hosting and deployment environment
- **FastAPI**: External webhook receiver integration (Python-based)

## Deployment Environment
- **Replit Hosting**: Primary deployment platform with environment variable management
- **Node.js 22.16.0**: Required runtime environment
- **Environment Variables**: Configuration management for database URLs, API keys, and service credentials