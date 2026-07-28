import { apiFetch } from './client';
import { endpoints } from './endpoints';
import type { Role } from '@/state/authStore';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  supervisorId: string | null;
  commissionPercent: string | null;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
  role: Role;
  supervisorId?: string;
  commissionPercent?: number;
}

export function listUsers(): Promise<AppUser[]> {
  return apiFetch<AppUser[]>(endpoints.users.all);
}

export function createUser(payload: CreateUserPayload): Promise<AppUser> {
  return apiFetch<AppUser>(endpoints.users.create, { method: 'POST', body: JSON.stringify(payload) });
}

// Soft-delete: nunca se borra físicamente, se desactiva.
export function deactivateUser(id: string): Promise<AppUser> {
  return apiFetch<AppUser>(endpoints.users.deactivate(id), { method: 'DELETE' });
}

export function listSupervisors(): Promise<AppUser[]> {
  return apiFetch<AppUser[]>(endpoints.users.supervisors);
}

export function listVendorsBySupervisor(supervisorId: string): Promise<AppUser[]> {
  return apiFetch<AppUser[]>(endpoints.users.bySupervisor(supervisorId));
}
