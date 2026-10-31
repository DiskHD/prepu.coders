/**
 * Cliente HTTP genérico. No sabe nada de billetes: solo envía peticiones,
 * aplica un tiempo límite y convierte los fallos en errores tipados.
 */

const env = import.meta.env;

export const API_BASE_URL: string = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const API_TIMEOUT_MS: number = Number(env.VITE_API_TIMEOUT_MS) || 20000;

export type ApiErrorType = 'network' | 'timeout' | 'http' | 'parse' | 'aborted';

export class ApiError extends Error {
  constructor(
    public readonly type: ApiErrorType,
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: BodyInit;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = API_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    // No se fija Content-Type: con FormData el navegador añade el boundary del multipart.
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      body,
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (timedOut) throw new ApiError('timeout', `Sin respuesta tras ${timeoutMs} ms`);
    if (signal?.aborted) throw new ApiError('aborted', 'Solicitud cancelada');
    throw new ApiError('network', err instanceof Error ? err.message : 'Error de red');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new ApiError('parse', 'La respuesta no es JSON válido', response.status);
    }
  }

  if (!response.ok) {
    throw new ApiError('http', `HTTP ${response.status}`, response.status, data);
  }
  return data as T;
}
