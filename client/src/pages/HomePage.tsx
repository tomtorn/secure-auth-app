import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const HomePage = (): JSX.Element => {
  const navigate = useNavigate();

  // Handle Supabase auth callback tokens that might land on homepage
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Redirect to callback page to handle tokens securely
      navigate(`/auth/callback${hash}`, { replace: true });
    }
  }, [navigate]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to SecureAuth</h1>
          <p className="text-lg text-gray-600 mb-8">
            A production-grade fullstack application with separate frontend and backend.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signin" className="btn btn-primary">
              Sign In
            </Link>
            <Link to="/auth/signup" className="btn btn-secondary">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};
