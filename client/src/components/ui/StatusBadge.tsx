/**
 * Reusable Status Badge Component
 * Color-coded badge for displaying status values
 */

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  // Success states
  ACTIVE: 'bg-green-100 text-green-800',
  PRIMARY: 'bg-green-100 text-green-800',
  RUNNING: 'bg-green-100 text-green-800',
  HEALTHY: 'bg-green-100 text-green-800',
  resolved: 'bg-green-100 text-green-800',
  // Warning states
  DRAINING: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  warning: 'bg-yellow-100 text-yellow-800',
  // Error states
  UNHEALTHY: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
  // Info states
  info: 'bg-blue-100 text-blue-800',
  // Default
  UNKNOWN: 'bg-gray-100 text-gray-800',
  unresolved: 'bg-gray-100 text-gray-800',
  ignored: 'bg-gray-100 text-gray-800',
};

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps): JSX.Element => {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-sm';

  return <span className={`font-medium rounded-full ${colorClass} ${sizeClass}`}>{status}</span>;
};
