import { Router } from 'express';
import type { Response } from 'express';
import { getUsersQuerySchema, idParamSchema, updateUserSchema } from '../schemas/index.js';
import { userService } from '../services/user.service.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorizeSelfOrRole, authorizeRole } from '../middleware/authorization.js';
import { validateCsrf } from '../middleware/csrf.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { resetRateLimit } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export const usersRouter = Router();

// All user routes require authentication
usersRouter.use(requireAuth);

// Note: CSRF validation is applied only to state-changing routes (PATCH, DELETE)
// GET requests are safe methods and don't require CSRF protection

usersRouter.get(
  '/',
  asyncHandler(async (req, res: Response) => {
    const query = getUsersQuerySchema.parse(req.query);
    const data = await userService.getUsers(query);
    res.json({ success: true, data });
  }),
);

// Admin-only: Cleanup orphan users (users in RDS that don't exist in Supabase)
// IMPORTANT: Must be before /:id to avoid matching "cleanup-orphans" as an ID
// SECURITY: Uses authorizeRole (not authorizeSelfOrRole) to prevent self-access
usersRouter.post(
  '/cleanup-orphans',
  rateLimit,
  validateCsrf,
  authorizeRole('admin'),
  asyncHandler(async (_req, res: Response) => {
    const result = await userService.cleanupOrphanUsers();
    res.json({ success: true, data: result });
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const user = await userService.getUserById(id);
    res.json({ success: true, data: user });
  }),
);

// NOTE: User creation is only allowed via auth flow (signUp).
// Direct user creation endpoint has been removed for security.

// IDOR Protection: Only allow self-modification or admin role
usersRouter.patch(
  '/:id',
  validateCsrf,
  authorizeSelfOrRole('admin'),
  asyncHandler(async (req, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(id, body);
    res.json({ success: true, data: user });
  }),
);

// IDOR Protection: Only allow self-deletion or admin role
usersRouter.delete(
  '/:id',
  validateCsrf,
  authorizeSelfOrRole('admin'),
  asyncHandler(async (req, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    await userService.deleteUser(id);
    res.status(204).send();
  }),
);

// Admin-only: Unlock a rate-limited user (reset their rate limit counter)
// SECURITY: Uses authorizeRole (not authorizeSelfOrRole) to prevent users from unlocking themselves
usersRouter.post(
  '/:id/unlock',
  rateLimit,
  validateCsrf,
  authorizeRole('admin'),
  asyncHandler(async (req, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const user = await userService.getUserById(id);

    // Reset rate limit keys for this user's email
    const rateLimitKeys = [
      `rl:/api/auth/signin:${user.email}`,
      `rl:/api/auth/signup:${user.email}`,
      `lockout:${user.email}`,
    ];

    await Promise.all(rateLimitKeys.map((key) => resetRateLimit(key)));
    logger.info({ userId: id, email: user.email }, 'Admin unlocked user rate limits');

    res.json({ success: true, data: { message: 'User rate limits reset successfully' } });
  }),
);
