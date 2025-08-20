import request from 'supertest';
import express from 'express';
import subclientAPI from '../../server/subclient-api';

// Mock storage
jest.mock('../../server/storage', () => ({
  storage: {
    getCompanyByApiKey: jest.fn(),
    createUser: jest.fn(),
    getUsersByCompany: jest.fn(),
    getUserByEmail: jest.fn(),
    logApiUsage: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1', subclientAPI);

describe('Subclient API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/subclients', () => {
    it('should create a subclient successfully', async () => {
      const mockCompany = { id: 'comp_123', name: 'Test Company' };
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        apiKey: 'user_api_123',
        isActive: true,
        createdAt: new Date(),
      };

      const { storage } = require('../../server/storage');
      storage.getCompanyByApiKey.mockResolvedValue(mockCompany);
      storage.getUserByEmail.mockResolvedValue(null); // No existing user
      storage.createUser.mockResolvedValue(mockUser);
      storage.logApiUsage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/subclients')
        .set('Authorization', 'Bearer comp_demo_master_123')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          permissions: 'read',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.subclient).toBeDefined();
    });

    it('should return 401 for invalid API key', async () => {
      const { storage } = require('../../server/storage');
      storage.getCompanyByApiKey.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/subclients')
        .set('Authorization', 'Bearer invalid_key')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/subclients', () => {
    it('should list subclients successfully', async () => {
      const mockCompany = { id: 'comp_123', name: 'Test Company' };
      const mockUsers = [
        {
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          permissions: 'read',
          role: 'user',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      const { storage } = require('../../server/storage');
      storage.getCompanyByApiKey.mockResolvedValue(mockCompany);
      storage.getUsersByCompany.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/v1/subclients')
        .set('Authorization', 'Bearer comp_demo_master_123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subclients).toHaveLength(1);
      expect(response.body.count).toBe(1);
    });
  });
});