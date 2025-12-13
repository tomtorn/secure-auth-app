import { Router } from 'express';
import type { Response } from 'express';
import { getUsersQuerySchema, idParamSchema, updateUserSchema } from '../schemas/index.js';
import { userService } from '../services/user.service.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authorizeSelfOrRole } from '../middleware/authorization.js';
import { validateCsrf } from '../middleware/csrf.js';
import { rateLimit } from '../middleware/rateLimit.js';

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
usersRouter.post(
  '/cleanup-orphans',
  rateLimit,
  validateCsrf,
  authorizeSelfOrRole('admin'),
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
