import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Sale } from './sales';

export interface Result {
  id: string;
  lotteryId: string;
  drawDate: string;
  firstNumber: string;
  secondNumber: string;
  thirdNumber: string;
  processedById: string;
  processedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface Award {
  id: string;
  saleId: string;
  resultId: string;
  position: number;
  amount: string;
  status: 'pending' | 'paid' | 'reversed';
  paidAt: string | null;
  sale?: Sale;
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
