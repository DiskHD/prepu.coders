import { useState, type RefObject } from 'react';
import { CameraOff } from 'lucide-react';
import type { CameraStatus } from '../hooks/useCamera';

interface CameraProps {
  videoRef: RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorMessage?: string;
}

/** Muestra todo el fotograma que se enviará al detector, sin recortar los lados. */
export function Camera({ videoRef, status, errorMessage }: CameraProps) {
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

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
      className="relative max-h-[65vh] w-full overflow-hidden rounded-3xl border-2 border-line bg-black"
      style={{ aspectRatio }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth && video.videoHeight) {
            setAspectRatio(video.videoWidth / video.videoHeight);
          }
        }}
        onResize={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth && video.videoHeight) {
            setAspectRatio(video.videoWidth / video.videoHeight);
          }
        }}
        className={`size-full object-contain ${status === 'ready' ? '' : 'invisible'}`}
      />

      {status === 'ready' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-2xl border-2 border-dashed border-accent/90" />
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
