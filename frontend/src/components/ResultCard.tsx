import { forwardRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Volume2, WifiOff } from 'lucide-react';
import type { IdentificationOutcome } from '../types/identification';
import { ERROR_COPY, percent } from '../utils/messages';
import { ActionButton } from './ActionButton';

interface ResultCardProps {
  outcome: IdentificationOutcome;
  /** Foto enviada al backend (object URL). */
  photoSrc?: string;
  onListen: () => void;
  onRetry: () => void;
}

const CONNECTION_ERRORS = new Set(['network_error', 'server_unavailable', 'timeout', 'unexpected_response']);

/** Resultado o error de una identificación. El encabezado recibe el foco al aparecer. */
export const ResultCard = forwardRef<HTMLHeadingElement, ResultCardProps>(function ResultCard(
  { outcome, photoSrc, onListen, onRetry },
  headingRef,
) {
  const isSuccess = outcome.status === 'success';
  const prediction = outcome.prediction;

  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-5">
      {isSuccess ? (
        <div className="rounded-3xl border-4 border-success bg-surface p-6 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto mb-2 size-12 text-success" />
          <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="flex flex-col">
            <span className="text-lg font-semibold text-muted">Billete identificado</span>
            <span className="text-6xl font-black leading-tight">
              {/* El signo $ se oculta al lector: el texto hablado ya dice la moneda. */}
              <span aria-hidden="true">$</span>
              {outcome.prediction.denomination}
            </span>
            <span className="text-2xl font-bold">{outcome.prediction.currencyName}</span>
          </h2>
        </div>
      ) : (
        <div className="rounded-3xl border-4 border-danger bg-surface p-6 text-center">
          {CONNECTION_ERRORS.has(outcome.kind) ? (
            <WifiOff aria-hidden="true" className="mx-auto mb-2 size-12 text-danger" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mx-auto mb-2 size-12 text-danger" />
          )}
          <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-black">
            {ERROR_COPY[outcome.kind].title}
          </h2>
          <p className="mt-3 text-xl">{ERROR_COPY[outcome.kind].advice}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <ActionButton icon={RotateCcw} variant="primary" onClick={onRetry}>
          {isSuccess ? 'IDENTIFICAR OTRO BILLETE' : 'INTENTAR DE NUEVO'}
        </ActionButton>
        <ActionButton icon={Volume2} onClick={onListen}>
          {isSuccess ? 'ESCUCHAR RESULTADO' : 'ESCUCHAR INDICACIONES'}
        </ActionButton>
      </div>

      {prediction && (
        <dl className="grid grid-cols-2 gap-3 rounded-2xl border-2 border-line bg-surface p-5 text-lg">
          <div>
            <dt className="text-base text-muted">Denominación</dt>
            <dd className="font-bold">{prediction.denomination}</dd>
          </div>
          <div>
            <dt className="text-base text-muted">Moneda</dt>
            <dd className="font-bold">
              {prediction.currencyName} <span className="text-muted">({prediction.currencyCode})</span>
            </dd>
          </div>
          <div>
            <dt className="text-base text-muted">Clase YOLO</dt>
            <dd className="break-all font-mono font-bold">{prediction.modelClass}</dd>
          </div>
          <div>
            <dt className="text-base text-muted">Confianza</dt>
            <dd className="font-bold">{percent(prediction.confidence)} %</dd>
          </div>
          <div className="col-span-2" aria-hidden="true">
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${isSuccess ? 'bg-success' : 'bg-danger'}`}
                style={{ width: `${percent(prediction.confidence)}%` }}
              />
            </div>
          </div>
        </dl>
      )}

      <DetectionImage
        annotatedSrc={isSuccess ? outcome.annotatedImageSrc : undefined}
        photoSrc={photoSrc}
        bbox={prediction?.bbox}
      />

      {outcome.status === 'error' && outcome.detail && (
        <details className="text-base text-muted">
          <summary className="cursor-pointer py-2">Detalle técnico</summary>
          <p className="break-words font-mono">{outcome.detail}</p>
        </details>
      )}
    </section>
  );
});

interface DetectionImageProps {
  annotatedSrc?: string;
  photoSrc?: string;
  bbox?: [number, number, number, number];
}

/** Imagen anotada del backend o, si solo llega la caja, la foto con la caja dibujada encima. */
function DetectionImage({ annotatedSrc, photoSrc, bbox }: DetectionImageProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  if (annotatedSrc) {
    return (
      <figure className="overflow-hidden rounded-2xl border-2 border-line">
        <img src={annotatedSrc} alt="Fotografía con la detección del modelo marcada" className="w-full" />
        <figcaption className="bg-surface p-3 text-base text-muted">Detección del modelo</figcaption>
      </figure>
    );
  }
  if (!photoSrc) return null;

  return (
    <figure className="overflow-hidden rounded-2xl border-2 border-line">
      <div className="relative">
        <img
          src={photoSrc}
          alt={bbox ? 'Fotografía enviada con el billete detectado marcado' : 'Fotografía enviada'}
          className="block w-full"
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        {bbox && size && (
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <rect
              x={bbox[0]}
              y={bbox[1]}
              width={bbox[2] - bbox[0]}
              height={bbox[3] - bbox[1]}
              fill="none"
              className="stroke-accent"
              strokeWidth={Math.max(4, size.w / 150)}
            />
          </svg>
        )}
      </div>
      <figcaption className="bg-surface p-3 text-base text-muted">
        {bbox ? 'Zona detectada por el modelo' : 'Foto enviada al servidor'}
      </figcaption>
    </figure>
  );
}
