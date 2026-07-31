import { apiFetch } from './client';
import { endpoints } from './endpoints';

// 2 niveles (se paga solo el primero que coincida): mayor (1ra con 2da, O 1ra con 3ra -- mismo
// pago), menor (2da con 3ra).
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
