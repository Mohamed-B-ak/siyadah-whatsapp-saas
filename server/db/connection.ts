import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://a:0c3aTYFDgXQuY54a@cluster0.4ylccly.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

class DatabaseManager {
  private static instance: MongoClient | null = null;
  private static db: Db | null = null;
  
  static async getInstance(): Promise<Db> {
    if (!this.instance) {
      this.instance = new MongoClient(MONGODB_URI, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
      });
      
      await this.instance.connect();
      this.db = this.instance.db('whatsapp_saas');
      
      console.log('✅ Database connection pool initialized');
      
      // Create indexes
      await this.createIndexes();
    }
    return this.db!;
  }

  private static async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Companies indexes
      await this.db.collection('companies').createIndex({ email: 1 }, { unique: true });
      await this.db.collection('companies').createIndex({ masterApiKey: 1 }, { unique: true });

      // Users indexes
      await this.db.collection('users').createIndex({ email: 1 });
      await this.db.collection('users').createIndex({ apiKey: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ companyId: 1 });

      // Sessions indexes
      await this.db.collection('sessions').createIndex({ sessionName: 1 });
      await this.db.collection('sessions').createIndex({ userId: 1 });
      await this.db.collection('sessions').createIndex({ companyId: 1 });

      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
      this.db = null;
      console.log('📤 Database connection closed');
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        await this.getInstance();
      }
      await this.db!.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }
}

export default DatabaseManager;