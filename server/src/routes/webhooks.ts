import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { syncService } from '../services/sync.service.js';
import { monitoringService } from '../services/monitoring.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { AppError } from '../services/errors.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const webhooksRouter = Router();

/**
 * Supabase Webhook Payload Schema
 * Validates incoming webhook events from Supabase
 */
const supabaseWebhookSchema = z.object({
  type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  table: z.string(),
  schema: z.string(),
  record: z
    .object({
      id: z.string(),
      email: z.string().optional(),
      email_confirmed_at: z.string().nullable().optional(),
    })
    .nullable(),
  old_record: z
    .object({
      id: z.string(),
      email: z.string().optional(),
    })
    .nullable()
    .optional(),
});

type SupabaseWebhookPayload = z.infer<typeof supabaseWebhookSchema>;

/**
 * Verifies the webhook request using a shared secret header.
 * Supabase Database Webhooks don't support HMAC signing, so we use a custom header.
 * SECURITY: Uses timing-safe comparison to prevent timing attacks.
 */
const verifyWebhookSecret = (req: Request): boolean => {
  const providedSecret = req.headers['x-webhook-secret'];
  const expectedSecret = config.supabaseWebhookSecret;

  if (!expectedSecret) {
    logger.warn('Supabase webhook secret not configured');
    return false;
  }

  if (!providedSecret || typeof providedSecret !== 'string') {
    return false;
  }

  // SECURITY: Use timing-safe comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

/**
 * Parses the raw body buffer into JSON.
 * Used after signature verification to get the actual payload.
 */
const parseWebhookBody = <T>(req: Request): T => {
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString('utf-8')) as T;
  }
  return req.body as T;
};

/**
 * POST /api/webhooks/supabase/auth
 *
 * Handles Supabase Auth webhook events:
 * - DELETE: User deleted from Supabase → delete from RDS
 * - UPDATE: User updated (e.g., email verified) → sync to RDS
 */
webhooksRouter.post(
  '/supabase/auth',
  rateLimit, // SECURITY: Rate limit webhooks to prevent DoS
  asyncHandler(async (req: Request, res: Response) => {
    // Verify webhook secret
    if (!verifyWebhookSecret(req)) {
      logger.warn('Invalid webhook secret');
      throw new AppError('Unauthorized', 401);
    }

    // Parse raw body and validate payload
    const rawPayload = parseWebhookBody(req);
    const parseResult = supabaseWebhookSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      logger.error({ errors: parseResult.error.errors }, 'Invalid webhook payload');
      throw new AppError('Invalid payload', 400);
    }

    const payload: SupabaseWebhookPayload = parseResult.data;
    logger.info({ type: payload.type, table: payload.table }, 'Received Supabase webhook');

    // Handle different event types
    switch (payload.type) {
      case 'DELETE': {
        // User deleted from Supabase - delete from RDS
        const supabaseId = payload.old_record?.id ?? payload.record?.id;
        if (supabaseId) {
          const deleted = await syncService.deleteOrphanBySupabaseId(supabaseId);
          logger.info({ supabaseId, deleted }, 'Processed user deletion webhook');
        }
        break;
      }

      case 'UPDATE': {
        // User updated in Supabase - sync to RDS
        const supabaseId = payload.record?.id;
        if (supabaseId) {
          // First verify the user exists in Supabase before syncing
          const verification = await syncService.verifySupabaseUser(supabaseId);
          if (verification?.exists) {
            await syncService.syncSingleUser(supabaseId);
            logger.info(
              { supabaseId, emailVerified: verification.emailVerified },
              'Processed user update webhook',
            );
            // Invalidate monitoring cache since user data changed
            monitoringService.invalidateCache();
          } else {
            logger.warn({ supabaseId }, 'User not found in Supabase during update webhook');
          }
        }
        break;
      }

      case 'INSERT': {
        // New user created - they'll be synced on first sign-in
        logger.info({ supabaseId: payload.record?.id }, 'New user created in Supabase');
        break;
      }
    }

    res.json({ success: true, received: true });
  }),
);

/**
 * POST /api/webhooks/supabase/sync-all
 *
 * Admin endpoint to trigger a full sync of email verification status.
 * Useful for backfilling data after adding the emailVerified field.
 */
webhooksRouter.post(
  '/supabase/sync-all',
  rateLimit, // SECURITY: Rate limit webhooks to prevent DoS
  asyncHandler(async (req: Request, res: Response) => {
    // This endpoint requires the webhook secret
    if (!verifyWebhookSecret(req)) {
      throw new AppError('Unauthorized', 401);
    }

    const result = await syncService.syncEmailVerificationStatus();
    logger.info(result, 'Completed full email verification sync');

    res.json({ success: true, data: result });
  }),
);
