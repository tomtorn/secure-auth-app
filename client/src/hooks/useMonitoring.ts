/**
 * React Query hook for monitoring data
 */

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '../lib/api';

export interface AwsMetrics {
  cpu: number;
  memory: number;
  requests24h: number;
  errors5xx24h: number;
  latencyMs: number;
  dbConnections: number;
}

export interface AuthMetrics {
  totalAuthUsers: number;
  signups24h: number;
  logins24h: number;
  failedLogins24h: number;
  dbSizeMb: number;
}

export interface AppMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers24h: number;
  apiStatus: 'healthy' | 'degraded' | 'down';
  dbLatencyMs: number;
}

export interface MonitoringData {
  aws: AwsMetrics;
  auth: AuthMetrics;
  app: AppMetrics;
  timestamp: string;
}

export const useMonitoring = () => {
  return useQuery({
    queryKey: ['monitoring'],
    queryFn: () => fetcher<MonitoringData>('/api/monitoring'),
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2,
  });
};

// =============================================================================
// DevOps Types and Hooks
// =============================================================================

export interface EcsDeployment {
  id: string;
  status: string;
  taskDefinition: string;
  runningCount: number;
  desiredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EcsTask {
  taskArn: string;
  taskDefinitionArn: string;
  lastStatus: string;
  healthStatus: string;
  startedAt: string | null;
  cpu: string;
  memory: string;
}

export interface EcsDeploymentStatus {
  serviceName: string;
  status: string;
  runningCount: number;
  desiredCount: number;
  pendingCount: number;
  deployments: EcsDeployment[];
  tasks: EcsTask[];
  lastDeploymentAt: string | null;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  logStream: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: 'error' | 'warning' | 'info';
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: 'resolved' | 'unresolved' | 'ignored';
  shortId: string;
}

export interface SentryStats {
  totalIssues: number;
  unresolvedIssues: number;
  errorsToday: number;
  topIssues: SentryIssue[];
}

export const useDeployments = () => {
  return useQuery({
    queryKey: ['monitoring', 'deployments'],
    queryFn: () => fetcher<EcsDeploymentStatus>('/api/monitoring/deployments'),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
    retry: 1,
  });
};

export const useLogs = (limit = 50) => {
  return useQuery({
    queryKey: ['monitoring', 'logs', limit],
    queryFn: () => fetcher<LogEntry[]>(`/api/monitoring/logs?limit=${limit}`),
    refetchInterval: 10000, // Refresh every 10 seconds for live feel
    staleTime: 5000,
    retry: 1,
  });
};

export const useSentryErrors = () => {
  return useQuery({
    queryKey: ['monitoring', 'errors'],
    queryFn: () => fetcher<SentryStats>('/api/monitoring/errors'),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });
};

// =============================================================================
// Metrics Time Series (Real CloudWatch data for charts)
// =============================================================================

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeries {
  cpu: MetricDataPoint[];
  memory: MetricDataPoint[];
}

export const useMetricTimeSeries = () => {
  return useQuery({
    queryKey: ['monitoring', 'metrics', 'timeseries'],
    queryFn: () => fetcher<MetricTimeSeries>('/api/monitoring/metrics/timeseries'),
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
    retry: 1,
  });
};
