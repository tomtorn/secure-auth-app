/**
 * Generic Card Components
 * Reusable card primitives for consistent UI
 */

import type { ReactNode } from 'react';

// =============================================================================
// Base Card
// =============================================================================

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = ({ children, className = '', padding = 'md' }: CardProps): JSX.Element => (
  <div
    className={`bg-white rounded-lg border border-gray-200 ${paddingClasses[padding]} ${className}`}
  >
    {children}
  </div>
);

// =============================================================================
// Card Header
// =============================================================================

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const CardHeader = ({ title, subtitle, action }: CardHeaderProps): JSX.Element => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

// =============================================================================
// Metric Card - For displaying a single metric
// =============================================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'success' | 'warning' | 'error' | 'neutral';
}

export const MetricCard = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  status = 'neutral',
}: MetricCardProps): JSX.Element => {
  const statusColors = {
    success: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    neutral: 'text-gray-900',
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${statusColors[status]}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && trendValue && (
            <p className={`text-xs mt-1 ${trendColors[trend]}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </p>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </Card>
  );
};

// =============================================================================
// Progress Bar
// =============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ProgressBar = ({
  value,
  max = 100,
  size = 'sm',
  showLabel = false,
}: ProgressBarProps): JSX.Element => {
  const percentage = Math.min((value / max) * 100, 100);
  const color = percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500';
  const heights = { sm: 'h-1.5', md: 'h-2.5' };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(0)}%</p>}
    </div>
  );
};

// =============================================================================
// Empty State
// =============================================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps): JSX.Element => (
  <div className="text-center py-8">
    <div className="text-3xl mb-2">{icon}</div>
    <p className="text-sm font-medium text-gray-900">{title}</p>
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// =============================================================================
// Loading Skeleton
// =============================================================================

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className = 'h-4 w-full' }: SkeletonProps): JSX.Element => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const CardSkeleton = (): JSX.Element => (
  <Card>
    <Skeleton className="h-4 w-1/3 mb-3" />
    <Skeleton className="h-8 w-1/2 mb-2" />
    <Skeleton className="h-3 w-2/3" />
  </Card>
);
