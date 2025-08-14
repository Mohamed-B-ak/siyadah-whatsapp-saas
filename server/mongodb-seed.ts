import { MongoStorage } from './mongodb';
import { generateApiKey } from './simple-file-auth';

export async function seedMongoDatabase() {
  try {
    const mongoStorage = new MongoStorage();
    
    // Check if demo company already exists
    const existingCompany = await mongoStorage.getCompanyByApiKey('comp_demo_master_123');
    
    if (existingCompany) {
      console.log('MongoDB already seeded - preserving existing data');
      return;
    }

    console.log('Seeding MongoDB with demo data...');

    // Create demo company
    const demoCompany = await mongoStorage.createCompany({
      name: 'Demo Company',
      email: 'demo@company.com',
      masterApiKey: 'comp_demo_master_123',
      planType: 'premium',
      maxUsers: 50,
      maxSessions: 20,
      isActive: true
    });

    console.log('✅ Demo company created in MongoDB:', demoCompany.id);

    // Create demo users
    const demoUsers = [
      {
        companyId: demoCompany.id,
        name: 'Ahmed Admin',
        firstName: 'Ahmed',
        lastName: 'Admin',
        email: 'ahmed@test.com',
        phone: '+1234567890',
        role: 'admin',
        apiKey: 'user_demo_456',
        passwordHash: '$2b$10$example_hash_for_secure123',
        permissions: { admin: true, sessions: true, messages: true },
        status: 'active',
        isActive: true
      },
      {
        companyId: demoCompany.id,
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        email: 'logintest@example.com',
        phone: '+0987654321',
        role: 'user',
        apiKey: generateApiKey(),
        passwordHash: '$2b$10$example_hash_for_password123',
        permissions: { sessions: true, messages: true },
        status: 'active',
        isActive: true
      }
    ];

    for (const userData of demoUsers) {
      const user = await mongoStorage.createUser(userData);
      console.log('✅ Demo user created in MongoDB:', user.email);
    }

    console.log('🎉 MongoDB seeding completed successfully');
  } catch (error) {
    console.error('❌ Error seeding MongoDB:', error);
  }
}