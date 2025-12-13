// Shared constants

// Cookie names - used by both server and client
export const TOKEN_COOKIE = 'auth_access_token';
export const REFRESH_COOKIE = 'auth_refresh_token';
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';
export const PENDING_EMAIL_COOKIE = 'auth_pending_email';

// CSRF cookie max age (1 hour)
export const CSRF_MAX_AGE_MS = 60 * 60 * 1000;

// Pending email cookie max age (1 hour) - for email pre-fill after confirmation
export const PENDING_EMAIL_MAX_AGE_MS = 60 * 60 * 1000;

// Account lockout settings
export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MINUTES = 15;

export const USER_SELECT = {
  id: true,
  supabaseId: true,
  email: true,
  name: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

// =============================================================================
// Type-safe cookie helpers
// =============================================================================
// Security: Prevents type confusion attacks where cookies could be arrays/objects

/**
 * Safely extracts a string cookie value.
 * Returns undefined if cookie is missing, empty, or not a string.
 */
export const getStringCookie = (
  cookies: Record<string, unknown>,
  name: string,
): string | undefined => {
  const value = cookies[name];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value;
};

/**
 * Safely extracts a string header value.
 * Handles both string and string[] formats from Express.
 */
export const getStringHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined => {
  const value = headers[name.toLowerCase()];
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
};
