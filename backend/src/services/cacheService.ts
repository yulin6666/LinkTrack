import redis from '../config/redis';

interface CacheEntry {
  id: number;
  code: string;
  originalUrl: string;
  isActive: boolean;
  expiresAt: string | null;
}

// 哨兵值，表示"已确认不存在"，用于防缓存穿透
const NULL_SENTINEL = '__NULL__';

// LRU 中存储的值类型：真实数据 或 null（表示不存在）
type LRUValue = CacheEntry | null;

class CacheService {
  private lruCache: Map<string, LRUValue>;
  private readonly maxSize: number;
  // 正在回填缓存的 code 集合，用于防缓存击穿
  private readonly pendingFills: Set<string>;

  constructor(maxSize: number = 1000) {
    this.lruCache = new Map();
    this.maxSize = maxSize;
    this.pendingFills = new Set();
  }

  // 返回值说明：
  //   CacheEntry  — 缓存命中，有数据
  //   null        — 缓存命中，确认不存在（空值缓存）
  //   undefined   — 缓存未命中，需要查 DB
  async get(code: string): Promise<CacheEntry | null | undefined> {
    // Level 1: LRU
    if (this.lruCache.has(code)) {
      const entry = this.lruCache.get(code)!;
      this.lruCache.delete(code);
      this.lruCache.set(code, entry);
      return entry; // null 或 CacheEntry，都是命中
    }

    // Level 2: Redis
    const redisKey = `link:${code}`;
    const cached = await redis.get(redisKey);

    if (cached === NULL_SENTINEL) {
      // 命中空值缓存，回填 L1
      this.setLRU(code, null);
      return null;
    }

    if (cached) {
      const entry = JSON.parse(cached) as CacheEntry;
      this.setLRU(code, entry);
      return entry;
    }

    return undefined; // 真正的 miss
  }

  async set(code: string, data: CacheEntry): Promise<void> {
    this.setLRU(code, data);
    const redisKey = `link:${code}`;
    // TTL 加随机抖动（±300s），防止大量 key 同时过期引发击穿
    const ttl = 3600 + Math.floor(Math.random() * 600) - 300;
    try {
      await redis.setex(redisKey, ttl, JSON.stringify(data));
    } catch (err) {
      // Redis 写失败，回滚 L1 保持一致
      this.lruCache.delete(code);
      throw err;
    }
  }

  // 缓存"不存在"结果，防穿透
  async setNull(code: string): Promise<void> {
    this.setLRU(code, null);
    const redisKey = `link:${code}`;
    try {
      await redis.setex(redisKey, 60, NULL_SENTINEL); // 短 TTL 60s
    } catch (err) {
      this.lruCache.delete(code);
    }
  }

  async invalidate(code: string): Promise<void> {
    this.lruCache.delete(code);
    const redisKey = `link:${code}`;
    await redis.del(redisKey);
  }

  // 防缓存击穿：同一个 code 只允许一个请求去查 DB，其余等待
  isPending(code: string): boolean {
    return this.pendingFills.has(code);
  }

  markPending(code: string): void {
    this.pendingFills.add(code);
  }

  unmarkPending(code: string): void {
    this.pendingFills.delete(code);
  }

  private setLRU(code: string, data: LRUValue): void {
    if (this.lruCache.size >= this.maxSize) {
      const firstKey = this.lruCache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        this.lruCache.delete(firstKey);
      }
    }
    this.lruCache.set(code, data);
  }
}

export { CacheEntry };
export default new CacheService(
  parseInt(process.env.LRU_CACHE_SIZE || '1000', 10)
);
