import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as blockedNumbersApi from '@/api/blockedNumbers';

const BLOCKED_NUMBERS_KEY = 'blocked-numbers';

export function useBlockedNumbers() {
  return useQuery({
    queryKey: [BLOCKED_NUMBERS_KEY],
    queryFn: blockedNumbersApi.listBlockedNumbers,
  });
}

export function useCreateBlockedNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockedNumbersApi.createBlockedNumber,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BLOCKED_NUMBERS_KEY] }),
  });
}

export function useDeleteBlockedNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockedNumbersApi.deleteBlockedNumber,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BLOCKED_NUMBERS_KEY] }),
  });
}
