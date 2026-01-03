import { config } from '../config/index.js';
import { logger } from './logger.js';

// =============================================================================
// Types
// =============================================================================

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<string>;
  quit(): Promise<void>;
  isConnected: boolean;
}

// =============================================================================
// In-Memory Fallback (for development without Redis)
// =============================================================================

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number }>();
  public isConnected = true;

  async incr(key: string): Promise<number> {
    const existing = this.store.get(key);
    const now = Date.now();

    if (existing && existing.expiresAt > now) {
      const newValue = parseInt(existing.value, 10) + 1;
      existing.value = String(newValue);
      return newValue;
    }

    this.store.set(key, { value: '1', expiresAt: now + 60000 }); // Default 1 min
    return 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const existing = this.store.get(key);
    if (existing) {
      existing.expiresAt = Date.now() + seconds * 1000;
    }
  }

  async get(key: string): Promise<string | null> {
    const existing = this.store.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value;
    }
    this.store.delete(key);
    return null;
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : Date.now() + 3600000;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<void> {
    this.store.clear();
  }
}

// =============================================================================
// Redis Client Wrapper
// =============================================================================

/**
 * IORedis wrapper that implements our RedisLike interface
 */
class IORedisWrapper implements RedisLike {
  private client: import('ioredis').default | null = null;
  public isConnected = false;

  async connect(url: string): Promise<void> {
    // Dynamic import to avoid bundling ioredis if not used
    const Redis = (await import('ioredis')).default;

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 100, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      logger.error({ err }, 'Redis error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    await this.client.connect();
  }

  async incr(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    await this.client.expire(key, seconds);
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.get(key);
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    if (options?.ex) {
      await this.client.set(key, value, 'EX', options.ex);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    await this.client.del(key);
  }

  async ping(): Promise<string> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.ping();
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// =============================================================================
// Singleton Redis Instance
// =============================================================================

let redisInstance: RedisLike | null = null;
let initializationPromise: Promise<RedisLike> | null = null;

/**
 * Gets the Redis client instance.
 * - If REDIS_URL is set: Uses real Redis (ioredis)
 * - Otherwise: Falls back to in-memory implementation
 *
 * Thread-safe: Multiple calls will return the same instance.
 */
export const getRedis = async (): Promise<RedisLike> => {
  if (redisInstance) return redisInstance;

  // Prevent race conditions during initialization
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (config.redisUrl) {
      try {
        const wrapper = new IORedisWrapper();
        await wrapper.connect(config.redisUrl);
        redisInstance = wrapper;
        logger.info('Using Redis for rate limiting');
      } catch (error) {
        logger.warn({ error }, 'Failed to connect to Redis, falling back to in-memory');
        redisInstance = new InMemoryRedis();
      }
    } else {
      logger.info('No REDIS_URL configured, using in-memory rate limiting');
      redisInstance = new InMemoryRedis();
    }
    return redisInstance;
  })();

  return initializationPromise;
};

/**
 * Disconnect Redis client (for graceful shutdown)
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    initializationPromise = null;
    logger.info('Redis disconnected');
  }
};

/**
 * Check Redis health
 */
export const checkRedisHealth = async (): Promise<'operational' | 'degraded' | 'down'> => {
  try {
    const redis = await getRedis();
    if (!redis.isConnected) return 'down';

    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    if (latency > 100) return 'degraded';
    return 'operational';
  } catch {
    return 'down';
  }
};

// =============================================================================
// Rate Limiting Helpers
// =============================================================================

/**
 * Increment a rate limit counter with automatic expiry.
 * Returns the current count after incrementing.
 *
 * @param key - Unique key for the rate limit (e.g., "rl:signin:user@example.com")
 * @param windowSeconds - Time window in seconds
 */
export const incrementRateLimit = async (key: string, windowSeconds: number): Promise<number> => {
  const redis = await getRedis();
  const count = await redis.incr(key);

  // Set expiry only on first increment (when count is 1)
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  return count;
};

/**
 * Reset a rate limit (e.g., for admin unlock)
 */
export const resetRateLimit = async (key: string): Promise<void> => {
  const redis = await getRedis();
  await redis.del(key);
};

// =============================================================================
// Account Lockout Helpers (Atomic Operations)
// =============================================================================

/**
 * Atomically increment and check account lockout counter.
 * SECURITY: Uses atomic Redis operations to prevent TOCTOU race conditions.
 *
 * Returns the current failed attempt count after incrementing.
 * The counter auto-expires after the lockout window.
 *
 * @param email - User email to track
 * @param windowMinutes - Lockout window in minutes
 */
export const incrementLockoutCounter = async (
  email: string,
  windowMinutes: number,
): Promise<number> => {
  const key = `lockout:${email}`;
  const redis = await getRedis();
  const count = await redis.incr(key);

  // Set expiry only on first increment (atomic with incr in real Redis)
  if (count === 1) {
    await redis.expire(key, windowMinutes * 60);
  }

  return count;
};

/**
 * Get current lockout count without incrementing.
 * Used to check if account is locked before attempting auth.
 *
 * @param email - User email to check
 */
export const getLockoutCount = async (email: string): Promise<number> => {
  const key = `lockout:${email}`;
  const redis = await getRedis();
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
};

/**
 * Reset lockout counter (e.g., after successful login or admin unlock)
 *
 * @param email - User email to reset
 */
export const resetLockoutCounter = async (email: string): Promise<void> => {
  const key = `lockout:${email}`;
  const redis = await getRedis();
  await redis.del(key);
};
