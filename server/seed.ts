// MongoDB-only seeding - PostgreSQL removed

import { MongoStorage, mongoConnection } from './mongodb';
import { migrateToMongoDB } from './migrate-to-mongodb';
import MessageQueueManager from '../src/services/messageQueueManager';
// No demo data cleanup needed

export async function seedDatabase() {
  // First try to migrate existing PostgreSQL data
  try {
    await migrateToMongoDB();
  } catch (error: any) {
    console.log('Migration skipped or failed:', error.message);
  }

  // Initialize MongoDB without demo data
  try {
    console.log('🔧 Initializing MongoDB connection...');
    
    // Connect to MongoDB
    const database = await mongoConnection.connect();
    console.log('✅ MongoDB connected successfully');
    
    // Initialize Message Queue System
    MessageQueueManager.initialize(database);
    
    // Set up the actual WhatsApp message sender
    MessageQueueManager.setMessageSender(async (sessionId: string, phone: string, message: string, options: any) => {
      try {
        // Get the client array from WPPConnect
        const { clientsArray } = require('../src/util/sessionUtil');
        
        // ClientsArray is an object/dictionary, not an array
        const client = clientsArray[sessionId];
        
        if (!client || !client.sendText) {
          console.error(`❌ WhatsApp client not found for session: ${sessionId}`);
          console.error(`Available sessions: ${Object.keys(clientsArray).join(', ')}`);
          return false;
        }
        
        const result = await client.sendText(phone, message, options);
        console.log(`✅ WhatsApp message sent via queue: ${sessionId} -> ${phone}`);
        return !!result;
      } catch (error: any) {
        console.error(`❌ WhatsApp sending error: ${error.message}`);
        return false;
      }
    });
    
    console.log('📬 Message Queue System initialized with WhatsApp integration');
    
    // System starts completely clean - no demo data
    console.log('✅ System initialized without demo data');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
}