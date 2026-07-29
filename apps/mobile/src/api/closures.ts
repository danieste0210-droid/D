import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Lottery } from './lotteries';

export interface Closure {
  id: string;
  lotteryId: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string;
  lottery?: Lottery;
}

export interface CreateClosurePayload {
  lotteryId: string;
  dayOfWeek: number;
  openTime?: string;
  closeTime: string;
}

export interface ClosureDefault {
  id: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string;
}

export interface UpsertClosureDefaultPayload {
  dayOfWeek: number;
  openTime?: string;
  closeTime: string;
}

export function listClosures(): Promise<Closure[]> {
  return apiFetch<Closure[]>(endpoints.closures.all);
}

export function createClosure(payload: CreateClosurePayload): Promise<Closure> {
  return apiFetch<Closure>(endpoints.closures.create, { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteClosure(id: string): Promise<Closure> {
  return apiFetch<Closure>(endpoints.closures.delete(id), { method: 'DELETE' });
}

export function updateClosure(id: string, payload: Partial<CreateClosurePayload>): Promise<Closure> {
  return apiFetch<Closure>(endpoints.closures.update(id), { method: 'PATCH', body: JSON.stringify(payload) });
}

export function listClosureDefaults(): Promise<ClosureDefault[]> {
  return apiFetch<ClosureDefault[]>(endpoints.closures.defaults);
}

export function upsertClosureDefault(payload: UpsertClosureDefaultPayload): Promise<ClosureDefault> {
  return apiFetch<ClosureDefault>(endpoints.closures.upsertDefault, { method: 'PUT', body: JSON.stringify(payload) });
}
