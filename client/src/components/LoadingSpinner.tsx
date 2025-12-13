interface LoadingSpinnerProps {
  /** Message to display below spinner */
  message?: string;
  /** Whether to show full-screen centered spinner */
  fullScreen?: boolean;
}

/**
 * Reusable loading spinner component.
 */
export const LoadingSpinner = ({
  message = 'Loading...',
  fullScreen = false,
}: LoadingSpinnerProps): JSX.Element => {
  const content = (
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">{content}</div>
    );
  }

  return content;
};
