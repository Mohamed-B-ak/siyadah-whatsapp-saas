import { logger } from './logger';

interface CacheItem<T> {
  data: T;
  expires: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 300000) { // 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    const expires = Date.now() + ttlMs;
    this.cache.set(key, { data, expires });
    logger.debug(`Cache SET: ${key} (TTL: ${ttlMs}ms)`);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug(`Cache MISS: ${key}`);
      return null;
    }
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      logger.debug(`Cache EXPIRED: ${key}`);
      return null;
    }
    
    logger.debug(`Cache HIT: ${key}`);
    return item.data;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired items`);
    }
  }

  getStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info('Cache destroyed');
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache decorators for common patterns
export function cacheApiKey(apiKey: string, data: any, ttl: number = 900000): void { // 15 minutes
  cache.set(`api_key:${apiKey}`, data, ttl);
}

export function getCachedApiKey(apiKey: string): any | null {
  return cache.get(`api_key:${apiKey}`);
}

export function cacheSession(sessionId: string, data: any, ttl: number = 300000): void { // 5 minutes
  cache.set(`session:${sessionId}`, data, ttl);
}

export function getCachedSession(sessionId: string): any | null {
  return cache.get(`session:${sessionId}`);
}