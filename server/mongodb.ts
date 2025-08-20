import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { Company, User, Session, Message, ApiUsageLog, ErrorLog } from '../shared/schema';

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://a:0c3aTYFDgXQuY54a@cluster0.4ylccly.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

class MongoDBConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    try {
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
      this.db = this.client.db('whatsapp_saas');
      
      console.log('✅ MongoDB connected successfully');
      
      // Create indexes for better performance
      await this.createIndexes();
      
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
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

      // Messages indexes
      await this.db.collection('messages').createIndex({ sessionId: 1 });
      await this.db.collection('messages').createIndex({ timestamp: -1 });
      await this.db.collection('messages').createIndex({ companyId: 1 });

      console.log('✅ MongoDB indexes created successfully');
    } catch (error) {
      console.error('⚠️ Error creating indexes:', error);
    }
  }

  async getCollection(name: string): Promise<Collection> {
    const db = await this.connect();
    return db.collection(name);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('✅ MongoDB disconnected');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const db = await this.connect();
      await db.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ MongoDB health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mongoConnection = new MongoDBConnection();

// MongoDB Storage Implementation
export class MongoStorage {
  private async getCompaniesCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('companies');
  }

  private async getUsersCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('users');
  }

  private async getSessionsCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('sessions');
  }

  private async getMessagesCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('messages');
  }

  private async getApiUsageLogsCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('apiUsageLogs');
  }

  private async getErrorLogsCollection(): Promise<Collection> {
    return await mongoConnection.getCollection('errorLogs');
  }

  // Company operations
  async getCompanyByEmail(email: string): Promise<Company | null> {
    try {
      console.log(`[AUTH-DEBUG] Looking up company: ${email}`);
      const collection = await this.getCompaniesCollection();
      const doc = await collection.findOne({ email });
      console.log(`[AUTH-DEBUG] Company found: ${doc ? 'YES' : 'NO'}`);
      if (doc) {
        console.log(`[AUTH-DEBUG] Company name: ${doc.name}, API Key: ${doc.masterApiKey}`);
        console.log(`[AUTH-DEBUG] Password field exists: ${!!doc.password}`);
        console.log(`[AUTH-DEBUG] Raw password hash length: ${doc.password ? doc.password.length : 0}`);
        const transformed = this.transformMongoDocument(doc);
        console.log(`[AUTH-DEBUG] Transformed company password exists: ${!!transformed.password}`);
        console.log(`[AUTH-DEBUG] Transformed password hash length: ${transformed.password ? transformed.password.length : 0}`);
        return transformed;
      }
      return null;
    } catch (error) {
      console.error('Error getting company by email:', error);
      return null;
    }
  }

  async getCompanyByApiKey(apiKey: string): Promise<Company | null> {
    const collection = await this.getCompaniesCollection();
    const company = await collection.findOne({ masterApiKey: apiKey });
    return company ? this.transformMongoDocument(company) : null;
  }

  async createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const collection = await this.getCompaniesCollection();
    const now = new Date();
    const companyData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(companyData);
    return {
      ...companyData,
      id: result.insertedId.toString(),
    } as Company;
  }

  async getCompany(id: string): Promise<Company | null> {
    const collection = await this.getCompaniesCollection();
    const company = await collection.findOne({ _id: new ObjectId(id) });
    return company ? this.transformMongoDocument(company) : null;
  }

  async updateCompany(id: string, data: Partial<Company>): Promise<Company | null> {
    const collection = await this.getCompaniesCollection();
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result ? this.transformMongoDocument(result) : null;
  }

  // User operations
  async getUserByApiKey(apiKey: string): Promise<User | null> {
    const collection = await this.getUsersCollection();
    const user = await collection.findOne({ apiKey });
    return user ? this.transformMongoDocument(user) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const collection = await this.getUsersCollection();
    const user = await collection.findOne({ email });
    return user ? this.transformMongoDocument(user) : null;
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    const collection = await this.getUsersCollection();
    const users = await collection.find({ companyId }).toArray();
    return users.map(user => this.transformMongoDocument(user));
  }

  async getUser(id: string): Promise<User | null> {
    const collection = await this.getUsersCollection();
    const user = await collection.findOne({ _id: new ObjectId(id) });
    return user ? this.transformMongoDocument(user) : null;
  }

  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const collection = await this.getUsersCollection();
    const now = new Date();
    const userData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(userData);
    return {
      ...userData,
      id: result.insertedId.toString(),
    } as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const collection = await this.getUsersCollection();
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result ? this.transformMongoDocument(result) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const collection = await this.getUsersCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Session operations
  async getSessionsByUser(userId: string): Promise<Session[]> {
    const collection = await this.getSessionsCollection();
    const sessions = await collection.find({ userId }).toArray();
    return sessions.map(session => this.transformMongoDocument(session));
  }

  async getSessionsByCompany(companyId: string): Promise<Session[]> {
    const collection = await this.getSessionsCollection();
    const sessions = await collection.find({ companyId }).toArray();
    return sessions.map(session => this.transformMongoDocument(session));
  }

  async getSessionByName(sessionName: string): Promise<Session | null> {
    const collection = await this.getSessionsCollection();
    const session = await collection.findOne({ sessionName });
    return session ? this.transformMongoDocument(session) : null;
  }

  async createSession(data: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const collection = await this.getSessionsCollection();
    const sessionData = {
      ...data,
      createdAt: new Date(),
    };

    const result = await collection.insertOne(sessionData);
    return {
      ...sessionData,
      id: result.insertedId.toString(),
    } as Session;
  }

  async updateSession(id: string, data: Partial<Session>): Promise<Session | null> {
    const collection = await this.getSessionsCollection();
    
    // Handle both ObjectId and string IDs
    let filter;
    try {
      const { ObjectId } = require('mongodb');
      if (ObjectId.isValid(id)) {
        filter = { _id: new ObjectId(id) };
      } else {
        filter = { id: id };
      }
    } catch (error) {
      filter = { id: id };
    }

    const result = await collection.findOneAndUpdate(
      filter,
      { $set: data },
      { returnDocument: 'after' }
    );

    return result ? this.transformMongoDocument(result) : null;
  }

  async updateSessionQRCode(sessionId: string, qrCode: string): Promise<Session | null> {
    const collection = await this.getSessionsCollection();
    
    // Handle both ObjectId and string IDs
    let filter;
    try {
      const { ObjectId } = require('mongodb');
      if (ObjectId.isValid(sessionId)) {
        filter = { _id: new ObjectId(sessionId) };
      } else {
        filter = { id: sessionId };
      }
    } catch (error) {
      filter = { id: sessionId };
    }

    const updateData = {
      qrCode: qrCode,
      qrCodeGeneratedAt: new Date(),
      status: 'qr_ready'
    };

    const result = await collection.findOneAndUpdate(
      filter,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result ? this.transformMongoDocument(result) : null;
  }

  async updateSessionByName(sessionName: string, data: Partial<Session>): Promise<Session | null> {
    const collection = await this.getSessionsCollection();
    
    const result = await collection.findOneAndUpdate(
      { sessionName: sessionName },
      { $set: data },
      { returnDocument: 'after' }
    );

    return result ? this.transformMongoDocument(result) : null;
  }

  async deleteSession(id: string): Promise<boolean> {
    const collection = await this.getSessionsCollection();
    
    // Try different ID formats to handle both ObjectId and string IDs
    let result;
    try {
      // First try with MongoDB ObjectId
      const { ObjectId } = require('mongodb');
      if (ObjectId.isValid(id)) {
        result = await collection.deleteOne({ _id: new ObjectId(id) });
      } else {
        // Fallback to string ID
        result = await collection.deleteOne({ _id: id });
      }
    } catch (error) {
      console.log('Primary delete failed, trying alternative methods:', error);
      
      // Try deleting by sessionName if ID doesn't work
      result = await collection.deleteOne({ sessionName: id });
      
      if (result.deletedCount === 0) {
        // Try deleting by any field that contains the ID
        result = await collection.deleteOne({
          $or: [
            { _id: id },
            { sessionName: id },
            { sessionName: { $regex: id } }
          ]
        });
      }
    }
    
    console.log(`Delete session result for ${id}: deleted ${result.deletedCount} documents`);
    return result.deletedCount > 0;
  }

  // Message operations
  async createMessage(data: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const collection = await this.getMessagesCollection();
    const messageData = {
      ...data,
      timestamp: new Date(),
    };

    const result = await collection.insertOne(messageData);
    return {
      ...messageData,
      id: result.insertedId.toString(),
    } as Message;
  }

  async getMessagesBySession(sessionId: string, limit: number = 100): Promise<Message[]> {
    const collection = await this.getMessagesCollection();
    const messages = await collection
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    return messages.map(message => this.transformMongoDocument(message));
  }

  // Logging operations
  async logApiUsage(log: Omit<ApiUsageLog, 'id' | 'timestamp'>): Promise<void> {
    const collection = await this.getApiUsageLogsCollection();
    await collection.insertOne({
      ...log,
      timestamp: new Date(),
    });
  }

  async logError(log: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<void> {
    const collection = await this.getErrorLogsCollection();
    await collection.insertOne({
      ...log,
      timestamp: new Date(),
    });
  }

  // Analytics operations
  async getAllCompanies(): Promise<Company[]> {
    const collection = await this.getCompaniesCollection();
    const companies = await collection.find({}).toArray();
    return companies.map(company => this.transformMongoDocument(company));
  }

  async getAllUsers(): Promise<User[]> {
    const collection = await this.getUsersCollection();
    const users = await collection.find({}).toArray();
    return users.map(user => this.transformMongoDocument(user));
  }

  async getAllSessions(): Promise<Session[]> {
    const collection = await this.getSessionsCollection();
    const sessions = await collection.find({}).toArray();
    return sessions.map(session => this.transformMongoDocument(session));
  }

  async getMessageHistory(sessionId: string, limit: number = 100): Promise<Message[]> {
    return this.getMessagesBySession(sessionId, limit);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.getSessionsByUser(userId);
  }

  async getCompanySessions(companyId: string): Promise<Session[]> {
    return this.getSessionsByCompany(companyId);
  }

  async healthCheck(): Promise<boolean> {
    return await mongoConnection.healthCheck();
  }

  // Webhook configuration operations
  async updateUserWebhookConfig(userId: string, webhookUrl?: string, webhookToken?: string): Promise<User | null> {
    const collection = await this.getUsersCollection();
    const updateData: any = { updatedAt: new Date() };
    
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (webhookToken !== undefined) updateData.webhookToken = webhookToken;

    const result = await collection.findOneAndUpdate(
      { _id: userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result ? this.transformMongoDocument(result) : null;
  }

  async updateCompanyWebhookConfig(companyId: string, webhookUrl?: string, webhookToken?: string): Promise<Company | null> {
    const collection = await this.getCompaniesCollection();
    const updateData: any = { updatedAt: new Date() };
    
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (webhookToken !== undefined) updateData.webhookToken = webhookToken;

    const result = await collection.findOneAndUpdate(
      { _id: companyId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    return result ? this.transformMongoDocument(result) : null;
  }

  async updateCompanyByEmail(email: string, updates: Partial<Company>): Promise<Company | null> {
    const collection = await this.getCompaniesCollection();
    const result = await collection.findOneAndUpdate(
      { email: email },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result ? this.transformMongoDocument(result) : null;
  }

  async getUserWebhookConfig(userId: string): Promise<{ webhookUrl?: string; webhookToken?: string } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;
    
    return {
      webhookUrl: user.webhookUrl,
      webhookToken: user.webhookToken
    };
  }

  async getCompanyWebhookConfig(companyId: string): Promise<{ webhookUrl?: string; webhookToken?: string } | null> {
    const company = await this.getCompany(companyId);
    if (!company) return null;
    
    return {
      webhookUrl: company.webhookUrl,
      webhookToken: company.webhookToken
    };
  }

  // Helper method to transform MongoDB documents
  private transformMongoDocument(doc: any): any {
    if (!doc) return null;
    
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
    };
  }
}

// Export MongoDB storage instance
export const mongoStorage = new MongoStorage();