/**
 * React Query hook for auth activity data
 */

import { useQuery } from '@tanstack/react-query';
import { fetcher } from '../lib/api';

export interface AuthEvent {
  id: string;
  email: string;
  eventType: 'SIGN_IN' | 'SIGN_UP' | 'SIGN_OUT' | 'SIGN_IN_FAILED';
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
}

interface ActivityData {
  items: AuthEvent[];
  hasMore: boolean;
}

export const useActivity = (limit = 20) => {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => fetcher<ActivityData>(`/api/monitoring/activity?limit=${limit}`),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
};
