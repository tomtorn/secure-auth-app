import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User, SignInInput, SignUpInput } from '../lib/schemas';
import { signIn, signUp, signOut, getCurrentUser } from '../lib/api';
import type { SignUpResponse } from '../lib/api';
import { AUTH_QUERY_KEY, USERS_QUERY_KEY } from '../lib/constants';
import { reportEvent, setMonitoringUser } from '../lib/monitoring';

/**
 * Type guard for location state with redirect path.
 */
interface LocationStateWithFrom {
  from?: {
    pathname: string;
  };
}

const isLocationStateWithFrom = (state: unknown): state is LocationStateWithFrom => {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  if (!s.from || typeof s.from !== 'object' || s.from === null) return false;
  const from = s.from as Record<string, unknown>;
  return typeof from.pathname === 'string';
};

/**
 * Note: We can't check for auth cookie client-side because it's HttpOnly.
 * We always attempt to fetch user data and let the server return 401 if not authenticated.
 */

export interface UseAuthOptions {
  /** If false, auth query will not run. Useful for public pages. */
  enabled?: boolean;
}

/** Response from signOut mutation (server returns { success: true, data: null }, fetcher extracts data) */
export type SignOutResponse = null;

export interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signIn: (data: SignInInput) => Promise<User>;
  signUp: (data: SignUpInput) => Promise<SignUpResponse>;
  signOut: () => Promise<SignOutResponse>;
  isSigningIn: boolean;
  isSigningUp: boolean;
  isSigningOut: boolean;
}

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Get redirect path from location state (set by ProtectedRoute)
  // Use type guard for safe access
  const from = isLocationStateWithFrom(location.state)
    ? (location.state.from?.pathname ?? '/dashboard')
    : '/dashboard';

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
  });

  const signInMutation = useMutation<User, Error, SignInInput>({
    mutationFn: (data) => signIn(data),
    onSuccess: (userData) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, userData);
      // Set user context for monitoring
      setMonitoringUser({ id: userData.id, email: userData.email });
      // Redirect to the page user was trying to access, or dashboard
      navigate(from, { replace: true });
    },
  });

  const signUpMutation = useMutation<SignUpResponse, Error, SignUpInput>({
    mutationFn: (data) => signUp(data),
    onSuccess: (result) => {
      if (result.emailConfirmationRequired) {
        // Email stored in HttpOnly cookie by server for pre-fill after confirmation
        navigate('/auth/email-confirmation', { replace: true });
      } else {
        // Full session - set user data and go to dashboard
        queryClient.setQueryData(AUTH_QUERY_KEY, result.user);
        navigate('/dashboard', { replace: true });
      }
    },
  });

  // Instant signout - clear local state immediately, fire API in background with retries
  const handleSignOut = async (): Promise<SignOutResponse> => {
    // 1. Clear local state FIRST (instant)
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.removeQueries({ queryKey: USERS_QUERY_KEY });
    // Clear user context from monitoring
    setMonitoringUser(null);

    // 2. Navigate immediately (instant)
    navigate('/auth/signin');

    // 3. Fire API in background with retries (don't await - UX is already done)
    const retrySignOut = async (attempts: number = 3): Promise<void> => {
      for (let i = 0; i < attempts; i++) {
        try {
          await signOut();
          return; // Success - exit
        } catch {
          if (i < attempts - 1) {
            // Wait before retry (1s, 2s, 4s - exponential backoff)
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
          }
        }
      }
      // All retries failed - report to monitoring service
      reportEvent({
        name: 'signout_failed',
        data: { userId: user?.id, attempts: attempts },
        level: 'error',
      });
    };

    // Fire and forget - don't block the UI
    void retrySignOut();

    return null;
  };

  // Keep mutation for isPending state (will be instant now)
  const signOutMutation = useMutation<SignOutResponse, Error, void>({
    mutationFn: handleSignOut,
  });

  return {
    user: user ?? null,
    isLoading: enabled ? isLoading : false,
    isAuthenticated: Boolean(user),
    error,
    signIn: signInMutation.mutateAsync,
    signUp: signUpMutation.mutateAsync,
    signOut: signOutMutation.mutateAsync,
    isSigningIn: signInMutation.isPending,
    isSigningUp: signUpMutation.isPending,
    isSigningOut: signOutMutation.isPending,
  };
};
