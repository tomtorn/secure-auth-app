import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/Card';

export const DashboardPage = (): JSX.Element => {
  const { user, signOut, isSigningOut } = useAuth();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => signOut()}
              disabled={isSigningOut}
              className="btn btn-secondary text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/users" className="block">
            <Card className="hover:shadow-md transition-shadow h-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Users</h2>
              <p className="text-gray-600 text-sm">Manage system users</p>
            </Card>
          </Link>

          <Link to="/monitoring" className="block">
            <Card className="hover:shadow-md transition-shadow h-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Monitoring</h2>
              <p className="text-gray-600 text-sm">System health & metrics</p>
            </Card>
          </Link>

          <Card className="opacity-50 h-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Settings</h2>
            <p className="text-gray-600 text-sm">Configure your account (coming soon)</p>
          </Card>
        </div>
      </div>
    </main>
  );
};
