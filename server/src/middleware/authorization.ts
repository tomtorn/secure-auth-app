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

/**
 * Middleware that only allows users with a specific role.
 * Does NOT allow self-access (unlike authorizeSelfOrRole).
 *
 * SECURITY: Use this for admin-only endpoints where self-access would be a vulnerability
 * (e.g., unlocking your own locked account).
 *
 * Currently blocks all access since User model has no 'role' field.
 * When RBAC is implemented, this will check the user's role.
 */
export const authorizeRole = (requiredRole: string) => {
  return (req: Request, res: Response, _next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // TODO: Implement when role field is added to User model
    // const userRole = (user as { role?: string }).role;
    // if (userRole === requiredRole) {
    //   next();
    //   return;
    // }

    // SECURITY: Block all access until RBAC is implemented
    // This prevents privilege escalation vulnerabilities
    logger.warn(
      {
        event: 'admin_endpoint_blocked',
        userId: user.id,
        requiredRole,
        path: req.path,
        method: req.method,
      },
      'Admin endpoint accessed but RBAC not yet implemented',
    );

    res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access requires role-based authorization (not yet implemented)',
    });
  };
};
