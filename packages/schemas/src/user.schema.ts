import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  supabaseId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Schema for validating resource ID path parameters.
 * Accepts cuid (Prisma default) format.
 */
export const idParamSchema = z.object({
  id: z
    .string()
    .min(1, 'ID is required')
    .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format'),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

export const getUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  emailVerified: z.enum(['true', 'false', 'all']).optional().default('all'),
});

export type User = z.infer<typeof userSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
