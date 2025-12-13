import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { logger } from '../lib/logger.js';
import type { User } from '../schemas/index.js';
import { TOKEN_COOKIE } from '../lib/constants.js';

export interface AuthRequest extends Request {
  user: User;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token =
    typeof req.cookies[TOKEN_COOKIE] === 'string' ? req.cookies[TOKEN_COOKIE] : undefined;

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const user = await authService.getUserFromToken(token);

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware: token validation failed');
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};
