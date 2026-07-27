import { create } from 'zustand';
import { deleteItem, getItem, setItem } from './secureStorage';
import { API_URL } from '@/api/config';
import { endpoints } from '@/api/endpoints';

export type Role = 'super' | 'admin' | 'supervisor' | 'vendedor';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: { user: AuthUser; accessToken: string; refreshToken: string }) => Promise<void>;
  updateTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  setSession: async ({ user, accessToken, refreshToken }) => {
    await setItem('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken });
  },

  // Usado por el interceptor de refresh en api/client.ts -- no toca `user`, solo rota los tokens.
  updateTokens: async ({ accessToken, refreshToken }) => {
    await setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken });
  },

  hydrate: async () => {
    const refreshToken = await getItem('refreshToken');
    if (refreshToken) set({ refreshToken });
  },

  logout: async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      // Fetch crudo (no apiFetch) a propósito: /auth/logout es público y no necesita
      // accessToken, y no queremos que un fallo de red bloquee el logout local.
      try {
        await fetch(`${API_URL}${endpoints.auth.logout}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Sin conexión: la sesión queda revocada localmente igual; en el servidor expirará sola.
      }
    }

    await deleteItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
