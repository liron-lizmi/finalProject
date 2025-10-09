// src/server/services/vendorCacheManager.js
class VendorCacheManager {
  constructor() {
    this.cache = new Map();
    this.cleanupInterval = 30 * 60 * 1000; // 30 minutes
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours 
    this.startCleanup();
  }

  // Generates a unique cache key based on search query, filters, and page number
  generateKey(query, filters, page = 1) {
    const keyData = {
      query: query || '',
      area: filters.area || 'all',
      vendorType: filters.vendorType || 'all',
      specificFilters: filters.specificFilters ? filters.specificFilters.sort().join(',') : '',
      kashrutLevel: filters.kashrutLevel || 'all',
      page: page
    };
    
    return JSON.stringify(keyData);
  }

  // Stores data in cache with TTL, limits to 100 entries and removes oldest if exceeded
  set(key, data) {
    const cacheEntry = {
      data: data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttl
    };
    
    this.cache.set(key, cacheEntry);
    
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
  }

  // Returns cached data if exists and valid, otherwise returns null
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  // Deletes a single entry from cache
  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Removes all cache entries matching the given query and filters (all pages)
  clearFilters(query, filters) {
    const pattern = this.generateKey(query, filters, 1);
    const baseKey = pattern.slice(0, -10); 
    
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(baseKey)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
  }

  // Starts automatic cleanup every 30 minutes to remove expired entries
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
      
    }, this.cleanupInterval);
  }

  // Returns cache statistics
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(e => now <= e.expiresAt).length,
      expiredEntries: entries.filter(e => now > e.expiresAt).length,
      oldestEntry: entries.length > 0 
        ? Math.round((now - Math.min(...entries.map(e => e.timestamp))) / 1000 / 60) 
        : 0,
      ttlHours: this.ttl / (60 * 60 * 1000)
    };
  }
}

const vendorCacheManager = new VendorCacheManager();

module.exports = vendorCacheManager;