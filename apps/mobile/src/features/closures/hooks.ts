import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as closuresApi from '@/api/closures';

const CLOSURES_KEY = 'closures';

export function useClosures() {
  return useQuery({
    queryKey: [CLOSURES_KEY],
    queryFn: closuresApi.listClosures,
  });
}

export function useCreateClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closuresApi.createClosure,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLOSURES_KEY] }),
  });
}

export function useDeleteClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closuresApi.deleteClosure,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLOSURES_KEY] }),
  });
}

export function useUpdateClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, closeTime }: { id: string; closeTime: string }) => closuresApi.updateClosure(id, { closeTime }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLOSURES_KEY] }),
  });
}
