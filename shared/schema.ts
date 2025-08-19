// MongoDB-only schema definitions
// Note: PostgreSQL schemas removed - MongoDB handles data structure natively

// TypeScript interfaces for MongoDB documents
export interface Company {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  masterApiKey: string;
  messagingApiKey?: string;
  planType: string;
  maxUsers: number;
  maxSessions: number;
  webhookUrl?: string;
  webhookToken?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  role: string;
  apiKey: string;
  passwordHash?: string;
  permissions: string[] | Record<string, any>;
  webhookUrl?: string;
  webhookToken?: string;
  status: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  sessionName: string;
  userId: string;
  companyId: string;
  status: string;
  phoneNumber?: string;
  qrCode?: string;
  qrCodeGeneratedAt?: Date;
  lastActivity?: Date;
  connectedAt?: Date;
  createdAt: Date;
}

// Messages table
export interface Message {
  id: string;
  sessionId: string;
  userId: string;
  companyId: string;
  phone: string;
  message: string;
  direction: string; // 'outbound' or 'inbound'
  status: string;
  messageId?: string;
  timestamp: Date;
}

export interface ApiUsageLog {
  id: string;
  companyId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime?: number; // in milliseconds
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ErrorLog {
  id: string;
  companyId?: string;
  userId?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  method?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// Message Queue System Interfaces
export interface MessageTask {
  id: string;
  phone: string;
  message: string;
  options: any;
  scheduledFor: Date;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
  errorMessage?: string;
}

export interface SessionMessageQueue {
  id: string;
  sessionId: string;
  sessionName: string;
  companyId: string;
  userId: string;
  lastMessageTime?: Date;
  queuedMessages: MessageTask[];
  isProcessing: boolean;
  totalProcessed: number;
  totalFailed: number;
  createdAt: Date;
  updatedAt: Date;
}

// MongoDB insert types (omit auto-generated fields)
export type InsertCompany = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertSession = Omit<Session, 'id' | 'createdAt'>;
export type InsertMessage = Omit<Message, 'id' | 'timestamp'>;
export type InsertApiUsageLog = Omit<ApiUsageLog, 'id' | 'timestamp'>;
export type InsertErrorLog = Omit<ErrorLog, 'id' | 'timestamp'>;
export type InsertMessageTask = Omit<MessageTask, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertSessionMessageQueue = Omit<SessionMessageQueue, 'id' | 'createdAt' | 'updatedAt'>;

// MongoDB update types
export type UpdateCompany = Partial<Omit<Company, 'id' | 'createdAt'>>;
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt'>>;
export type UpdateSession = Partial<Omit<Session, 'id' | 'createdAt'>>;

// Replication compatibility type (legacy)
export type UpsertUser = InsertUser;