/**
 * ECS Deployment Status Card
 * Shows current deployment status, task health, and revision info
 * Uses generic Card component for consistent styling
 */

import { useDeployments } from '../hooks/useMonitoring';
import { StatusBadge } from './ui/StatusBadge';
import { formatTimeAgo } from '../lib/utils';
import { Card, CardSkeleton } from './Card';

export const DeploymentCard = (): JSX.Element => {
  const { data, isLoading, isError } = useDeployments();

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (isError || !data) {
    return (
      <Card padding="lg">
        <h3 className="text-sm font-medium text-gray-500 mb-2">ECS Deployment</h3>
        <p className="text-sm text-gray-400">Unable to fetch deployment status</p>
      </Card>
    );
  }

  const primaryDeployment = data.deployments.find((d) => d.status === 'PRIMARY');
  const taskRevision = primaryDeployment?.taskDefinition || 'Unknown';

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">ECS Deployment</h3>
        <StatusBadge status={data.status} />
      </div>

      <div className="space-y-3">
        {/* Service Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Service</span>
          <span className="text-sm font-medium text-gray-900">{data.serviceName}</span>
        </div>

        {/* Task Revision */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Revision</span>
          <span className="text-sm font-mono font-medium text-blue-600">{taskRevision}</span>
        </div>

        {/* Running Tasks */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Tasks</span>
          <span className="text-sm font-medium">
            <span
              className={
                data.runningCount === data.desiredCount ? 'text-green-600' : 'text-yellow-600'
              }
            >
              {data.runningCount}
            </span>
            <span className="text-gray-400"> / {data.desiredCount}</span>
            {data.pendingCount > 0 && (
              <span className="text-yellow-600 ml-1">({data.pendingCount} pending)</span>
            )}
          </span>
        </div>

        {/* Last Deployment */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Last Deploy</span>
          <span className="text-sm text-gray-900">{formatTimeAgo(data.lastDeploymentAt)}</span>
        </div>
      </div>

      {/* Task Health */}
      {data.tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Task Health</p>
          <div className="flex flex-wrap gap-2">
            {data.tasks.map((task) => (
              <div
                key={task.taskArn}
                className="flex items-center gap-1 text-xs"
                title={`Started: ${task.startedAt || 'N/A'}`}
              >
                <StatusBadge status={task.healthStatus} />
                <span className="text-gray-500">{task.lastStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
