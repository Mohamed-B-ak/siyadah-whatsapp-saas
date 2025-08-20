import { DatabaseStorage } from './storage';
import { MongoStorage } from './mongodb';
import type { IStorage } from './storage';

// Storage factory to switch between PostgreSQL and MongoDB
export class StorageFactory {
  private static instance: IStorage | null = null;

  static async createStorage(type: 'postgresql' | 'mongodb' = 'mongodb'): Promise<IStorage> {
    if (this.instance) {
      return this.instance;
    }

    try {
      if (type === 'mongodb') {
        console.log('🍃 Initializing MongoDB storage (primary)...');
        const mongoStorage = new MongoStorage();
        await mongoStorage.healthCheck();
        this.instance = mongoStorage;
        console.log('✅ MongoDB storage initialized successfully');
      } else {
        console.log('🐘 Initializing PostgreSQL storage (deprecated)...');
        this.instance = new DatabaseStorage();
        await this.instance.healthCheck();
        console.log('✅ PostgreSQL storage initialized successfully');
      }

      return this.instance;
    } catch (error) {
      console.error(`❌ Failed to initialize ${type} storage:`, error);
      
      // Only MongoDB is supported now
      console.log('❌ MongoDB initialization failed - no fallback available');
      throw new Error('MongoDB storage failed to initialize');
    }
  }

  static getInstance(): IStorage {
    if (!this.instance) {
      throw new Error('Storage not initialized. Call createStorage() first.');
    }
    return this.instance;
  }

  static async switchStorage(type: 'postgresql' | 'mongodb'): Promise<IStorage> {
    this.instance = null;
    return await this.createStorage(type);
  }
}