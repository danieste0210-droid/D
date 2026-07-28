import { apiFetch } from './client';
import { endpoints } from './endpoints';

export interface PayoutMultiplier {
  id: string;
  lotteryId: string;
  digitCount: number;
  position: number;
  multiplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPayoutMultiplierPayload {
  lotteryId: string;
  digitCount: number;
  position: number;
  multiplier: number;
}

export function listPayoutMultipliers(lotteryId: string): Promise<PayoutMultiplier[]> {
  return apiFetch<PayoutMultiplier[]>(endpoints.payoutMultipliers.byLottery(lotteryId));
}

export function upsertPayoutMultiplier(payload: UpsertPayoutMultiplierPayload): Promise<PayoutMultiplier> {
  return apiFetch<PayoutMultiplier>(endpoints.payoutMultipliers.upsert, { method: 'PUT', body: JSON.stringify(payload) });
}
