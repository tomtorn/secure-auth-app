import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects routes that require authentication.
 * Redirects to /auth/signin if user is not authenticated.
 * Preserves the original URL in state for redirect after login.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps): JSX.Element => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // Redirect to sign in if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
