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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      // Un usuario creado con rol "supervisor" debe aparecer de inmediato en el picker de
      // supervisores (ej. al crear un vendedor justo después, en la misma sesión del modal).
      queryClient.invalidateQueries({ queryKey: ['supervisors'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [USERS_KEY] }),
  });
}

export function useSupervisors() {
  return useQuery({
    queryKey: ['supervisors'],
    queryFn: usersApi.listSupervisors,
  });
}

export function useVendorsBySupervisor(supervisorId: string | null) {
  return useQuery({
    queryKey: ['vendors-by-supervisor', supervisorId],
    queryFn: () => usersApi.listVendorsBySupervisor(supervisorId!),
    enabled: !!supervisorId,
  });
}
