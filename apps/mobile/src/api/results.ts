import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Sale } from './sales';

export interface Result {
  id: string;
  lotteryId: string;
  drawDate: string;
  firstNumber: string;
  // Loterías de un solo resultado (ej. El Salvador, Lottery.resultPositions = 1) no publican 2do/3er premio.
  secondNumber: string | null;
  thirdNumber: string | null;
  processedById: string;
  processedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export type PaymentMethod = 'efectivo' | 'yappy';

export interface Award {
  id: string;
  saleId: string;
  resultId: string;
  position: number;
  category: string;
  amount: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  paidById: string | null;
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

export function approveAward(id: string): Promise<Award> {
  return apiFetch<Award>(endpoints.results.approveAward(id), { method: 'POST' });
}

export function payAward(id: string, paymentMethod: PaymentMethod): Promise<Award> {
  return apiFetch<Award>(endpoints.results.payAward(id), { method: 'POST', body: JSON.stringify({ paymentMethod }) });
}
