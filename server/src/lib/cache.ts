/**
 * Simple in-memory cache for monitoring data
 * TTL-based expiration, no external dependencies
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
};

export const setCache = <T>(key: string, data: T, ttlSeconds = 60): void => {
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
};

export const clearCache = (key?: string): void => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};
