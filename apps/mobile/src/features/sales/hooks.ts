import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as salesApi from '@/api/sales';
import { useAuthStore } from '@/state/authStore';

const MY_SALES_KEY = 'sales-mine';
const MY_BATCHES_KEY = 'sale-batches-mine';
const BATCH_KEY = 'sale-batch';

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

export function useCreateBatchSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salesApi.createBatchSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_SALES_KEY] });
      queryClient.invalidateQueries({ queryKey: [MY_BATCHES_KEY] });
      queryClient.invalidateQueries({ queryKey: ['last-sale'] });
    },
  });
}

// Pantalla "Ventas": una fila por venta agrupada (batchId), no por línea individual.
export function useMySaleBatches() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: [MY_BATCHES_KEY, userId],
    queryFn: salesApi.listMySaleBatches,
    enabled: !!userId,
  });
}

// Recibo/visor de una venta agrupada -- se usa tanto justo después de Procesar como al tocar
// una venta desde la lista.
export function useSaleBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: [BATCH_KEY, batchId],
    queryFn: () => salesApi.getSaleBatch(batchId!),
    enabled: !!batchId,
  });
}

export function useCancelSaleBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, reason }: { batchId: string; reason: string }) => salesApi.cancelSaleBatch(batchId, reason),
    onSuccess: (_data, { batchId }) => {
      queryClient.invalidateQueries({ queryKey: [MY_BATCHES_KEY] });
      queryClient.invalidateQueries({ queryKey: [BATCH_KEY, batchId] });
    },
  });
}

export function useAddLotteryToBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, lotteryId }: { batchId: string; lotteryId: string }) => salesApi.addLotteryToBatch(batchId, lotteryId),
    onSuccess: (_data, { batchId }) => {
      queryClient.invalidateQueries({ queryKey: [MY_BATCHES_KEY] });
      queryClient.invalidateQueries({ queryKey: [BATCH_KEY, batchId] });
    },
  });
}

export function useRemoveLotteryFromBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, lotteryId }: { batchId: string; lotteryId: string }) => salesApi.removeLotteryFromBatch(batchId, lotteryId),
    onSuccess: (_data, { batchId }) => {
      queryClient.invalidateQueries({ queryKey: [MY_BATCHES_KEY] });
      queryClient.invalidateQueries({ queryKey: [BATCH_KEY, batchId] });
    },
  });
}

export function useCancelSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => salesApi.cancelSale(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MY_SALES_KEY] }),
  });
}

export function useLastSale(date?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['last-sale', userId, date],
    queryFn: () => salesApi.getLastSale(date),
    enabled: !!userId,
  });
}

export function useAllSales() {
  return useQuery({
    queryKey: ['sales-all'],
    queryFn: salesApi.listAllSales,
  });
}

export function useAdminCancelSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => salesApi.adminCancelSale(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-all'] }),
  });
}
