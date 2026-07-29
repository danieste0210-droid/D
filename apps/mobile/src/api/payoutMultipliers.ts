import { apiFetch } from './client';
import { endpoints } from './endpoints';

// ultimas: coincidencia contra las últimas N cifras del resultado (la regla general).
// primeras: bono exclusivo de los billetes de 4 cifras completas, contra las primeras 3 cifras.
export type MatchType = 'ultimas' | 'primeras';

export interface PayoutMultiplier {
  id: string;
  lotteryId: string;
  digitCount: number;
  position: number;
  matchType: MatchType;
  multiplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPayoutMultiplierPayload {
  lotteryId: string;
  digitCount: number;
  position: number;
  matchType?: MatchType;
  multiplier: number;
}

export function listPayoutMultipliers(lotteryId: string): Promise<PayoutMultiplier[]> {
  return apiFetch<PayoutMultiplier[]>(endpoints.payoutMultipliers.byLottery(lotteryId));
}

export function upsertPayoutMultiplier(payload: UpsertPayoutMultiplierPayload): Promise<PayoutMultiplier> {
  return apiFetch<PayoutMultiplier>(endpoints.payoutMultipliers.upsert, { method: 'PUT', body: JSON.stringify(payload) });
}
