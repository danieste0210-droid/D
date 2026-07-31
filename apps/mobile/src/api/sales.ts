import { apiFetch, ApiError } from './client';
import { endpoints } from './endpoints';

export type SaleStatus = 'active' | 'cancelled' | 'paid';

// recto: apuesta tradicional (2/3/4 cifras). combinado: cubre todas las permutaciones de 3/4
// cifras contra el 1er premio. palet: 2 cifras, gana si coincide con dos posiciones a la vez.
// chance3: 3 cifras, coincidencia exacta contra el número derivado del 1er y 2do premio.
export type BetType = 'recto' | 'combinado' | 'palet' | 'chance3';

export interface Sale {
  id: string;
  batchId: string;
  sellerId: string;
  lotteryId: string;
  numberPlayed: string;
  amount: string; // Prisma Decimal se serializa como string
  betType: BetType;
  customerName: string | null;
  customerPhone: string | null;
  ticketCode: string;
  status: SaleStatus;
  createdAt: string;
}

// Recibo/visor de una venta agrupada -- todas las líneas de un mismo batchId (una o varias
// loterías x tipos de apuesta) que el vendedor procesó juntas en un solo "Procesar".
export interface SaleBatchLine {
  id: string;
  numberPlayed: string;
  betType: BetType;
  amount: number;
  status: SaleStatus;
}

export interface SaleBatchLottery {
  lotteryId: string;
  lotteryName: string;
  subtotal: number;
  lines: SaleBatchLine[];
  multipliers: {
    rectoDosCifras: [number, number, number];
    chance3Multiplier: number;
    paletTiers: [number, number];
  };
}

export interface SaleBatchDetail {
  batchId: string;
  ticketCode: string;
  createdAt: string;
  sellerName: string;
  customerName: string | null;
  customerPhone: string | null;
  status: 'active' | 'cancelled';
  total: number;
  lotteries: SaleBatchLottery[];
}

export interface SaleBatchSummary {
  batchId: string;
  ticketCode: string;
  createdAt: string;
  customerName: string | null;
  total: number;
  status: 'active' | 'cancelled';
  lotteryNames: string[];
}

export interface CreateSalePayload {
  lotteryId: string;
  numberPlayed: string;
  amount: number;
  betType?: BetType;
  customerName?: string;
  customerPhone?: string;
}

// "Números y Valores": un mismo número puede jugarse recto, combinado y/o palet a la vez dentro
// de la misma fila del carrito -- cada monto presente genera su propia venta independiente.
export interface BatchSaleItem {
  numberPlayed: string;
  rectoAmount?: number;
  combinadoAmount?: number;
  paletAmount?: number;
  chance3Amount?: number;
}

export interface CreateBatchSalePayload {
  lotteryIds: string[];
  customerName?: string;
  customerPhone?: string;
  items: BatchSaleItem[];
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

export function createBatchSale(payload: CreateBatchSalePayload): Promise<Sale[]> {
  return apiFetch<Sale[]>(endpoints.sales.processBatch, { method: 'POST', body: JSON.stringify(payload) });
}

export function cancelSale(id: string, reason: string): Promise<Sale> {
  return apiFetch<Sale>(endpoints.sales.cancel(id), { method: 'DELETE', body: JSON.stringify({ reason }) });
}

// Cancelación administrativa: sin restricción de cierre, para la pantalla "Eliminar Ventas".
export function adminCancelSale(id: string, reason: string): Promise<Sale> {
  return apiFetch<Sale>(endpoints.sales.adminCancel(id), { method: 'DELETE', body: JSON.stringify({ reason }) });
}

export function getLastSale(date?: string): Promise<Sale | null> {
  return apiFetch<Sale | null>(endpoints.sales.lastSale(date));
}

// "Ventas": una fila por venta agrupada (batchId), no por línea individual.
export function listMySaleBatches(): Promise<SaleBatchSummary[]> {
  return apiFetch<SaleBatchSummary[]>(endpoints.sales.myBatches);
}

export function getSaleBatch(batchId: string): Promise<SaleBatchDetail> {
  return apiFetch<SaleBatchDetail>(endpoints.sales.batch(batchId));
}

// Cancela TODAS las líneas activas de la venta agrupada de una vez.
export function cancelSaleBatch(batchId: string, reason: string): Promise<{ batchId: string; cancelled: number }> {
  return apiFetch(endpoints.sales.batch(batchId), { method: 'DELETE', body: JSON.stringify({ reason }) });
}

// Agrega una lotería a una venta ya creada, jugando el mismo carrito que ya tiene el lote.
export function addLotteryToBatch(batchId: string, lotteryId: string): Promise<Sale[]> {
  return apiFetch<Sale[]>(endpoints.sales.batchLotteries(batchId), { method: 'POST', body: JSON.stringify({ lotteryId }) });
}

// Quita una lotería de una venta agrupada (cancela solo sus líneas).
export function removeLotteryFromBatch(batchId: string, lotteryId: string): Promise<{ batchId: string; lotteryId: string; removed: number }> {
  return apiFetch(endpoints.sales.batchLottery(batchId, lotteryId), { method: 'DELETE' });
}

export { ApiError };
