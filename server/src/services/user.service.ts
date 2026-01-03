import { prisma } from '../lib/prisma.js';
import type { GetUsersQuery, UpdateUserInput, User } from '../schemas/index.js';
import { NotFoundError, ValidationError } from './errors.js';
import { USER_SELECT } from '../lib/constants.js';
import { syncService } from './sync.service.js';

export interface UsersResult {
  verified: User[];
  unverified: User[];
  total: number;
  verifiedCount: number;
  unverifiedCount: number;
}

const getUsers = async (query: GetUsersQuery): Promise<UsersResult> => {
  const { search, limit, emailVerified } = query;

  const effectiveLimit = Math.min(limit ?? 50, 100);
  const filter = emailVerified ?? 'all';

  const searchCondition = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  // Build queries based on filter
  const verifiedQuery =
    filter === 'true' || filter === 'all'
      ? prisma.user.findMany({
          where: { ...searchCondition, emailVerified: true },
          orderBy: { createdAt: 'desc' },
          take: effectiveLimit,
          select: USER_SELECT,
        })
      : Promise.resolve([]);

  const unverifiedQuery =
    filter === 'false' || filter === 'all'
      ? prisma.user.findMany({
          where: { ...searchCondition, emailVerified: false },
          orderBy: { createdAt: 'desc' },
          take: effectiveLimit,
          select: USER_SELECT,
        })
      : Promise.resolve([]);

  // Execute queries in parallel
  const [verifiedUsers, unverifiedUsers] = await Promise.all([verifiedQuery, unverifiedQuery]);

  return {
    verified: verifiedUsers,
    unverified: unverifiedUsers,
    total: verifiedUsers.length + unverifiedUsers.length,
    verifiedCount: verifiedUsers.length,
    unverifiedCount: unverifiedUsers.length,
  };
};

const getUserById = async (id: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw new NotFoundError('User not found');
  return user;
};

// NOTE: User creation is handled by auth.service.syncUser during signUp.
// Direct user creation has been removed to ensure all users have supabaseId.

const updateUser = async (id: string, data: UpdateUserInput): Promise<User> => {
  // Validate that at least one field is being updated
  if (!data.name && !data.email) {
    throw new ValidationError('At least one field must be provided for update');
  }
  await getUserById(id);
  return prisma.user.update({ where: { id }, data, select: USER_SELECT });
};

const deleteUser = async (id: string): Promise<void> => {
  await getUserById(id);
  await prisma.user.delete({ where: { id } });
};

/**
 * Delegates orphan user cleanup to SyncService.
 * Deletes users from RDS that don't exist in Supabase.
 */
const cleanupOrphanUsers = async (): Promise<{ deleted: number }> => {
  const result = await syncService.cleanupOrphanUsers();
  return { deleted: result.deleted };
};

export const userService = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  cleanupOrphanUsers,
};
