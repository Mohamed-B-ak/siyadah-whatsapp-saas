import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'WhatsApp SaaS API',
    version: '2.8.6',
    description: 'Complete WhatsApp Business API platform with MongoDB backend',
    contact: {
      name: 'WPPConnect SaaS',
      url: 'https://github.com/wppconnect-team/wppconnect-server'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development server'
    }
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Check system health and service status',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        server: { type: 'string', example: 'running' },
                        mongodb: { type: 'string', example: 'connected' },
                        whatsapp: { type: 'string', example: 'available' }
                      }
                    },
                    version: { type: 'string', example: '2.8.6' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/subclient/sessions': {
      get: {
        summary: 'List WhatsApp sessions',
        description: 'Get all WhatsApp sessions for authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of sessions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      sessionName: { type: 'string' },
                      status: { type: 'string', enum: ['connected', 'disconnected', 'waiting_qr'] },
                      lastActivity: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create WhatsApp session',
        description: 'Create a new WhatsApp session',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sessionName: { type: 'string', example: 'my-session' }
                },
                required: ['sessionName']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Session created successfully'
          }
        }
      }
    },
    '/api/v1/subclient/sessions/{sessionName}/qrcode': {
      get: {
        summary: 'Get QR code for session',
        description: 'Generate QR code for WhatsApp authentication',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'sessionName',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'QR code generated',
            content: {
              'image/png': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      }
    },
    '/api/v1/subclient/sessions/{sessionName}/send-message': {
      post: {
        summary: 'Send WhatsApp message',
        description: 'Send a text message via WhatsApp',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'sessionName',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string', example: '21653844063' },
                  message: { type: 'string', example: 'Hello from WhatsApp API!' }
                },
                required: ['phone', 'message']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Message sent successfully'
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Use your API key as bearer token'
      }
    }
  }
};

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WhatsApp SaaS API Documentation'
}));

export default router;