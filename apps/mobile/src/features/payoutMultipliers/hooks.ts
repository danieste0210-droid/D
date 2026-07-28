import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as payoutMultipliersApi from '@/api/payoutMultipliers';

const PAYOUT_MULTIPLIERS_KEY = 'payout-multipliers';

export function usePayoutMultipliers(lotteryId: string | null) {
  return useQuery({
    queryKey: [PAYOUT_MULTIPLIERS_KEY, lotteryId],
    queryFn: () => payoutMultipliersApi.listPayoutMultipliers(lotteryId!),
    enabled: !!lotteryId,
  });
}

export function useUpsertPayoutMultiplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payoutMultipliersApi.upsertPayoutMultiplier,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYOUT_MULTIPLIERS_KEY, variables.lotteryId] });
    },
  });
}
