/**
 * Persistent Token Storage for Cloud Deployments
 * Replaces file-based token storage with MongoDB GridFS
 */
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import { storage } from './storage';

interface TokenData {
  sessionId: string;
  tokenData: any;
  lastUpdated: Date;
  platform: string;
}

class PersistentTokenStorage {
  private bucket: GridFSBucket | null = null;
  
  async initialize() {
    if (this.bucket) return;
    
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://a:0c3aTYFDgXQuY54a@cluster0.4ylccly.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
      const client = new MongoClient(mongoUri);
      await client.connect();
      
      const db = client.db('whatsapp_saas');
      this.bucket = new GridFSBucket(db, { bucketName: 'session_tokens' });
      
      console.log('✅ Persistent token storage initialized');
    } catch (error) {
      console.error('❌ Token storage initialization failed:', error);
      throw error;
    }
  }

  async saveToken(sessionId: string, tokenData: any): Promise<void> {
    await this.initialize();
    
    try {
      // Delete existing token if it exists
      await this.deleteToken(sessionId);
      
      // Save new token data
      const uploadStream = this.bucket!.openUploadStream(`${sessionId}.token.json`, {
        metadata: {
          sessionId,
          lastUpdated: new Date(),
          platform: process.env.RENDER ? 'render' : 'replit'
        }
      });
      
      uploadStream.end(JSON.stringify(tokenData, null, 2));
      
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });
      
      console.log(`[TOKEN-STORAGE] Token saved for session: ${sessionId}`);
    } catch (error) {
      console.error(`[TOKEN-STORAGE] Failed to save token for ${sessionId}:`, error);
      throw error;
    }
  }

  async loadToken(sessionId: string): Promise<any | null> {
    await this.initialize();
    
    try {
      const files = await this.bucket!.find({ 
        filename: `${sessionId}.token.json` 
      }).toArray();
      
      if (files.length === 0) {
        console.log(`[TOKEN-STORAGE] No token found for session: ${sessionId}`);
        return null;
      }
      
      const downloadStream = this.bucket!.openDownloadStream(files[0]._id);
      const chunks: Buffer[] = [];
      
      await new Promise((resolve, reject) => {
        downloadStream.on('data', (chunk) => chunks.push(chunk));
        downloadStream.on('end', resolve);
        downloadStream.on('error', reject);
      });
      
      const tokenData = JSON.parse(Buffer.concat(chunks).toString());
      console.log(`[TOKEN-STORAGE] Token loaded for session: ${sessionId}`);
      return tokenData;
      
    } catch (error) {
      console.error(`[TOKEN-STORAGE] Failed to load token for ${sessionId}:`, error);
      return null;
    }
  }

  async deleteToken(sessionId: string): Promise<void> {
    await this.initialize();
    
    try {
      const files = await this.bucket!.find({ 
        filename: `${sessionId}.token.json` 
      }).toArray();
      
      for (const file of files) {
        await this.bucket!.delete(file._id);
      }
      
      console.log(`[TOKEN-STORAGE] Token deleted for session: ${sessionId}`);
    } catch (error) {
      console.error(`[TOKEN-STORAGE] Failed to delete token for ${sessionId}:`, error);
    }
  }

  async listTokens(): Promise<string[]> {
    await this.initialize();
    
    try {
      const files = await this.bucket!.find({}).toArray();
      return files.map(file => file.filename.replace('.token.json', ''));
    } catch (error) {
      console.error('[TOKEN-STORAGE] Failed to list tokens:', error);
      return [];
    }
  }
}

export const persistentTokenStorage = new PersistentTokenStorage();