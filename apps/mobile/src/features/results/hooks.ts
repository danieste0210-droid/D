import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as resultsApi from '@/api/results';

const PENDING_AWARDS_KEY = 'pending-awards';
const LOTTERY_RESULTS_KEY = 'lottery-results';

export function usePendingAwards() {
  return useQuery({
    queryKey: [PENDING_AWARDS_KEY],
    queryFn: resultsApi.pendingAwards,
  });
}

export function useReverseResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => resultsApi.reverseResult(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PENDING_AWARDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [LOTTERY_RESULTS_KEY] });
    },
  });
}
