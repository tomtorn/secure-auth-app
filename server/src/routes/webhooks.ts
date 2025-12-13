import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { syncService } from '../services/sync.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { AppError } from '../services/errors.js';

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
 * Verifies the webhook signature from Supabase.
 * Uses a shared secret configured in both Supabase and our server.
 */
const verifyWebhookSignature = (req: Request): boolean => {
  const signature = req.headers['x-supabase-webhook-signature'];
  const webhookSecret = config.supabaseWebhookSecret;

  if (!webhookSecret) {
    logger.warn('Supabase webhook secret not configured');
    return false;
  }

  if (!signature || typeof signature !== 'string') {
    return false;
  }

  // Simple signature verification (in production, use HMAC)
  return signature === webhookSecret;
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
  asyncHandler(async (req: Request, res: Response) => {
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      logger.warn({ headers: req.headers }, 'Invalid webhook signature');
      throw new AppError('Unauthorized', 401);
    }

    // Validate payload
    const parseResult = supabaseWebhookSchema.safeParse(req.body);
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
          await syncService.syncSingleUser(supabaseId);
          logger.info({ supabaseId }, 'Processed user update webhook');
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
  asyncHandler(async (req: Request, res: Response) => {
    // This endpoint requires the webhook secret as a simple auth mechanism
    if (!verifyWebhookSignature(req)) {
      throw new AppError('Unauthorized', 401);
    }

    const result = await syncService.syncEmailVerificationStatus();
    logger.info(result, 'Completed full email verification sync');

    res.json({ success: true, data: result });
  }),
);
