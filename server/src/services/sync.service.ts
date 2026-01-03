import { prisma } from '../lib/prisma.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { USER_SELECT } from '../lib/constants.js';
import type { User } from '../schemas/index.js';

export interface CleanupResult {
  deleted: number;
  processed: number;
}

export interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
}

/**
 * Deletes a single orphan user from RDS by their Supabase ID.
 * Called when Supabase triggers a user deletion event.
 */
const deleteOrphanBySupabaseId = async (supabaseId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, email: true },
  });

  if (!user) {
    logger.info({ supabaseId }, 'No orphan user found for supabaseId');
    return false;
  }

  await prisma.user.delete({ where: { supabaseId } });
  logger.info({ supabaseId, email: user.email }, 'Deleted orphan user');
  return true;
};

/**
 * Scans all RDS users and removes those that don't exist in Supabase.
 * Uses batched API calls to avoid rate limiting.
 */
const cleanupOrphanUsers = async (): Promise<CleanupResult> => {
  const rdsUsers = await prisma.user.findMany({
    select: { id: true, supabaseId: true, email: true },
  });

  if (rdsUsers.length === 0) {
    return { deleted: 0, processed: 0 };
  }

  const orphanIds: string[] = [];

  // Process in batches of 10 to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < rdsUsers.length; i += batchSize) {
    const batch = rdsUsers.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (user) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.supabaseId);
        if (error || !data.user) {
          logger.info({ email: user.email, supabaseId: user.supabaseId }, 'Found orphan user');
          return user.id;
        }
        return null;
      }),
    );

    orphanIds.push(...results.filter((id): id is string => id !== null));
  }

  if (orphanIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: orphanIds } },
    });
    logger.info({ count: orphanIds.length }, 'Deleted orphan users');
  }

  return { deleted: orphanIds.length, processed: rdsUsers.length };
};

/**
 * Syncs email verification status for all users from Supabase to RDS.
 * Useful for backfilling emailVerified for existing users.
 */
const syncEmailVerificationStatus = async (): Promise<SyncResult> => {
  const rdsUsers = await prisma.user.findMany({
    select: { id: true, supabaseId: true, emailVerified: true },
  });

  if (rdsUsers.length === 0) {
    return { synced: rdsUsers.length, updated: 0, errors: 0 };
  }

  let updated = 0;
  let errors = 0;

  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < rdsUsers.length; i += batchSize) {
    const batch = rdsUsers.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (user) => {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.supabaseId);

          if (error || !data.user) {
            errors++;
            return;
          }

          const supabaseVerified = !!data.user.email_confirmed_at;

          if (user.emailVerified !== supabaseVerified) {
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: supabaseVerified },
            });
            updated++;
            logger.info(
              { supabaseId: user.supabaseId, emailVerified: supabaseVerified },
              'Updated email verification status',
            );
          }
        } catch (err) {
          errors++;
          logger.error({ error: err, supabaseId: user.supabaseId }, 'Failed to sync user');
        }
      }),
    );
  }

  return { synced: rdsUsers.length, updated, errors };
};

/**
 * Gets a single user from Supabase by ID for verification.
 */
const verifySupabaseUser = async (
  supabaseId: string,
): Promise<{ exists: boolean; emailVerified: boolean } | null> => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(supabaseId);

  if (error || !data.user) {
    return null;
  }

  return {
    exists: true,
    emailVerified: !!data.user.email_confirmed_at,
  };
};

/**
 * Syncs a single user's data from Supabase to RDS.
 * Updates email verification status and other metadata.
 */
const syncSingleUser = async (supabaseId: string): Promise<User | null> => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(supabaseId);

  if (error || !data.user) {
    logger.warn({ supabaseId }, 'User not found in Supabase');
    return null;
  }

  const supabaseUser = data.user;
  const emailVerified = !!supabaseUser.email_confirmed_at;

  const updatedUser = await prisma.user.update({
    where: { supabaseId },
    data: {
      email: supabaseUser.email,
      emailVerified,
      name: (supabaseUser.user_metadata?.name as string) ?? null,
    },
    select: USER_SELECT,
  });

  logger.info({ supabaseId, emailVerified }, 'Synced user from Supabase');
  return updatedUser;
};

export const syncService = {
  deleteOrphanBySupabaseId,
  cleanupOrphanUsers,
  syncEmailVerificationStatus,
  verifySupabaseUser,
  syncSingleUser,
};
