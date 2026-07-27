import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Sale } from './sales';

export interface Result {
  id: string;
  lotteryId: string;
  drawDate: string;
  winningNumber: string;
  processedById: string;
  processedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface Award {
  id: string;
  saleId: string;
  resultId: string;
  amount: string;
  status: 'pending' | 'paid' | 'reversed';
  paidAt: string | null;
  sale?: Sale;
}

export interface CreateResultPayload {
  lotteryId: string;
  drawDate: string;
  winningNumber: string;
}

export function createResult(payload: CreateResultPayload): Promise<{ result: Result; awardsCreated: number }> {
  return apiFetch(endpoints.results.create, { method: 'POST', body: JSON.stringify(payload) });
}

export function reverseResult(id: string, reason: string) {
  return apiFetch<{ result: Result; awardsRequiringManualReview: unknown[] }>(endpoints.results.reverse(id), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function pendingAwards(): Promise<Award[]> {
  return apiFetch<Award[]>(endpoints.results.pendingAwards);
}
