import type { User, SignInInput, SignUpInput } from './schemas';
import { CSRF_COOKIE, CSRF_HEADER } from './constants';

// =============================================================================
// Types
// =============================================================================

export interface ApiResponse<T> {
  data: T;
  success: true;
}

export interface ApiErrorResponse {
  error: string;
  success: false;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface FetcherOptions extends Omit<RequestInit, 'signal'> {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// =============================================================================
// Configuration
// =============================================================================

const API_URL = import.meta.env.VITE_API_URL || '';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for a specified duration.
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determines if an HTTP status code is retryable.
 * Retries on server errors (5xx) and rate limiting (429).
 */
const isRetryableStatus = (status: number): boolean => status >= 500 || status === 429;

/**
 * Reads a cookie value by name.
 * XSRF-TOKEN is set as non-httpOnly so client can read it.
 */
const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
};

/**
 * Safely converts HeadersInit to a plain object.
 * Handles Headers, Record<string, string>, and string[][] formats.
 */
const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers as Record<string, string>;
};

// =============================================================================
// CSRF Token Management
// =============================================================================

// In-memory CSRF token storage for cross-origin scenarios
// (document.cookie can't read cookies from different domains)
let csrfTokenCache: string | null = null;

/**
 * Fetches the CSRF token from the server.
 * Cross-origin: reads token from response body since JS can't access cookies from other domains.
 * Same-origin fallback: reads from cookie if response body doesn't contain token.
 */
export const fetchCsrfToken = async (): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }

    const json = (await response.json()) as {
      success: boolean;
      data: { csrfToken?: string } | null;
    };

    // Cross-origin: token comes in response body
    if (json.data?.csrfToken) {
      csrfTokenCache = json.data.csrfToken;
      return csrfTokenCache;
    }

    // Same-origin fallback: read from cookie
    const cookieToken = getCookie(CSRF_COOKIE);
    if (cookieToken) {
      csrfTokenCache = cookieToken;
      return csrfTokenCache;
    }

    throw new Error('Failed to obtain CSRF token');
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Ensures a CSRF token exists, fetching one if needed.
 * Checks in-memory cache first (for cross-origin), then cookie (for same-origin).
 */
export const ensureCsrfToken = async (): Promise<string> => {
  // Check in-memory cache first (cross-origin)
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  // Check cookie (same-origin fallback)
  const existingToken = getCookie(CSRF_COOKIE);
  if (existingToken) {
    csrfTokenCache = existingToken;
    return existingToken;
  }
  return fetchCsrfToken();
};

// =============================================================================
// API Fetcher with Timeout and Retry
// =============================================================================

/**
 * Wrapper around fetch with timeout, retry logic, and CSRF handling.
 * Retries on 5xx and 429 with exponential backoff.
 */
export const fetcher = async <T>(endpoint: string, options?: FetcherOptions): Promise<T> => {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options ?? {};

  const url = `${API_URL}${endpoint}`;
  const method = fetchOptions?.method ?? 'GET';
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...normalizeHeaders(fetchOptions?.headers),
  };

  // Add CSRF token for state-changing requests
  // Check in-memory cache first (cross-origin), then cookie (same-origin fallback)
  if (isMutating) {
    const csrfToken = csrfTokenCache ?? getCookie(CSRF_COOKIE);
    if (csrfToken) {
      headers[CSRF_HEADER] = csrfToken;
    }
  }

  let lastError: Error = new Error('Request failed');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check if we should retry
        if (attempt < retries && isRetryableStatus(response.status)) {
          // Respect Retry-After header if present
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : retryDelay * Math.pow(2, attempt) + Math.random() * 100; // Exponential backoff with jitter

          await sleep(delay);
          continue;
        }

        // Parse error response
        const err = (await response.json().catch(() => ({
          error: `HTTP ${response.status}`,
        }))) as ApiErrorResponse;
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = (await response.json()) as ApiResponse<T>;
      return result.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        lastError = error;

        // Handle timeout
        if (error.name === 'AbortError') {
          lastError = new Error('Request timed out');
        }

        // Don't retry client errors or timeouts
        if (error.name === 'AbortError' || error.message.includes('HTTP 4')) {
          throw lastError;
        }
      }

      // Retry with exponential backoff
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 100;
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

// Auth API
export const signIn = async (data: SignInInput): Promise<User> => {
  // Ensure we have a CSRF token before signing in
  // Use ensureCsrfToken to avoid race condition with cookie reading
  const csrfToken = await ensureCsrfToken();

  return fetcher<User>('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { [CSRF_HEADER]: csrfToken },
    retries: 0, // No retries for auth - fail fast on wrong credentials
  });
};

// Signup response type - either user or email confirmation required
export type SignUpResponse =
  | { emailConfirmationRequired: true; message: string; user: null }
  | { emailConfirmationRequired: false; user: User };

export const signUp = async (data: SignUpInput): Promise<SignUpResponse> => {
  // Ensure we have a CSRF token before signing up
  const csrfToken = await ensureCsrfToken();

  const url = `${API_URL}/api/auth/signup`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const result = (await response.json()) as {
    success: boolean;
    data: User | null;
    emailConfirmationRequired?: boolean;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error ?? `HTTP ${response.status}`);
  }

  if (result.emailConfirmationRequired) {
    return {
      emailConfirmationRequired: true,
      message: result.message ?? 'Please check your email to confirm your account.',
      user: null,
    };
  }

  return {
    emailConfirmationRequired: false,
    user: result.data as User,
  };
};

// signOut returns { success: true, data: null } from server
// fetcher extracts .data, so we get null
// Note: Retries are handled in useAuth.ts (3 attempts with exponential backoff)
// We disable fetcher retries here to avoid double-retry behavior
export const signOut = (): Promise<null> =>
  fetcher<null>('/api/auth/signout', {
    method: 'POST',
    retries: 0, // Retries handled in useAuth.ts, not here
    timeout: 5000, // 5 second timeout per attempt
  });

/**
 * Check if user is authenticated.
 * Returns null if not logged in (401) instead of throwing.
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    return await fetcher<User>('/api/auth/me', { retries: 0 });
  } catch (err) {
    // 401/Unauthorized is expected when not logged in - return null silently
    if (
      err instanceof Error &&
      (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))
    ) {
      return null;
    }
    throw err;
  }
};

// Users API
export interface UsersResponse {
  verified: User[];
  unverified: User[];
  total: number;
  verifiedCount: number;
  unverifiedCount: number;
}

export const fetchUsers = async (params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<UsersResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params?.search) searchParams.set('search', params.search);

  const qs = searchParams.toString();
  return fetcher<UsersResponse>(`/api/users${qs ? `?${qs}` : ''}`);
};
