import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { signInSchema, type SignInInput } from '../lib/schemas';
import { useAuth } from '../hooks/useAuth';

export const SignInPage = (): JSX.Element => {
  const { signIn, isSigningIn } = useAuth({ enabled: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onSubmit', // Only validate on submit
  });

  // Check for email confirmation success and pre-fill email from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const confirmed = urlParams.get('confirmed');
    const email = urlParams.get('email');

    if (confirmed === 'true') {
      setSuccessMessage('Email confirmed! Please sign in.');
      if (email) {
        setValue('email', email);
      }
      // Clean up URL
      window.history.replaceState({}, '', '/auth/signin');
    }
  }, [setValue]);

  const onSubmit = async (data: SignInInput): Promise<void> => {
    try {
      await signIn(data);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Sign in failed',
      });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Sign In</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {errors.root && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.root.message}
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`input ${errors.email ? 'border-red-500' : ''}`}
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`input ${errors.password ? 'border-red-500' : ''}`}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSigningIn}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/auth/signup" className="text-primary-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
};
