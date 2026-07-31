import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as chance3MultipliersApi from '@/api/chance3Multipliers';

const CHANCE3_MULTIPLIER_KEY = 'chance3-multiplier';

export function useChance3Multiplier(lotteryId: string | null) {
  return useQuery({
    queryKey: [CHANCE3_MULTIPLIER_KEY, lotteryId],
    queryFn: () => chance3MultipliersApi.getChance3Multiplier(lotteryId!),
    enabled: !!lotteryId,
  });
}

export function useUpsertChance3Multiplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chance3MultipliersApi.upsertChance3Multiplier,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CHANCE3_MULTIPLIER_KEY, variables.lotteryId] });
    },
  });
}
