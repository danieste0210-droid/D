import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Result } from './results';

export interface Lottery {
  id: string;
  name: string;
  active: boolean;
  blocked: boolean;
  maxAmountPerNumber: string | null;
  // 3 = estándar (1er/2do/3er premio), 1 = un solo resultado (ej. El Salvador) -- determina qué
  // modalidades se ofrecen y si el formulario de resultado pide 2do/3er premio.
  resultPositions: number;
}

export interface CreateLotteryPayload {
  name: string;
  maxAmountPerNumber?: number;
  resultPositions?: number;
}

export interface ProcessAwardsPayload {
  lotteryId: string;
  drawDate: string;
  firstNumber: string;
  secondNumber?: string;
  thirdNumber?: string;
}

export interface LotteryForDay extends Lottery {
  closures: { openTime: string | null; closeTime: string }[];
}

export function listLotteries(): Promise<Lottery[]> {
  return apiFetch<Lottery[]>(endpoints.lotteries.all);
}

// Loterías vendibles en un día de la semana dado (0=domingo..6=sábado), con su horario efectivo
// (excepción propia o heredado del horario general) -- usado en el paso "Loterías" de Nueva Venta.
export function listLotteriesForDay(dayOfWeek: number): Promise<LotteryForDay[]> {
  return apiFetch<LotteryForDay[]>(`${endpoints.lotteries.day}?dayOfWeek=${dayOfWeek}`);
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

export function processAwards(payload: ProcessAwardsPayload): Promise<{ result: Result; awardsCreated: number }> {
  return apiFetch(endpoints.lotteries.processAwards, { method: 'POST', body: JSON.stringify(payload) });
}
