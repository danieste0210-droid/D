import { apiFetch } from './client';
import { endpoints } from './endpoints';

export interface CombinadoMultiplier {
  id: string;
  lotteryId: string;
  digitCount: number;
  multiplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCombinadoMultiplierPayload {
  lotteryId: string;
  digitCount: number;
  multiplier: number;
}

export function listCombinadoMultipliers(lotteryId: string): Promise<CombinadoMultiplier[]> {
  return apiFetch<CombinadoMultiplier[]>(endpoints.combinadoMultipliers.byLottery(lotteryId));
}

export function upsertCombinadoMultiplier(payload: UpsertCombinadoMultiplierPayload): Promise<CombinadoMultiplier> {
  return apiFetch<CombinadoMultiplier>(endpoints.combinadoMultipliers.upsert, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
