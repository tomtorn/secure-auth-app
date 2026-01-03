/**
 * System Monitoring Dashboard
 * Displays AWS, Auth, and application metrics with charts
 * Organized into tabs: Overview, DevOps, Activity
 */

import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMonitoring, useMetricTimeSeries } from '../hooks/useMonitoring';
import { StatCard, ProgressCard, StatusCard } from '../components/StatCard';
import { MetricChart } from '../components/MetricChart';
import { ActivityTable } from '../components/ActivityTable';
import { HealthCard } from '../components/HealthCard';
import { DeploymentCard } from '../components/DeploymentCard';
import { LogsViewer } from '../components/LogsViewer';
import { ErrorsCard } from '../components/ErrorsCard';
import { Tabs } from '../components/Tabs';
import { useAuth } from '../hooks/useAuth';

const MONITORING_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'devops', label: 'DevOps', icon: '🚀' },
  { id: 'activity', label: 'Activity', icon: '📋' },
];

export const MonitoringPage = (): JSX.Element => {
  const { user, signOut, isSigningOut } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, dataUpdatedAt } = useMonitoring();
  const { data: timeSeries } = useMetricTimeSeries();

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '-';

  // Invalidate all monitoring queries
  const handleRefresh = (): void => {
    queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    queryClient.invalidateQueries({ queryKey: ['health'] });
    queryClient.invalidateQueries({ queryKey: ['activity'] });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">System Monitoring</h1>
          </div>
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
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated}
            <span className="text-gray-400 ml-2">(auto-refreshes every 60s)</span>
          </p>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn btn-secondary text-sm flex items-center gap-2"
          >
            {isLoading ? <span className="animate-spin">↻</span> : '↻'}
            Refresh
          </button>
        </div>

        {/* Health Status - Always visible */}
        <section className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HealthCard />
          </div>
        </section>

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            Failed to load monitoring data. Please try again.
          </div>
        )}

        {/* Tabbed Content */}
        <Tabs tabs={MONITORING_TABS} defaultTab="overview">
          {(activeTab) => (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  {/* Loading State */}
                  {isLoading && !data && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  )}

                  {data && (
                    <>
                      {/* Application Metrics */}
                      <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Application</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <StatCard
                            label="Total Users"
                            value={data.app.totalUsers}
                            delta={`+${data.app.newUsers7d} this week`}
                          />
                          <StatCard label="New Users (24h)" value={data.app.newUsers24h} />
                          <StatusCard
                            label="API Status"
                            status={data.app.apiStatus}
                            latency={data.app.dbLatencyMs}
                          />
                          <StatCard
                            label="DB Latency"
                            value={`${data.app.dbLatencyMs}ms`}
                            alert={data.app.dbLatencyMs > 100}
                          />
                        </div>
                      </section>

                      {/* AWS Infrastructure */}
                      <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                          AWS Infrastructure
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <MetricChart
                            title="CPU"
                            value={data.aws.cpu}
                            data={timeSeries?.cpu ?? []}
                            color="#3b82f6"
                          />
                          <MetricChart
                            title="Memory"
                            value={data.aws.memory}
                            data={timeSeries?.memory ?? []}
                            color="#8b5cf6"
                          />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <ProgressCard label="CPU" value={data.aws.cpu} max={100} unit="%" />
                          <ProgressCard label="Memory" value={data.aws.memory} max={100} unit="%" />
                          <StatCard
                            label="Requests (24h)"
                            value={data.aws.requests24h.toLocaleString()}
                          />
                          <StatCard
                            label="5XX Errors"
                            value={data.aws.errors5xx24h}
                            alert={data.aws.errors5xx24h > 0}
                          />
                        </div>
                      </section>

                      {/* Auth Metrics */}
                      <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <StatCard label="Auth Users" value={data.auth.totalAuthUsers} />
                          <StatCard label="Signups (24h)" value={data.auth.signups24h} />
                          <StatCard label="Logins (24h)" value={data.auth.logins24h} />
                          <StatCard
                            label="Failed Logins (24h)"
                            value={data.auth.failedLogins24h}
                            alert={data.auth.failedLogins24h > 10}
                          />
                        </div>
                      </section>

                      <p className="text-xs text-gray-400 text-center">
                        Data timestamp: {new Date(data.timestamp).toLocaleString()}
                      </p>
                    </>
                  )}
                </>
              )}

              {/* DevOps Tab */}
              {activeTab === 'devops' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    <DeploymentCard />
                    <ErrorsCard />
                  </div>
                  <LogsViewer />
                </>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && <ActivityTable />}
            </>
          )}
        </Tabs>
      </div>
    </main>
  );
};
