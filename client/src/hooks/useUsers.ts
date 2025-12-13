import { useQuery } from '@tanstack/react-query';
import { fetchUsers, type UsersResponse } from '../lib/api';
import type { User } from '../lib/schemas';
import { USERS_QUERY_KEY } from '../lib/constants';

interface UseUsersParams {
  limit?: number;
  offset?: number;
  search?: string;
}

interface UseUsersReturn {
  verified: User[];
  unverified: User[];
  total: number;
  verifiedCount: number;
  unverifiedCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export const useUsers = (params?: UseUsersParams): UseUsersReturn => {
  const { data, isLoading, isError, error, refetch } = useQuery<UsersResponse>({
    queryKey: [...USERS_QUERY_KEY, params],
    queryFn: () => fetchUsers(params),
  });

  return {
    verified: data?.verified ?? [],
    unverified: data?.unverified ?? [],
    total: data?.total ?? 0,
    verifiedCount: data?.verifiedCount ?? 0,
    unverifiedCount: data?.unverifiedCount ?? 0,
    isLoading,
    isError,
    error,
    refetch,
  };
};
