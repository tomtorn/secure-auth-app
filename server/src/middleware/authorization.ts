import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { logger } from '../lib/logger.js';

/**
 * Middleware factory that authorizes if the authenticated user is either:
 * 1. The resource owner (req.user.id === req.params.id), OR
 * 2. Has the specified role (future-proofing for RBAC)
 *
 * Currently, role check is a placeholder since User model has no 'role' field.
 * Returns 403 Forbidden if neither condition is met.
 */
export const authorizeSelfOrRole = (_allowedRole?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const targetId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Check if user is modifying their own resource
    if (userId === targetId) {
      next();
      return;
    }

    // Future: Check if user has the allowed role
    // Currently User model has no 'role' field, so this is a placeholder
    // When role is added to User, uncomment:
    // const userRole = (authReq.user as { role?: string }).role;
    // if (allowedRole && userRole === allowedRole) {
    //   next();
    //   return;
    // }

    // Log unauthorized attempt for security monitoring (structured logging)
    logger.warn(
      {
        event: 'unauthorized_access_attempt',
        userId,
        targetId,
        path: req.path,
        method: req.method,
      },
      'User attempted to access resource without permission',
    );

    res.status(403).json({
      success: false,
      error: 'Forbidden: You can only modify your own resources',
    });
  };
};
