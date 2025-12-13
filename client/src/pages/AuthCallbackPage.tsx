import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Handles Supabase auth callback after email confirmation.
 * Fetches pending email from server (HttpOnly cookie) and redirects to sign in.
 */
export const AuthCallbackPage = (): JSX.Element => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const fetchPendingEmailAndRedirect = async (): Promise<void> => {
      try {
        // Fetch pending email from server (reads HttpOnly cookie)
        const response = await fetch(`${API_URL}/api/auth/pending-email`, {
          method: 'GET',
          credentials: 'include', // Include cookies for cross-origin
        });

        let email: string | null = null;

        if (response.ok) {
          const data = (await response.json()) as {
            success: boolean;
            data: { email: string | null };
          };
          email = data.data?.email ?? null;
        }

        // Show success then redirect
        setStatus('success');
        setTimeout(() => {
          const redirectUrl = email
            ? `/auth/signin?email=${encodeURIComponent(email)}&confirmed=true`
            : '/auth/signin?confirmed=true';
          window.location.href = redirectUrl;
        }, 2000);
      } catch {
        // On error, still redirect to signin
        setStatus('success');
        setTimeout(() => {
          window.location.href = '/auth/signin?confirmed=true';
        }, 2000);
      }
    };

    fetchPendingEmailAndRedirect();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        {status === 'processing' && (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Confirming your email...</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <p className="text-gray-800 font-medium text-xl">Email confirmed!</p>
            <p className="text-gray-500 mt-2">Redirecting to sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
};
