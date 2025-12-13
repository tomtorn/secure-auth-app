/**
 * Health status card showing service statuses
 * Uses generic Card component and shared utilities
 */

import { useHealth, type HealthData } from '../hooks/useHealth';
import { Card, CardSkeleton } from './Card';
import { STATUS_DOT_COLORS, STATUS_BADGE_COLORS, type StatusType } from '../lib/utils';

type HealthStatus = HealthData['status'];

// Map health status to shared status types
const healthToStatusType: Record<HealthStatus, StatusType> = {
  operational: 'success',
  degraded: 'warning',
  down: 'error',
};

const statusLabels: Record<HealthStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const StatusDot = ({ status }: { status: HealthStatus }): JSX.Element => (
  <span
    className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_COLORS[healthToStatusType[status]]}`}
  />
);

export const HealthCard = (): JSX.Element => {
  const { data, isLoading, error } = useHealth();

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-red-200">
        <div className="flex items-center gap-2 mb-3">
          <StatusDot status="down" />
          <span className="text-sm font-semibold text-gray-900">System Status</span>
        </div>
        <p className="text-red-600 text-sm">Unable to fetch health status</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusDot status={data.status} />
          <span className="text-sm font-semibold text-gray-900">System Status</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_COLORS[healthToStatusType[data.status]]}`}
        >
          {statusLabels[data.status]}
        </span>
      </div>

      <div className="space-y-2">
        {Object.entries(data.services).map(([name, status]) => (
          <div key={name} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 capitalize">{name}</span>
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-gray-900">{statusLabels[status]}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Updated: {new Date(data.timestamp).toLocaleTimeString()}
      </p>
    </Card>
  );
};
