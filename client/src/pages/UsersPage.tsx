import { Link } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { UserCard } from '../components/UserCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Card } from '../components/Card';

export const UsersPage = (): JSX.Element => {
  const { verified, unverified, total, verifiedCount, unverifiedCount, isLoading, isError, error } =
    useUsers({ limit: 50 });

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          </div>
          {!isLoading && (
            <span className="text-sm text-gray-500">
              {total} user{total !== 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {isLoading && <LoadingSpinner message="Loading users..." />}

        {isError && (
          <Card className="bg-red-50 border-red-200">
            <p className="text-red-700">Error: {error?.message ?? 'Unknown error'}</p>
          </Card>
        )}

        {!isLoading && !isError && total === 0 && (
          <div className="text-center py-12 text-gray-500">No users found</div>
        )}

        {/* Verified Users Section */}
        {!isLoading && !isError && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-sm">
                ✓
              </span>
              Verified Users ({verifiedCount})
            </h2>
            {verified.length === 0 ? (
              <p className="text-gray-500 text-sm">No verified users</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {verified.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Unverified Users Section */}
        {!isLoading && !isError && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full text-sm">
                !
              </span>
              Pending Verification ({unverifiedCount})
            </h2>
            {unverified.length === 0 ? (
              <p className="text-gray-500 text-sm">No pending users</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {unverified.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};
