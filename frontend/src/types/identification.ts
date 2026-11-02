/**
 * Contratos de datos de Billete al Tiro.
 *
 * Hay dos capas separadas a propósito:
 *  1. Tipos "Api*": reflejan el JSON que devuelve el backend FastAPI. Son una
 *     PROPUESTA inicial; si el backend definitivo cambia, solo hay que tocar
 *     estos tipos y el mapeo en services/identificationService.ts.
 *  2. Tipos de dominio: lo que consume la interfaz. Los componentes nunca
 *     leen el JSON del backend directamente.
 */

// ---------------------------------------------------------------------------
// 1. Contrato del backend (propuesta) — POST /api/identify
// ---------------------------------------------------------------------------

/** Códigos de error opcionales que el backend puede enviar para guiar al usuario. */
export type ApiErrorCode =
  | 'blurry_image'
  | 'partial_banknote'
  | 'no_detection'
  | 'low_confidence'
  | 'invalid_image'
  | 'detector_required';

export interface ApiPrediction {
  /** Clase del modelo YOLO, p. ej. "200_pesos". */
  class: string;
  denomination: number;
  /** Código ISO 4217, p. ej. "MXN". */
  currency: string;
  /** Confianza entre 0 y 1. */
  confidence: number;
  /** Opcional: caja [x1, y1, x2, y2] en píxeles de la imagen enviada. */
  bbox?: [number, number, number, number];
}

export interface ApiIdentifyResponse {
  count?: number;
  total?: number | null;
  detections?: ApiPrediction[];
  partial?: boolean;
  success: boolean;
  prediction: ApiPrediction | null;
  message: string;
  /** Opcional: motivo del fallo cuando success es false. */
  error_code?: ApiErrorCode;
  /** Opcional: imagen con la detección dibujada (data URL, base64 JPEG o URL). */
  annotated_image?: string;
}

// ---------------------------------------------------------------------------
// 2. Modelo de dominio que usa la interfaz
// ---------------------------------------------------------------------------

export interface BanknotePrediction {
  modelClass: string;
  denomination: number;
  currencyCode: string;
  /** Nombre hablado de la moneda, p. ej. "pesos mexicanos". */
  currencyName: string;
  /** Confianza entre 0 y 1. */
  confidence: number;
  bbox?: [number, number, number, number];
}

export type IdentificationErrorKind =
  | 'blurry_image'
  | 'partial_banknote'
  | 'no_detection'
  | 'low_confidence'
  | 'invalid_image'
  | 'detector_required'
  | 'network_error'
  | 'server_unavailable'
  | 'timeout'
  | 'unexpected_response';

export interface IdentificationSuccess {
  status: 'success';
  summary?: { count: number; total: number; detections: BanknotePrediction[]; partial: boolean };
  prediction: BanknotePrediction;
  /** Mensaje del backend, si lo hay. */
  serverMessage?: string;
  /** Imagen anotada lista para usar como src de <img>, si el backend la envía. */
  annotatedImageSrc?: string;
}

export interface IdentificationFailure {
  status: 'error';
  kind: IdentificationErrorKind;
  /** Predicción descartada (p. ej. por confianza insuficiente), si existe. */
  prediction?: BanknotePrediction;
  serverMessage?: string;
  /** Detalle técnico para depuración; no se lee en voz alta. */
  detail?: string;
}

export type IdentificationOutcome = IdentificationSuccess | IdentificationFailure;

export type BackendStatus = 'checking' | 'online' | 'offline';
