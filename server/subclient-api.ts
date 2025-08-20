import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// Get all subclients for a company
router.get('/subclients', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required in Authorization header'
      });
    }

    const masterApiKey = authHeader.substring(7);
    
    // Authenticate company using master API key
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    // Get all users for this company
    const users = await storage.getUsersByCompany(company.id);
    
    // Format users as subclients with proper structure
    const subclients = users.map(user => ({
      id: user.id,
      name: user.name,
      firstName: user.firstName || user.name?.split(' ')[0] || '',
      lastName: user.lastName || user.name?.split(' ')[1] || '',
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      status: user.isActive ? 'active' : 'inactive',
      apiKey: user.apiKey,
      createdAt: user.createdAt,
      isActive: user.isActive
    }));

    return res.status(200).json({
      success: true,
      subclients,
      total: subclients.length,
      message: `Found ${subclients.length} subclients`
    });

  } catch (error) {
    console.error('Error fetching subclients:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching subclients'
    });
  }
});

// Create new subclient/user under company
router.post('/subclients', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required in Authorization header'
      });
    }

    const masterApiKey = authHeader.substring(7);
    
    // Authenticate company using master API key
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    const { firstName, lastName, email, phone, permissions, serviceType } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: firstName, lastName, email'
      });
    }

    // Check if email already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create subclient
    const userData = {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email,
      companyId: company.id,
      permissions: ['read', 'write'],
      status: 'active',
      apiKey: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      isActive: true
    };

    const newUser = await storage.createUser(userData);

    // Log API usage (optional - skip if fails)
    try {
      await storage.logApiUsage({
        companyId: company.id,
        endpoint: 'create-subclient',
        method: 'POST',
        statusCode: 201,
        responseTime: Date.now()
      });
    } catch (logError) {
      console.warn('Failed to log API usage:', (logError as Error).message);
    }

    res.status(201).json({
      success: true,
      subclient: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        permissions: newUser.permissions,
        serviceType: serviceType || 'messaging',
        apiKey: newUser.apiKey, // User API key for subclient
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      },
      message: 'Subclient created successfully'
    });

  } catch (error) {
    console.error('Error creating subclient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subclient',
      error: (error as Error).message
    });
  }
});

// Get all subclients for a company
router.get('/subclients', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required'
      });
    }

    const masterApiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    const subclients = await storage.getUsersByCompany(company.id);

    res.json({
      success: true,
      subclients: subclients.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        permissions: user.permissions,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastActivity: user.updatedAt
      })),
      count: subclients.length
    });

  } catch (error) {
    console.error('Error fetching subclients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subclients',
      error: (error as Error).message
    });
  }
});

// Get specific subclient details
router.get('/subclients/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required'
      });
    }

    const masterApiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    const { userId } = req.params;
    const user = await storage.getUser(userId);

    if (!user || user.companyId !== company.id) {
      return res.status(404).json({
        success: false,
        message: 'Subclient not found'
      });
    }

    res.json({
      success: true,
      subclient: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        permissions: user.permissions,
        role: user.role,
        apiKey: user.apiKey,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching subclient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subclient',
      error: (error as Error).message
    });
  }
});

// Update subclient
router.put('/subclients/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required'
      });
    }

    const masterApiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    const { userId } = req.params;
    const user = await storage.getUser(userId);

    if (!user || user.companyId !== company.id) {
      return res.status(404).json({
        success: false,
        message: 'Subclient not found'
      });
    }

    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      permissions: req.body.permissions,
      status: req.body.status
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const updatedUser = await storage.updateUser(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update subclient'
      });
    }

    res.json({
      success: true,
      subclient: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        permissions: updatedUser.permissions,
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt
      },
      message: 'Subclient updated successfully'
    });

  } catch (error) {
    console.error('Error updating subclient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subclient',
      error: (error as Error).message
    });
  }
});

// Delete/Deactivate subclient
router.delete('/subclients/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required'
      });
    }

    const masterApiKey = authHeader.substring(7);
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    const { userId } = req.params;
    const user = await storage.getUser(userId);

    if (!user || user.companyId !== company.id) {
      return res.status(404).json({
        success: false,
        message: 'Subclient not found'
      });
    }

    // Deactivate instead of deleting
    await storage.updateUser(userId, { status: 'inactive' });

    res.json({
      success: true,
      message: 'Subclient deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating subclient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate subclient',
      error: (error as Error).message
    });
  }
});

// Delete subclient/user
router.delete('/subclients/:userId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Company Master API key required in Authorization header'
      });
    }

    const masterApiKey = authHeader.substring(7);
    const { userId } = req.params;
    
    // Authenticate company using master API key
    const company = await storage.getCompanyByApiKey(masterApiKey);
    if (!company) {
      return res.status(401).json({
        success: false,
        message: 'Invalid company master API key'
      });
    }

    // Get user to verify it belongs to this company
    const users = await storage.getUsersByCompany(company.id);
    const userToDelete = users.find(u => u.id === userId);
    
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Subclient not found or does not belong to your company'
      });
    }

    // Delete the user
    const deleted = await storage.deleteUser(userId);
    
    if (deleted) {
      return res.status(200).json({
        success: true,
        message: 'Subclient deleted successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete subclient'
      });
    }

  } catch (error) {
    console.error('Error deleting subclient:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting subclient'
    });
  }
});

export default router;