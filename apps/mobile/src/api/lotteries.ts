import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Result } from './results';

export interface Lottery {
  id: string;
  name: string;
  active: boolean;
  blocked: boolean;
  maxAmountPerNumber: string | null;
  payoutMultiplier: string;
}

export interface CreateLotteryPayload {
  name: string;
  maxAmountPerNumber?: number;
}

export function listLotteries(): Promise<Lottery[]> {
  return apiFetch<Lottery[]>(endpoints.lotteries.all);
}

export function createLottery(payload: CreateLotteryPayload): Promise<Lottery> {
  return apiFetch<Lottery>(endpoints.lotteries.create, { method: 'POST', body: JSON.stringify(payload) });
}

export function blockLottery(id: string): Promise<Lottery> {
  return apiFetch<Lottery>(endpoints.lotteries.block(id), { method: 'POST' });
}

export function editLottery(id: string, payload: Partial<CreateLotteryPayload & { active: boolean }>): Promise<Lottery> {
  return apiFetch<Lottery>(endpoints.lotteries.edit(id), { method: 'PATCH', body: JSON.stringify(payload) });
}

export function getLotteryResults(lotteryId: string): Promise<Result[]> {
  return apiFetch<Result[]>(`${endpoints.lotteries.results}?lotteryId=${lotteryId}`);
}
