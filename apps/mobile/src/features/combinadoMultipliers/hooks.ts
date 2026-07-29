import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as combinadoMultipliersApi from '@/api/combinadoMultipliers';

const COMBINADO_MULTIPLIERS_KEY = 'combinado-multipliers';

export function useCombinadoMultipliers(lotteryId: string | null) {
  return useQuery({
    queryKey: [COMBINADO_MULTIPLIERS_KEY, lotteryId],
    queryFn: () => combinadoMultipliersApi.listCombinadoMultipliers(lotteryId!),
    enabled: !!lotteryId,
  });
}

export function useUpsertCombinadoMultiplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: combinadoMultipliersApi.upsertCombinadoMultiplier,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [COMBINADO_MULTIPLIERS_KEY, variables.lotteryId] });
    },
  });
}
