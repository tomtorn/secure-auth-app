import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  CSRF_MAX_AGE_MS,
  getStringCookie,
  getStringHeader,
} from '../lib/constants.js';
import { config } from '../config/index.js';

// Re-export for convenience
export { CSRF_COOKIE, CSRF_HEADER };

// Token expiry time in milliseconds (1 hour)
const CSRF_TOKEN_EXPIRY_MS = CSRF_MAX_AGE_MS;

/**
 * Generates a cryptographically secure, signed CSRF token.
 *
 * Security: The token is signed with HMAC-SHA256 using a server secret.
 * This allows validation without relying on cookies (which may be blocked
 * in cross-origin scenarios).
 *
 * Format: timestamp.signature
 * - timestamp: Unix timestamp when token was created
 * - signature: HMAC-SHA256(timestamp, CSRF_SECRET)
 */
export const generateCsrfToken = (): string => {
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac('sha256', config.csrfSecret).update(timestamp).digest('hex');
  return `${timestamp}.${signature}`;
};

/**
 * Verifies a signed CSRF token.
 * Returns true if:
 * 1. Token format is valid (timestamp.signature)
 * 2. Token is not expired (within CSRF_TOKEN_EXPIRY_MS)
 * 3. Signature is valid (matches HMAC of timestamp)
 */
const verifySignedToken = (token: string): boolean => {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  if (!timestamp || !signature) return false;

  // Check token age
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > CSRF_TOKEN_EXPIRY_MS) {
    return false;
  }

  // Verify signature using constant-time comparison
  const expectedSignature = crypto
    .createHmac('sha256', config.csrfSecret)
    .update(timestamp)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

/**
 * Sets the CSRF token as a non-httpOnly cookie so the client can read it.
 * Call this on safe GET endpoints (e.g., /api/auth/me).
 */
export const setCsrfToken = (res: Response): string => {
  const token = generateCsrfToken();
  // Cross-origin (Amplify frontend → CloudFront → backend) requires sameSite: 'none'
  // When sameSite is 'none', secure must be true
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // Client must read this
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: CSRF_MAX_AGE_MS, // 1 hour - defense in depth
  });
  return token;
};

/**
 * Middleware that validates CSRF token for state-changing requests.
 *
 * Security Strategy (defense in depth):
 * 1. If cookie is present: Use double-submit pattern (header must match cookie)
 * 2. If cookie is blocked (cross-origin): Verify signed token in header
 *
 * This ensures CSRF protection works in all scenarios:
 * - Same-origin: Traditional double-submit cookie
 * - Cross-origin with cookies: Double-submit still works
 * - Cross-origin without cookies: Signed token verification
 */
export const validateCsrf = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  const cookieToken = getStringCookie(req.cookies, CSRF_COOKIE);
  const headerToken = getStringHeader(req.headers, CSRF_HEADER);

  // Header is REQUIRED: without it we always reject
  if (!headerToken) {
    res.status(403).json({
      success: false,
      error: 'CSRF token missing',
    });
    return;
  }

  // STRATEGY 1: If cookie is present, use double-submit pattern
  if (cookieToken) {
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    if (
      cookieBuffer.length !== headerBuffer.length ||
      !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      res.status(403).json({
        success: false,
        error: 'CSRF token mismatch',
      });
      return;
    }
    // Double-submit verified, proceed
    next();
    return;
  }

  // STRATEGY 2: No cookie (cross-origin blocked), verify signed token
  if (!verifySignedToken(headerToken)) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired CSRF token',
    });
    return;
  }

  next();
};
