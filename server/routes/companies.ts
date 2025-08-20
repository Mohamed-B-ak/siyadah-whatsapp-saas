import { Router } from 'express';
import { authenticateCompany } from '../middleware/auth';
import { MongoStorage } from '../mongodb';

const router = Router();
const storage = new MongoStorage();

// Get company profile
router.get('/profile', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    return res.json({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        email: company.email,
        planType: company.planType,
        isActive: company.isActive,
        createdAt: company.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// Update company profile
router.put('/profile', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const { name, planType } = req.body;

    const updatedCompany = await storage.updateCompany(company.id, {
      name,
      planType
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedCompany
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get company users
router.get('/users', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const users = await storage.getUsersByCompany(company.id);

    return res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
});

// Create new user
router.post('/users', authenticateCompany, async (req: any, res) => {
  try {
    const company = req.company;
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    const user = await storage.createUser({
      name,
      email,
      companyId: company.id,
      role: role || 'user',
      apiKey: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isActive: true
    });

    return res.json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

export default router;