import { useAuthStore } from '@/state/authStore';
import { API_URL } from './config';
import { endpoints } from './endpoints';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}`);
  }
}

// Comparte una sola llamada de refresh entre requests 401 concurrentes -- si dos peticiones
// disparan el refresh a la vez, la segunda reutiliza el refreshToken ya revocado por la
// primera y fallaría innecesariamente.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) return false;

      try {
        const response = await fetch(`${API_URL}${endpoints.auth.refresh}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;

        const tokens = await response.json();
        await useAuthStore.getState().updateTokens(tokens);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const isAuthEndpoint = path === endpoints.auth.login || path === endpoints.auth.refresh;
  if (response.status === 401 && allowRetry && !isAuthEndpoint) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
    await useAuthStore.getState().logout();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  return response.json();
}
