import type { RefObject } from 'react';
import { CameraOff } from 'lucide-react';
import type { CameraStatus } from '../hooks/useCamera';

interface CameraProps {
  videoRef: RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorMessage?: string;
}

/** Vista previa de la cámara con una guía visual para encuadrar el billete. */
export function Camera({ videoRef, status, errorMessage }: CameraProps) {
  return (
    <div
      role="img"
      aria-label={
        status === 'ready'
          ? 'Vista previa de la cámara activa'
          : status === 'error'
            ? 'Cámara no disponible'
            : 'Iniciando la cámara'
      }
      className="relative aspect-[3/4] max-h-[55vh] w-full overflow-hidden rounded-3xl border-2 border-line bg-black sm:aspect-video"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        className={`size-full object-cover ${status === 'ready' ? '' : 'invisible'}`}
      />

      {status === 'ready' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="aspect-[2.3/1] w-full max-w-md rounded-xl border-4 border-dashed border-accent/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}

      {status === 'starting' && (
        <p aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
          Iniciando cámara…
        </p>
      )}

      {status === 'error' && (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <CameraOff className="size-14" />
          <p className="text-lg font-semibold">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
