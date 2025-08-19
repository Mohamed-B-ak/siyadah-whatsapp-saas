// PostgreSQL storage deprecated - migration only
import { MongoStorage, mongoConnection } from './mongodb';

export async function migrateToMongoDB() {
  try {
    console.log('🔄 Migration from PostgreSQL to MongoDB...');
    console.log('⚠️ PostgreSQL deprecated - skipping migration');
    console.log('✅ MongoDB is the primary database');
  } catch (error) {
    console.log('Migration skipped:', error instanceof Error ? error.message : 'Unknown error');
  }
}