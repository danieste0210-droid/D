import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as salesApi from '@/api/sales';
import { useAuthStore } from '@/state/authStore';

const MY_SALES_KEY = 'sales-mine';

export function useMySales() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [MY_SALES_KEY, userId],
    queryFn: () => salesApi.searchSales({ sellerId: userId! }),
    enabled: !!userId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salesApi.createSale,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MY_SALES_KEY] }),
  });
}

export function useCancelSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => salesApi.cancelSale(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MY_SALES_KEY] }),
  });
}
