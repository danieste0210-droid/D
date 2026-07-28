import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Lottery } from './lotteries';

export interface BlockedNumber {
  id: string;
  lotteryId: string;
  number: string;
  createdById: string;
  createdAt: string;
  lottery?: Lottery;
}

export interface CreateBlockedNumberPayload {
  lotteryId: string;
  number: string;
}

export function listBlockedNumbers(): Promise<BlockedNumber[]> {
  return apiFetch<BlockedNumber[]>(endpoints.blockedNumbers.all);
}

export function createBlockedNumber(payload: CreateBlockedNumberPayload): Promise<BlockedNumber> {
  return apiFetch<BlockedNumber>(endpoints.blockedNumbers.create, { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteBlockedNumber(id: string): Promise<BlockedNumber> {
  return apiFetch<BlockedNumber>(endpoints.blockedNumbers.delete(id), { method: 'DELETE' });
}
