import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as paletMultipliersApi from '@/api/paletMultipliers';

const PALET_MULTIPLIERS_KEY = 'palet-multipliers';

export function usePaletMultipliers(lotteryId: string | null) {
  return useQuery({
    queryKey: [PALET_MULTIPLIERS_KEY, lotteryId],
    queryFn: () => paletMultipliersApi.listPaletMultipliers(lotteryId!),
    enabled: !!lotteryId,
  });
}

export function useUpsertPaletMultiplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paletMultipliersApi.upsertPaletMultiplier,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PALET_MULTIPLIERS_KEY, variables.lotteryId] });
    },
  });
}
