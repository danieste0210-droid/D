import { apiFetch } from './client';
import { endpoints } from './endpoints';

export type PaletTier = 'mayor' | 'menor';

export interface PaletMultiplier {
  id: string;
  lotteryId: string;
  tier: PaletTier;
  multiplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPaletMultiplierPayload {
  lotteryId: string;
  tier: PaletTier;
  multiplier: number;
}

export function listPaletMultipliers(lotteryId: string): Promise<PaletMultiplier[]> {
  return apiFetch<PaletMultiplier[]>(endpoints.paletMultipliers.byLottery(lotteryId));
}

export function upsertPaletMultiplier(payload: UpsertPaletMultiplierPayload): Promise<PaletMultiplier> {
  return apiFetch<PaletMultiplier>(endpoints.paletMultipliers.upsert, { method: 'PUT', body: JSON.stringify(payload) });
}
