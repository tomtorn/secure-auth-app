/**
 * Auth Event Service
 * Logs authentication events for monitoring and auditing
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { AuthEventType } from '@prisma/client';

interface LogEventParams {
  email: string;
  eventType: AuthEventType;
  userId?: string;
  success?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export const authEventService = {
  /**
   * Log an authentication event
   * Fire-and-forget - doesn't block the auth flow
   */
  log: async (params: LogEventParams): Promise<void> => {
    try {
      await prisma.authEvent.create({
        data: {
          email: params.email,
          eventType: params.eventType,
          userId: params.userId,
          success: params.success ?? true,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Log but don't throw - event logging should never break auth flow
      logger.error({ err: error, params }, 'Failed to log auth event');
    }
  },

  /**
   * Get counts for monitoring dashboard
   */
  getCounts: async (
    since: Date,
  ): Promise<{
    signIns: number;
    signUps: number;
    signInsFailed: number;
  }> => {
    const [signIns, signUps, signInsFailed] = await Promise.all([
      prisma.authEvent.count({
        where: {
          eventType: 'SIGN_IN',
          success: true,
          createdAt: { gte: since },
        },
      }),
      prisma.authEvent.count({
        where: {
          eventType: 'SIGN_UP',
          success: true,
          createdAt: { gte: since },
        },
      }),
      prisma.authEvent.count({
        where: {
          eventType: 'SIGN_IN_FAILED',
          createdAt: { gte: since },
        },
      }),
    ]);

    return { signIns, signUps, signInsFailed };
  },

  /**
   * Get failed login attempts for a specific email within a time window
   * Used for account lockout protection
   *
   * Security: This enables brute-force protection by tracking failed attempts
   * per account (not just per IP like rate limiting does)
   *
   * NOTE: For production scale, consider moving to Redis for:
   * - Sub-millisecond lookups (vs ~10ms DB query)
   * - Distributed consistency across multiple ECS tasks
   * - Auto-expiring keys (no cleanup needed)
   *
   * Redis implementation example:
   * ```typescript
   * const key = `lockout:${email}`;
   * const attempts = await redis.incr(key);
   * if (attempts === 1) await redis.expire(key, windowMinutes * 60);
   * return attempts;
   * ```
   */
  getFailedAttempts: async (email: string, since: Date): Promise<number> => {
    try {
      return await prisma.authEvent.count({
        where: {
          email,
          eventType: 'SIGN_IN_FAILED',
          createdAt: { gte: since },
        },
      });
    } catch (error) {
      // Log but don't throw - fail open to prevent DoS via DB issues
      logger.error({ err: error, email }, 'Failed to check lockout status');
      return 0;
    }
  },
};
