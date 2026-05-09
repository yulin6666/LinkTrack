import redis from '../config/redis';

class RateLimitService {
  /**
   * Check rate limit using sliding window
   * @param key - Redis key for the rate limit
   * @param limit - Maximum number of requests
   * @param windowSeconds - Time window in seconds
   * @returns true if allowed, false if rate limited
   */
  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      // Remove old entries outside the window
      await redis.zremrangebyscore(key, 0, windowStart);

      // Count requests in current window
      const count = await redis.zcard(key);

      if (count >= limit) {
        return false;
      }

      // Add current request
      await redis.zadd(key, now, `${now}`);

      // Set expiry on the key
      await redis.expire(key, windowSeconds);

      return true;
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if Redis is down
      return true;
    }
  }

  /**
   * Simple counter-based rate limit
   * @param key - Redis key
   * @param limit - Maximum count
   * @param ttlSeconds - TTL in seconds
   */
  async checkSimpleLimit(key: string, limit: number, ttlSeconds: number): Promise<boolean> {
    try {
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }

      return count <= limit;
    } catch (error) {
      console.error('Simple rate limit check error:', error);
      return true;
    }
  }
}

export default new RateLimitService();
