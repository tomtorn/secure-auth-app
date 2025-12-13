/**
 * Reusable stat card components for monitoring dashboard
 * Uses generic Card component for consistent styling
 */

import { Card, ProgressBar } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  alert?: boolean;
}

export const StatCard = ({ label, value, delta, alert }: StatCardProps): JSX.Element => (
  <Card className={alert ? 'border-red-400 bg-red-50' : ''}>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    {delta && <p className="text-xs text-green-600 mt-1">{delta}</p>}
  </Card>
);

interface ProgressCardProps {
  label: string;
  value: number;
  max: number;
  unit: string;
}

export const ProgressCard = ({ label, value, max, unit }: ProgressCardProps): JSX.Element => {
  const percentage = Math.min((value / max) * 100, 100);
  const isHigh = percentage > 80;

  return (
    <Card>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${isHigh ? 'text-red-600' : 'text-gray-900'}`}>
        {Math.round(value * 10) / 10}
        {unit}
      </p>
      <div className="mt-2">
        <ProgressBar value={value} max={max} />
      </div>
    </Card>
  );
};

interface StatusCardProps {
  label: string;
  status: 'healthy' | 'degraded' | 'down' | string;
  latency?: number;
}

export const StatusCard = ({ label, status, latency }: StatusCardProps): JSX.Element => {
  const isHealthy = status === 'healthy';
  const isDegraded = status === 'degraded';

  return (
    <Card>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span
          className={`text-2xl ${
            isHealthy ? 'text-green-500' : isDegraded ? 'text-yellow-500' : 'text-red-500'
          }`}
        >
          {isHealthy ? '✓' : isDegraded ? '⚠' : '✗'}
        </span>
        <span className="text-lg font-semibold text-gray-900">
          {isHealthy ? 'Healthy' : isDegraded ? 'Degraded' : 'Down'}
        </span>
      </div>
      {latency !== undefined && <p className="text-xs text-gray-400 mt-1">{latency}ms latency</p>}
    </Card>
  );
};
