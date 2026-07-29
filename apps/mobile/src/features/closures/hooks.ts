import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as closuresApi from '@/api/closures';

const CLOSURES_KEY = 'closures';
const CLOSURE_DEFAULTS_KEY = 'closure-defaults';

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
    mutationFn: ({ id, openTime, closeTime }: { id: string; openTime?: string; closeTime: string }) =>
      closuresApi.updateClosure(id, { openTime, closeTime }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLOSURES_KEY] }),
  });
}

export function useClosureDefaults() {
  return useQuery({
    queryKey: [CLOSURE_DEFAULTS_KEY],
    queryFn: closuresApi.listClosureDefaults,
  });
}

export function useUpsertClosureDefault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closuresApi.upsertClosureDefault,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLOSURE_DEFAULTS_KEY] }),
  });
}
