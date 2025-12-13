import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { signUpSchema, type SignUpInput } from '../lib/schemas';
import { useAuth } from '../hooks/useAuth';

// Password requirements for display
const PASSWORD_REQUIREMENTS = [
  { regex: /.{8,}/, label: 'At least 8 characters' },
  { regex: /[a-z]/, label: 'One lowercase letter (a-z)' },
  { regex: /[A-Z]/, label: 'One uppercase letter (A-Z)' },
  { regex: /[0-9]/, label: 'One number (0-9)' },
  { regex: /[^a-zA-Z0-9]/, label: 'One special character (!@#$%^&*)' },
];

export const SignUpPage = (): JSX.Element => {
  const { signUp, isSigningUp } = useAuth({ enabled: false });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setError,
    watch,
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onSubmit', // Only validate on submit
  });

  const password = watch('password', '');

  const onSubmit = async (data: SignUpInput): Promise<void> => {
    try {
      await signUp(data);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Sign up failed',
      });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Create Account</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.root.message}
            </div>
          )}

          <div>
            <label htmlFor="name" className="label">
              Name
            </label>
            <input
              id="name"
              type="text"
              className={`input ${errors.name ? 'border-red-500' : ''}`}
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

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
            {/* Show requirements list only after submit attempt with password error */}
            {isSubmitted && errors.password && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Password must contain:</p>
                <ul className="space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req, index) => {
                    const isMet = req.regex.test(password);
                    return (
                      <li
                        key={index}
                        className={`text-sm flex items-center gap-2 ${isMet ? 'text-green-600' : 'text-red-600'}`}
                      >
                        <span>{isMet ? '✓' : '✗'}</span>
                        {req.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSigningUp}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningUp ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/auth/signin" className="text-primary-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
};
