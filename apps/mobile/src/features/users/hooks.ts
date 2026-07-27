import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '@/api/users';

const USERS_KEY = 'users';

export function useUsers() {
  return useQuery({
    queryKey: [USERS_KEY],
    queryFn: usersApi.listUsers,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}
