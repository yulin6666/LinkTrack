import redis from '../config/redis';

interface CacheEntry {
  id: number;
  code: string;
  originalUrl: string;
  isActive: boolean;
  expiresAt: string | null;
}

class CacheService {
  private lruCache: Map<string, CacheEntry>;
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.lruCache = new Map();
    this.maxSize = maxSize;
  }

  async get(code: string): Promise<CacheEntry | null> {
    // Level 1: Check LRU cache
    if (this.lruCache.has(code)) {
      const entry = this.lruCache.get(code)!;
      // Move to end (most recently used)
      this.lruCache.delete(code);
      this.lruCache.set(code, entry);
      return entry;
    }

    // Level 2: Check Redis
    const redisKey = `link:${code}`;
    const cached = await redis.get(redisKey);

    if (cached) {
      const entry = JSON.parse(cached) as CacheEntry;
      this.setLRU(code, entry);
      return entry;
    }

    return null;
  }

  async set(code: string, data: CacheEntry): Promise<void> {
    // Write to both caches
    this.setLRU(code, data);

    const redisKey = `link:${code}`;
    await redis.setex(redisKey, 3600, JSON.stringify(data)); // 1 hour TTL
  }

  async invalidate(code: string): Promise<void> {
    this.lruCache.delete(code);
    const redisKey = `link:${code}`;
    await redis.del(redisKey);
  }

  private setLRU(code: string, data: CacheEntry): void {
    // If at capacity, remove oldest entry
    if (this.lruCache.size >= this.maxSize) {
      const firstKey = this.lruCache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        this.lruCache.delete(firstKey);
      }
    }

    this.lruCache.set(code, data);
  }
}

export default new CacheService(
  parseInt(process.env.LRU_CACHE_SIZE || '1000', 10)
);
