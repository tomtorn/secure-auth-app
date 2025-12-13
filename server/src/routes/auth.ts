import { Router } from 'express';
import type { Request, Response } from 'express';
import { signInSchema, signUpSchema, exchangeTokenSchema } from '../schemas/index.js';
import { authService } from '../services/auth.service.js';
import { authEventService } from '../services/authEvent.service.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateCsrf, setCsrfToken } from '../middleware/csrf.js';
import { config } from '../config/index.js';
import {
  TOKEN_COOKIE,
  REFRESH_COOKIE,
  PENDING_EMAIL_COOKIE,
  PENDING_EMAIL_MAX_AGE_MS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_WINDOW_MINUTES,
  getStringCookie,
} from '../lib/constants.js';
import { logger } from '../lib/logger.js';

export const authRouter = Router();

/** Cookie options type for auth cookies */
interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge?: number;
}

// Cookie options used for both setting and clearing (Fix 1.3)
// Cross-origin (Amplify frontend → CloudFront → backend) requires sameSite: 'none'
// When sameSite is 'none', secure must be true
const getCookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
  ...(maxAge !== undefined && { maxAge }),
});

const setCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null,
): void => {
  const maxAge = expiresIn ?? config.auth.session.cookieMaxAge;

  res.cookie(TOKEN_COOKIE, accessToken, getCookieOptions(maxAge * 1000));
  if (refreshToken) {
    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      getCookieOptions(config.auth.session.refreshMaxAge * 1000),
    );
  }
};

// Fix 1.3: Use identical options for clearCookie
const clearCookies = (res: Response): void => {
  const opts = getCookieOptions();
  res.clearCookie(TOKEN_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
};

// Apply CSRF validation to state-changing auth routes
authRouter.post(
  '/signup',
  rateLimit,
  validateCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const body = signUpSchema.parse(req.body);
    const result = await authService.signUp(body);

    // Log signup event (fire-and-forget)
    void authEventService.log({
      email: body.email,
      eventType: 'SIGN_UP',
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent'),
    });

    if (result.emailConfirmationRequired) {
      // Set pending email cookie for pre-fill after confirmation
      res.cookie(PENDING_EMAIL_COOKIE, body.email, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: PENDING_EMAIL_MAX_AGE_MS,
      });

      res.status(201).json({
        success: true,
        data: null,
        emailConfirmationRequired: true,
        message: result.message,
      });
      return;
    }

    // Full session available - set cookies and return user
    const { session } = result;
    setCookies(res, session.accessToken, session.refreshToken, session.expiresIn);
    res.status(201).json({ success: true, data: session.user });
  }),
);

authRouter.post(
  '/signin',
  rateLimit,
  validateCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const body = signInSchema.parse(req.body);

    // Security: Account lockout after too many failed attempts
    const lockoutWindowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);
    const failedAttempts = await authEventService.getFailedAttempts(body.email, lockoutWindowStart);

    if (failedAttempts >= LOCKOUT_MAX_ATTEMPTS) {
      logger.warn(
        { email: body.email, failedAttempts, ip: req.ip ?? 'unknown' },
        'Account locked due to too many failed attempts',
      );
      res.status(429).json({
        success: false,
        error: `Account temporarily locked. Please try again in ${LOCKOUT_WINDOW_MINUTES} minutes.`,
      });
      return;
    }

    try {
      const session = await authService.signIn(body);

      // Log successful sign-in (fire-and-forget)
      void authEventService.log({
        email: body.email,
        eventType: 'SIGN_IN',
        userId: session.user.id,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent'),
      });

      setCookies(res, session.accessToken, session.refreshToken, session.expiresIn);
      res.json({ success: true, data: session.user });
    } catch (error) {
      // Log failed sign-in attempt (fire-and-forget)
      void authEventService.log({
        email: body.email,
        eventType: 'SIGN_IN_FAILED',
        success: false,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent'),
      });
      throw error;
    }
  }),
);

authRouter.post(
  '/signout',
  validateCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const token = getStringCookie(req.cookies, TOKEN_COOKIE);

    // Invalidate Supabase session if token exists
    if (token) {
      await authService.signOutUser(token);
    }

    clearCookies(res);
    res.json({ success: true, data: null });
  }),
);

// GET /me is a safe endpoint - sets CSRF token for subsequent mutations
authRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const token = getStringCookie(req.cookies, TOKEN_COOKIE);

    // Always set CSRF token on this safe GET endpoint
    setCsrfToken(res);

    if (!token) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await authService.getUserFromToken(token);

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    res.json({ success: true, data: user });
  }),
);

// Token exchange endpoint for auto-login after email confirmation
// The access_token from Supabase email confirmation can be used directly
authRouter.post(
  '/exchange-token',
  validateCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const body = exchangeTokenSchema.parse(req.body);

    // Validate the token and get user info
    const user = await authService.getUserFromToken(body.accessToken);

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    // Set auth cookies
    setCookies(res, body.accessToken, body.refreshToken ?? null, config.auth.session.cookieMaxAge);
    res.json({ success: true, data: user });
  }),
);

// Dedicated endpoint to get CSRF token (for unauthenticated pages like login/signup)
// Returns token in body for cross-origin scenarios where JS can't read cookies from other domains
authRouter.get('/csrf', (_req: Request, res: Response) => {
  const token = setCsrfToken(res);
  res.json({ success: true, data: { csrfToken: token } });
});

/**
 * GET /pending-email - Retrieve and clear pending email for pre-fill after confirmation
 *
 * This endpoint:
 * 1. Reads the pending_email HttpOnly cookie (set during signup)
 * 2. Returns the email to the client
 * 3. Clears the cookie (one-time use)
 *
 * Security:
 * - Cookie is HttpOnly (not accessible via JS directly)
 * - Cookie is cleared after reading (one-time use)
 * - No sensitive data exposed (just email, which user already knows)
 */
authRouter.get('/pending-email', (req: Request, res: Response) => {
  const pendingEmail = getStringCookie(req.cookies, PENDING_EMAIL_COOKIE);

  // Clear the cookie regardless of whether it exists
  res.clearCookie(PENDING_EMAIL_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  if (pendingEmail) {
    res.json({ success: true, data: { email: pendingEmail } });
  } else {
    res.json({ success: true, data: { email: null } });
  }
});
