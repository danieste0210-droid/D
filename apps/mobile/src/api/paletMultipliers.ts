import { apiFetch } from './client';
import { endpoints } from './endpoints';

// Cascada de 3 pasos (se paga solo el primero que coincida): mayor (1ra con 2da), medio
// (1ra con 3ra), menor (2da con 3ra).
export type PaletTier = 'mayor' | 'medio' | 'menor';

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
