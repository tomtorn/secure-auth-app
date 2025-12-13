/**
 * Shared constants for client-side code.
 * Cookie/header names MUST match server values in server/src/lib/constants.ts
 */

// Auth cookie names
export const TOKEN_COOKIE = 'auth_access_token';
export const REFRESH_COOKIE = 'auth_refresh_token';

// CSRF cookie/header names
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';

// Query keys for React Query
export const AUTH_QUERY_KEY = ['auth', 'currentUser'] as const;
export const USERS_QUERY_KEY = ['users'] as const;

// Type exports for query keys
export type AuthQueryKey = typeof AUTH_QUERY_KEY;
export type UsersQueryKey = typeof USERS_QUERY_KEY;
