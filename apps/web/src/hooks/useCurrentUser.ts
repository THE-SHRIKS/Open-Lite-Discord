import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

export interface UserMembership {
  spaceId: string;
  role: 'owner' | 'admin' | 'member';
  spaceName: string;
  slug: string;
  iconText: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
  memberships?: UserMembership[];
}

export function useCurrentUser() {
  const queryClient = useQueryClient();
  const query = useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<CurrentUser>('/api/v1/auth/me'),
    retry: false,
    staleTime: 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isAuthenticated: !!query.data,
    refetch: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
  };
}
