/**
 * CacheManager.js - In-Memory Cache Service for Venues
 *
 * Provides in-memory caching for Google Places API venue search results.
 * Uses a Map-based cache with TTL (Time To Live) and automatic cleanup.
 *
 * Configuration:
 * - TTL: 24 hours - cached results expire after this time
 * - Cleanup interval: 1 hour - periodic removal of expired entries
 *
 * Methods:
 * - generateKey(query, filters, page): Creates unique cache key from search params
 * - set(key, data): Stores data with timestamp and expiration
 * - get(key): Retrieves data if valid, returns null if expired/missing
 * - delete(key): Removes single entry
 * - clear(): Removes all entries
 * - getStats(): Returns cache statistics (total, valid, expired entries)
 *
 * Usage: Singleton instance exported for venue search caching
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    
    this.cleanupInterval = 60 * 60 * 1000; // 1 hour
    
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours
    
    this.startCleanup();
  }

  generateKey(query, filters, page = 1) {
    const keyData = {
      query: query || '',
      area: filters.area || 'all',
      venueType: filters.venueType || 'all',
      venueStyle: filters.venueStyle || 'all',
      capacity: filters.capacity || '',
      page: page
    };
    
    return JSON.stringify(keyData);
  }

  set(key, data) {
    const cacheEntry = {
      data: data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttl
    };
    
    this.cache.set(key, cacheEntry);
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    const age = Math.round((Date.now() - entry.timestamp) / 1000 / 60); // minutes
    return entry.data;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
  }

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      let deletedCount = 0;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
      }
    }, this.cleanupInterval);
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(e => now <= e.expiresAt).length,
      expiredEntries: entries.filter(e => now > e.expiresAt).length,
      oldestEntry: entries.length > 0 
        ? Math.round((now - Math.min(...entries.map(e => e.timestamp))) / 1000 / 60) 
        : 0, // minutes
      ttlHours: this.ttl / (60 * 60 * 1000)
    };
  }
}

const cacheManager = new CacheManager();

module.exports = cacheManager;