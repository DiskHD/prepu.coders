/**
 * Servicio de identificación: habla con el backend FastAPI (modelo YOLO en
 * Python) y traduce su contrato JSON al modelo de dominio de la interfaz.
 *
 * El reconocimiento se ejecuta EXCLUSIVAMENTE en el backend. Este módulo
 * nunca genera predicciones propias: si el servidor no responde, devuelve un
 * error y la interfaz lo comunica como tal.
 */

import { ApiError, requestJson } from './api';
import type {
  ApiIdentifyResponse,
  ApiPrediction,
  BackendStatus,
  BanknotePrediction,
  IdentificationErrorKind,
  IdentificationOutcome,
} from '../types/identification';

export const ENDPOINTS = {
  identify: '/api/identify',
  /** Propuesto: cualquier respuesta no 5xx se considera "servidor en línea". */
  health: '/api/health',
} as const;

/** Confianza mínima por defecto para aceptar una predicción (0–1). */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

const CURRENCIES: Record<string, { singular: string; plural: string }> = {
  MXN: { singular: 'peso mexicano', plural: 'pesos mexicanos' },
  USD: { singular: 'dólar estadounidense', plural: 'dólares estadounidenses' },
  EUR: { singular: 'euro', plural: 'euros' },
  COP: { singular: 'peso colombiano', plural: 'pesos colombianos' },
  ARS: { singular: 'peso argentino', plural: 'pesos argentinos' },
  CLP: { singular: 'peso chileno', plural: 'pesos chilenos' },
  PEN: { singular: 'sol', plural: 'soles' },
  GTQ: { singular: 'quetzal', plural: 'quetzales' },
};

export function currencyName(code: string, amount: number): string {
  const entry = CURRENCIES[code.toUpperCase()];
  if (!entry) return code.toUpperCase();
  return amount === 1 ? entry.singular : entry.plural;
}

function isApiPrediction(value: unknown): value is ApiPrediction {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.class === 'string' &&
    typeof p.denomination === 'number' &&
    typeof p.currency === 'string' &&
    typeof p.confidence === 'number'
  );
}

function toDomainPrediction(p: ApiPrediction): BanknotePrediction {
  // Algunos backends envían 0–100; se normaliza a 0–1.
  const confidence = p.confidence > 1 ? p.confidence / 100 : p.confidence;
  return {
    modelClass: p.class,
    denomination: p.denomination,
    currencyCode: p.currency.toUpperCase(),
    currencyName: currencyName(p.currency, p.denomination),
    confidence: Math.max(0, Math.min(1, confidence)),
    bbox: p.bbox,
  };
}

function toImageSrc(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^(data:|https?:|\/)/.test(value)) return value;
  return `data:image/jpeg;base64,${value}`;
}

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  'blurry_image',
  'partial_banknote',
  'no_detection',
  'low_confidence',
  'invalid_image',
]);

function errorKindFromBody(body: unknown): IdentificationErrorKind | undefined {
  if (body && typeof body === 'object') {
    const code = (body as Record<string, unknown>).error_code;
    if (typeof code === 'string' && KNOWN_ERROR_CODES.has(code)) return code as IdentificationErrorKind;
  }
  return undefined;
}

function serverMessageFromBody(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string') return b.message;
    if (typeof b.detail === 'string') return b.detail; // HTTPException de FastAPI
  }
  return undefined;
}

function mapApiError(err: ApiError): IdentificationOutcome {
  const base = { status: 'error' as const, detail: err.message };
  switch (err.type) {
    case 'timeout':
      return { ...base, kind: 'timeout' };
    case 'network':
      return { ...base, kind: navigator.onLine ? 'server_unavailable' : 'network_error' };
    case 'parse':
      return { ...base, kind: 'unexpected_response' };
    case 'aborted':
      return { ...base, kind: 'network_error' };
    case 'http': {
      const status = err.status ?? 0;
      const kindFromBody = errorKindFromBody(err.body);
      const serverMessage = serverMessageFromBody(err.body);
      if (kindFromBody) return { ...base, kind: kindFromBody, serverMessage };
      if ([502, 503, 504].includes(status) || (status >= 500 && err.body === undefined)) {
        return { ...base, kind: 'server_unavailable' };
      }
      if ([400, 413, 415, 422].includes(status)) return { ...base, kind: 'invalid_image', serverMessage };
      if (status === 404) return { ...base, kind: 'server_unavailable', detail: 'Endpoint no encontrado (404)' };
      return { ...base, kind: 'unexpected_response', serverMessage };
    }
  }
}

export interface IdentifyOptions {
  minConfidence?: number;
  signal?: AbortSignal;
}

/** Envía la fotografía al backend (multipart/form-data, campo "image"). */
export async function identifyBanknote(
  image: Blob,
  { minConfidence = DEFAULT_MIN_CONFIDENCE, signal }: IdentifyOptions = {},
): Promise<IdentificationOutcome> {
  const form = new FormData();
  const filename = image instanceof File ? image.name : 'billete.jpg';
  form.append('image', image, filename);

  let data: ApiIdentifyResponse;
  try {
    data = await requestJson<ApiIdentifyResponse>(ENDPOINTS.identify, { method: 'POST', body: form, signal });
  } catch (err) {
    if (err instanceof ApiError) return mapApiError(err);
    return { status: 'error', kind: 'unexpected_response', detail: String(err) };
  }

  if (!data || typeof data !== 'object' || typeof data.success !== 'boolean') {
    return { status: 'error', kind: 'unexpected_response', detail: 'Formato de respuesta desconocido' };
  }

  const prediction = isApiPrediction(data.prediction) ? toDomainPrediction(data.prediction) : undefined;
  const annotatedImageSrc = toImageSrc(data.annotated_image);

  if (!data.success || !prediction) {
    return {
      status: 'error',
      kind: errorKindFromBody(data) ?? 'no_detection',
      prediction,
      serverMessage: data.message,
    };
  }

  if (prediction.confidence < minConfidence) {
    return { status: 'error', kind: 'low_confidence', prediction, serverMessage: data.message };
  }

  return { status: 'success', prediction, serverMessage: data.message, annotatedImageSrc };
}

/** Comprueba si el backend de reconocimiento está accesible. */
export async function checkBackendStatus(signal?: AbortSignal): Promise<BackendStatus> {
  try {
    await requestJson(ENDPOINTS.health, { timeoutMs: 4000, signal });
    return 'online';
  } catch (err) {
    if (err instanceof ApiError && err.type === 'http' && (err.status ?? 0) < 500 && err.status !== 404) {
      return 'online';
    }
    return 'offline';
  }
}
