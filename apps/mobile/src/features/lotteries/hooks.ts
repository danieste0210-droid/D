import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as lotteriesApi from '@/api/lotteries';

const LOTTERIES_KEY = 'lotteries';

export function useLotteries() {
  return useQuery({
    queryKey: [LOTTERIES_KEY],
    queryFn: lotteriesApi.listLotteries,
    staleTime: 60_000,
  });
}

export function useCreateLottery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lotteriesApi.createLottery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOTTERIES_KEY] }),
  });
}

export function useBlockLottery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lotteriesApi.blockLottery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOTTERIES_KEY] }),
  });
}

export function useEditLottery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: lotteriesApi.CreateLotteryPayload }) =>
      lotteriesApi.editLottery(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LOTTERIES_KEY] }),
  });
}

export function useLotteryResults(lotteryId: string | null) {
  return useQuery({
    queryKey: ['lottery-results', lotteryId],
    queryFn: () => lotteriesApi.getLotteryResults(lotteryId!),
    enabled: !!lotteryId,
  });
}

export function useProcessAwards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lotteriesApi.processAwards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery-results'] });
      queryClient.invalidateQueries({ queryKey: ['pending-awards'] });
    },
  });
}
