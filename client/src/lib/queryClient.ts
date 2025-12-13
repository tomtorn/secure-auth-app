import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

/**
 * Determines if an error is retryable based on error message.
 * Client errors (4xx) and auth errors should not be retried.
 */
const isRetryableError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  // Don't retry client errors (4xx)
  if (message.includes('http 4') || message.includes('unauthorized')) {
    return false;
  }
  // Don't retry auth-related errors (wrong password, invalid credentials, etc.)
  if (
    message.includes('invalid') ||
    message.includes('credentials') ||
    message.includes('password') ||
    message.includes('locked') ||
    message.includes('too many')
  ) {
    return false;
  }
  // Don't retry timeouts (already retried in fetcher)
  if (message.includes('timed out')) {
    return false;
  }
  return true;
};

/**
 * Creates a configured QueryClient with:
 * - Smart retry logic (no retry for client errors)
 * - Exponential backoff
 * - Refetch on reconnect and window focus
 * - Error logging for observability
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Log query errors for debugging
        if (import.meta.env.DEV) {
          console.error(`[Query Error] ${String(query.queryKey)}:`, error);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Log mutation errors for debugging
        if (import.meta.env.DEV) {
          console.error(
            `[Mutation Error] ${String(mutation.options.mutationKey ?? 'unknown')}:`,
            error,
          );
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
          // Max 2 retries at query level (fetcher already retries)
          if (failureCount >= 2) return false;
          return isRetryableError(error as Error);
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: (failureCount, error) => {
          if (failureCount >= 1) return false;
          return isRetryableError(error as Error);
        },
        retryDelay: 1000,
        networkMode: 'offlineFirst',
      },
    },
  });
