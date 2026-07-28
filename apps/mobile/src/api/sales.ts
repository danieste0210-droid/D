import { apiFetch, ApiError } from './client';
import { endpoints } from './endpoints';

export type SaleStatus = 'active' | 'cancelled' | 'paid';

export interface Sale {
  id: string;
  sellerId: string;
  lotteryId: string;
  numberPlayed: string;
  amount: string; // Prisma Decimal se serializa como string
  ticketCode: string;
  status: SaleStatus;
  createdAt: string;
}

export interface CreateSalePayload {
  lotteryId: string;
  numberPlayed: string;
  amount: number;
}

export function listAllSales(): Promise<Sale[]> {
  return apiFetch<Sale[]>(endpoints.sales.all);
}

export function searchSales(params: { sellerId?: string; lotteryId?: string }): Promise<Sale[]> {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>,
  ).toString();
  return apiFetch<Sale[]>(`${endpoints.sales.search}${query ? `?${query}` : ''}`);
}

export function createSale(payload: CreateSalePayload): Promise<Sale> {
  return apiFetch<Sale>(endpoints.sales.process, { method: 'POST', body: JSON.stringify(payload) });
}

export function cancelSale(id: string, reason: string): Promise<Sale> {
  return apiFetch<Sale>(endpoints.sales.cancel(id), { method: 'DELETE', body: JSON.stringify({ reason }) });
}

// Cancelación administrativa: sin restricción de cierre, para la pantalla "Eliminar Ventas".
export function adminCancelSale(id: string, reason: string): Promise<Sale> {
  return apiFetch<Sale>(endpoints.sales.adminCancel(id), { method: 'DELETE', body: JSON.stringify({ reason }) });
}

export function getLastSale(): Promise<Sale | null> {
  return apiFetch<Sale | null>(endpoints.sales.lastSale);
}

export { ApiError };
