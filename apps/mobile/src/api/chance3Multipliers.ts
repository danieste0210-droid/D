import { apiFetch } from './client';
import { endpoints } from './endpoints';

// "Chance de tres cifras": un solo multiplicador por lotería (coincidencia exacta contra el
// número derivado -- últimas 2 cifras del 1er premio + última cifra del 2do premio).
export interface Chance3Multiplier {
  id: string;
  lotteryId: string;
  multiplier: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertChance3MultiplierPayload {
  lotteryId: string;
  multiplier: number;
}

export function getChance3Multiplier(lotteryId: string): Promise<Chance3Multiplier | null> {
  return apiFetch<Chance3Multiplier | null>(endpoints.chance3Multipliers.byLottery(lotteryId));
}

export function upsertChance3Multiplier(payload: UpsertChance3MultiplierPayload): Promise<Chance3Multiplier> {
  return apiFetch<Chance3Multiplier>(endpoints.chance3Multipliers.upsert, { method: 'PUT', body: JSON.stringify(payload) });
}
