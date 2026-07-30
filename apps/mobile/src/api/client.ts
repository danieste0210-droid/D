import { useAuthStore } from '@/state/authStore';
import { API_URL } from './config';
import { endpoints } from './endpoints';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}`);
  }
}

// El HttpExceptionFilter del backend envuelve la respuesta de Nest (que a su vez ya trae
// {statusCode, message, error}) en un nivel extra: {statusCode, timestamp, message: {...}}.
// Sin desempacar ese anidado, `err.body.message` es un objeto y String(objeto) da "[object
// Object]" en vez del texto real -- ver apps/api/src/common/filters/http-exception.filter.ts.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const outer = (err.body as { message?: unknown } | null)?.message;
  const inner = outer && typeof outer === 'object' && 'message' in outer ? (outer as { message?: unknown }).message : outer;
  if (typeof inner === 'string') return inner;
  if (Array.isArray(inner)) return inner.join(', ');
  return fallback;
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

  // Nest serializa un controller que retorna null/undefined (ej. "última venta" sin resultados)
  // como 200 con body vacío, no como el literal "null" -- response.json() reventaría con
  // SyntaxError si se le pide parsear una cadena vacía.
  const text = await response.text();
  return text ? JSON.parse(text) : (null as T);
}
