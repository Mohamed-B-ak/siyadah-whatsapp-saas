// MongoDB-only storage implementation
import { 
  type Company,
  type User,
  type Session,
  type Message,
  type InsertCompany,
  type InsertUser,
  type InsertSession,
  type InsertMessage,
  type ApiUsageLog,
  type ErrorLog
} from '../shared/schema';
import { logger } from './utils/logger';

export interface IStorage {
  // Company operations
  getCompanyByEmail(email: string): Promise<Company | null>;
  getCompanyByApiKey(apiKey: string): Promise<Company | null>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<Company>): Promise<Company | null>;
  
  // User operations
  getUserByApiKey(apiKey: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
  
  // Session operations
  getSessionsByUser(userId: string): Promise<Session[]>;
  getSessionsByCompany(companyId: string): Promise<Session[]>;
  getUserSessions(userId: string): Promise<Session[]>;
  getCompanySessions(companyId: string): Promise<Session[]>;
  getSessionByName(sessionName: string): Promise<Session | null>;
  createSession(data: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<Session>): Promise<Session | null>;
  updateSessionQRCode(sessionId: string, qrCode: string): Promise<Session | null>;
  deleteSession(id: string): Promise<boolean>;
  
  // Analytics operations
  getAllCompanies(): Promise<Company[]>;
  getAllUsers(): Promise<User[]>;
  getAllSessions(): Promise<Session[]>;
  getMessageHistory(sessionId: string, limit?: number): Promise<Message[]>;
  getMessagesBySession(sessionId: string, limit?: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  logApiUsage(log: Omit<ApiUsageLog, 'id' | 'timestamp'>): Promise<void>;
  logError(log: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// Export factory for storage selection (MongoDB only)
export { StorageFactory } from './storage-factory';
import { MongoStorage } from './mongodb';

// MongoDB is now the primary storage
export const storage = new MongoStorage();