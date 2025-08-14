import { Express } from 'express';
import bcrypt from 'bcrypt';
// MongoDB-only auth
import { type User } from '../shared/schema';
import { logger } from './utils/logger';

export function setupDirectAuth(app: Express) {
  // Direct user registration endpoint
  app.post('/direct/auth/register', async (req, res) => {
    try {
      const { name, email, password, phone, firstName, lastName } = req.body;
      
      logger.info(`[DIRECT-REGISTER] Registration attempt for email: ${email}`);

      // Validate required fields
      if (!name || !email || !password) {
        logger.warn(`[DIRECT-REGISTER] Registration failed - missing required fields for ${email}`);
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      // Check if user already exists using direct database query
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        logger.warn(`[DIRECT-REGISTER] Registration failed - user already exists: ${email}`);
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate API key
      const apiKey = `user_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 8)}`;

      // Create user directly in database
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          phone: phone || null,
          firstName: firstName || null,
          lastName: lastName || null,
          role: 'user',
          apiKey,
          passwordHash,
          permissions: ['send_messages', 'create_sessions', 'manage_sessions'],
          status: 'active',
          isActive: true,
          companyId: 'comp_mc26okot_4671799226df' // Use existing company ID from database
        })
        .returning();

      logger.info(`[DIRECT-REGISTER] User registered successfully: ${email}`);
      logger.info(`[DIRECT-REGISTER] User ID: ${newUser.id}, API Key: ${newUser.apiKey}`);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          apiKey: newUser.apiKey
        }
      });

    } catch (error) {
      logger.error('[DIRECT-REGISTER] Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  });

  // Direct user login endpoint
  app.post('/direct/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      logger.info(`[DIRECT-LOGIN] Login attempt for email: ${email}`);

      if (!email || !password) {
        logger.warn(`[DIRECT-LOGIN] Login failed - missing credentials for ${email}`);
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user by email directly from database
      logger.info(`[DIRECT-LOGIN] Querying database for user: ${email}`);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      logger.info(`[DIRECT-LOGIN] Database query result - User found: ${!!user}`);
      if (user) {
        logger.info(`[DIRECT-LOGIN] User details - ID: ${user.id}, Email: ${user.email}, Company: ${user.companyId}`);
      }

      if (!user) {
        logger.warn(`[DIRECT-LOGIN] Login failed - user not found: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Debug password verification
      logger.info(`[DIRECT-LOGIN] Password hash exists: ${!!user.passwordHash}`);
      logger.info(`[DIRECT-LOGIN] Password hash length: ${user.passwordHash?.length || 0}`);
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash || '');
      logger.info(`[DIRECT-LOGIN] Password verification result: ${isValidPassword}`);
      
      if (!isValidPassword) {
        logger.warn(`[DIRECT-LOGIN] Login failed - invalid password for: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn(`[DIRECT-LOGIN] Login failed - account deactivated: ${email}`);
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Update last login directly in database
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      logger.info(`[DIRECT-LOGIN] User logged in successfully: ${email} (ID: ${user.id})`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: Array.isArray(user.permissions) ? user.permissions : ['send_messages', 'create_sessions', 'manage_sessions'],
          hasApiKey: !!user.apiKey
        }
      });

    } catch (error) {
      logger.error('[DIRECT-LOGIN] Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  });

  // Direct user profile endpoint
  app.get('/direct/auth/profile', async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find user by email directly from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email as string))
        .limit(1);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          permissions: Array.isArray(user.permissions) ? user.permissions : ['send_messages', 'create_sessions', 'manage_sessions'],
          status: user.status,
          apiKey: user.apiKey,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      });

    } catch (error) {
      logger.error('[DIRECT-PROFILE] Profile fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile'
      });
    }
  });
}