import type { HealthResponse } from '@forma/shared';

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/v1/health', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('API unavailable');
  return response.json() as Promise<HealthResponse>;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let csrfPromise: Promise<string> | null = null;
async function responseBody(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
export async function csrfToken() {
  if (!csrfPromise)
    csrfPromise = fetch('/v1/security/csrf', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const data = await responseBody(response);
        if (!response.ok)
          throw new ApiClientError(
            response.status,
            typeof data?.code === 'string' ? data.code : 'REQUEST_ERROR',
            typeof data?.message === 'string'
              ? data.message
              : 'No pudimos preparar el acceso. Inténtalo de nuevo.',
          );
        if (typeof data?.token !== 'string')
          throw new ApiClientError(
            response.status,
            'INVALID_RESPONSE',
            'El servicio devolvió una respuesta incompleta. Inténtalo de nuevo.',
          );
        return data.token;
      })
      .catch((error) => {
        csrfPromise = null;
        throw error;
      });
  return csrfPromise;
}
export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown } = {},
  retry = true,
): Promise<T> {
  try {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken();
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await responseBody(response);
    if (!response.ok) {
      if (data?.code === 'INVALID_CSRF' && retry) {
        csrfPromise = null;
        return apiRequest<T>(path, options, false);
      }
      throw new ApiClientError(
        response.status,
        typeof data?.code === 'string' ? data.code : 'REQUEST_ERROR',
        typeof data?.message === 'string' ? data.message : 'No pudimos completar la solicitud.',
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      'No pudimos conectar con tu estudio. Revisa tu conexión e inténtalo de nuevo.',
    );
  }
}
