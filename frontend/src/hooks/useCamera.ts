import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error';

export type CameraErrorKind = 'permission_denied' | 'not_found' | 'in_use' | 'insecure_context' | 'unsupported' | 'unknown';

export const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  permission_denied: 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador.',
  not_found: 'No se encontró ninguna cámara en este dispositivo.',
  in_use: 'Otra aplicación está usando la cámara. Ciérrala e inténtalo de nuevo.',
  insecure_context: 'La cámara solo funciona en una conexión segura (https).',
  unsupported: 'Este navegador no permite usar la cámara.',
  unknown: 'No se pudo iniciar la cámara.',
};

function classify(err: unknown): CameraErrorKind {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission_denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'not_found';
    case 'NotReadableError':
    case 'AbortError':
      return 'in_use';
    default:
      return 'unknown';
  }
}

/** Acceso a la cámara trasera mediante MediaDevices API. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraErrorKind | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!window.isSecureContext) {
      setError('insecure_context');
      setStatus('error');
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('unsupported');
      setStatus('error');
      return false;
    }
    setStatus('starting');
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus('ready');
      return true;
    } catch (err) {
      setError(classify(err));
      setStatus('error');
      return false;
    }
  }, []);

  /** Toma un fotograma de la vista previa como JPEG. */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, start, stop, capture };
}
