import { Link } from 'react-router-dom';

/**
 * Shown after successful signup when email confirmation is required.
 */
export const EmailConfirmationPage = (): JSX.Element => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Email icon */}
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>

          <p className="text-gray-600 mb-6">
            We&apos;ve sent a confirmation link to your email address. Please click the link to
            verify your account.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Check your spam folder if you don&apos;t see the email within a
              few minutes.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/auth/signin"
              className="block w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Sign In
            </Link>

            <Link to="/" className="block text-sm text-gray-500 hover:text-gray-700">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
