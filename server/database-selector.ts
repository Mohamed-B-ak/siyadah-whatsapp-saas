import { StorageFactory } from './storage-factory';
import type { IStorage } from './storage';

// Database selector with automatic fallback
export class DatabaseSelector {
  private static storage: IStorage | null = null;

  static async initializeStorage(): Promise<IStorage> {
    if (this.storage) {
      return this.storage;
    }

    // MongoDB is now the primary and only database
    const dbType = 'mongodb';
    
    try {
      this.storage = await StorageFactory.createStorage(dbType);
      return this.storage;
    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw error;
    }
  }

  static getStorage(): IStorage {
    if (!this.storage) {
      throw new Error('Storage not initialized. Call initializeStorage() first.');
    }
    return this.storage;
  }

  static async switchDatabase(type: 'postgresql' | 'mongodb'): Promise<IStorage> {
    try {
      this.storage = await StorageFactory.switchStorage(type);
      console.log(`✅ Successfully switched to ${type} database`);
      return this.storage;
    } catch (error) {
      console.error(`❌ Failed to switch to ${type}:`, error);
      throw error;
    }
  }
}