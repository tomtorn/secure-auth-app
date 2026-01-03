import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { incrementRateLimit } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { reportSecurityEvent, SecurityEvents } from '../lib/monitoring.js';

/**
 * Rate limiting middleware.
 * Uses Redis in production for distributed rate limiting across instances.
 * Falls back to in-memory store for local development.
 */

// =============================================================================
// In-Memory Fallback (for development or when Redis unavailable)
// =============================================================================

const inMemoryStore = new Map<string, { count: number; reset: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of inMemoryStore) {
    if (v.reset < now) inMemoryStore.delete(k);
  }
}, 5 * 60_000);

const inMemoryRateLimit = (
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; count: number; resetIn: number } => {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || entry.reset < now) {
    inMemoryStore.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, count: 1, resetIn: windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, count: entry.count, resetIn: entry.reset - now };
  }

  return { allowed: true, count: entry.count, resetIn: entry.reset - now };
};

// =============================================================================
// Client IP Extraction
// =============================================================================

const getClientIp = (req: Request): string => {
  // Note: Requires app.set('trust proxy', 1) to work correctly behind reverse proxy
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() ?? 'unknown';
  if (Array.isArray(fwd)) return fwd[0] ?? 'unknown';
  return req.socket.remoteAddress ?? 'unknown';
};

// =============================================================================
// Rate Limit Middleware
// =============================================================================

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

/**
 * Create rate limit middleware with custom options.
 */
const createRateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { windowMs, maxRequests } = options;
    const windowSeconds = Math.ceil(windowMs / 1000);
    const ip = getClientIp(req);
    const key = `rl:${req.path}:${ip}`;

    try {
      if (config.redisUrl) {
        const count = await incrementRateLimit(key, windowSeconds);

        if (count > maxRequests) {
          logger.warn({ ip, path: req.path, count }, 'Rate limit exceeded (Redis)');
          reportSecurityEvent(SecurityEvents.RATE_LIMIT_EXCEEDED, {
            ip,
            path: req.path,
            count,
            reason: 'Redis rate limit exceeded',
          });
          res.setHeader('Retry-After', String(windowSeconds));
          res.setHeader('X-RateLimit-Limit', String(maxRequests));
          res.setHeader('X-RateLimit-Remaining', '0');
          res.status(429).json({
            success: false,
            error: 'Too many requests',
            retryAfter: windowSeconds,
            limit: maxRequests,
            remaining: 0,
          });
          return;
        }

        // Add rate limit headers for successful requests
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));

        next();
        return;
      }
    } catch (error) {
      logger.warn({ error }, 'Redis rate limit failed, using in-memory fallback');
    }

    const result = inMemoryRateLimit(key, windowMs, maxRequests);

    if (!result.allowed) {
      const retryAfter = Math.ceil(result.resetIn / 1000);
      logger.warn({ ip, path: req.path, count: result.count }, 'Rate limit exceeded (in-memory)');
      reportSecurityEvent(SecurityEvents.RATE_LIMIT_EXCEEDED, {
        ip,
        path: req.path,
        count: result.count,
        reason: 'In-memory rate limit exceeded',
      });
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter,
        limit: maxRequests,
        remaining: 0,
      });
      return;
    }

    // Add rate limit headers for successful requests
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - result.count)));

    next();
  };
};

/**
 * Strict rate limit for auth endpoints (5 req/min).
 */
export const rateLimit = createRateLimiter(config.auth.rateLimit);

/**
 * Relaxed rate limit for monitoring endpoints (30 req/min).
 * Monitoring is read-only and less risky, but still needs protection.
 */
export const monitoringRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});
