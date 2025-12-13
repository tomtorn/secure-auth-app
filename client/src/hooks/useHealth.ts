/**
 * React Query hook for system health status
 */

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '../lib/api';

type HealthStatus = 'operational' | 'degraded' | 'down';

export interface HealthData {
  status: HealthStatus;
  services: {
    api: HealthStatus;
    database: HealthStatus;
    auth: HealthStatus;
  };
  timestamp: string;
}

export const useHealth = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetcher<HealthData>('/api/monitoring/health'),
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000,
    retry: 1,
  });
};
