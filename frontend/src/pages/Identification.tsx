import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ImagePlus, RefreshCw } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { Camera } from '../components/Camera';
import { CaptureButton } from '../components/CaptureButton';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ResultCard } from '../components/ResultCard';
import { useVoiceAssistant } from '../components/VoiceAssistant';
import { useSettings } from '../context/SettingsContext';
import { CAMERA_ERROR_MESSAGES, useCamera } from '../hooks/useCamera';
import { identifyBanknote } from '../services/identificationService';
import type { IdentificationOutcome } from '../types/identification';
import { playCue } from '../utils/feedback';
import { prepareImage } from '../utils/image';
import { SPOKEN, errorSpeech, resultSpeech } from '../utils/messages';
import type { Route } from '../App';

type Phase = 'capture' | 'processing' | 'result';

interface IdentificationProps {
  navigate: (route: Route) => void;
}

function outcomeSpeech(outcome: IdentificationOutcome) {
  if (outcome.status === 'success' && outcome.summary) {
    const { count, total, partial } = outcome.summary;
    const detail = outcome.summary.detections.map(p => `Un billete de ${p.denomination} pesos`).join('. ');
    return `${count} billetes identificados. Total: ${total} pesos mexicanos. ${detail}.${partial ? ' Se excluyeron detecciones dudosas o sin denominación. El total puede ser parcial.' : ''}`;
  }
  return outcome.status === 'success' ? resultSpeech(outcome.prediction) : errorSpeech(outcome.kind, outcome.prediction);
}

export function Identification({ navigate }: IdentificationProps) {
  const { settings } = useSettings();
  const { announce, speak } = useVoiceAssistant();
  const camera = useCamera();
  const [multiple, setMultiple] = useState(true);
  const [phase, setPhase] = useState<Phase>('capture');
  const [outcome, setOutcome] = useState<IdentificationOutcome | null>(null);
  const [photoSrc, setPhotoSrc] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const captureRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const { start: startCamera, stop: stopCamera } = camera;

  // Iniciar la cámara al entrar y en cada nuevo intento.
  useEffect(() => {
    if (phase !== 'capture') return;
    let cancelled = false;
    startCamera().then((ok) => {
      if (cancelled) return;
      if (ok) {
        announce(SPOKEN.cameraReady);
        captureRef.current?.focus();
      } else {
        announce(SPOKEN.cameraUnavailable, { assertive: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, startCamera, announce]);

  // Liberar recursos al salir de la pantalla.
  useEffect(
    () => () => {
      requestRef.current?.abort();
      stopCamera();
    },
    [stopCamera],
  );

  useEffect(() => () => {
    if (photoSrc) URL.revokeObjectURL(photoSrc);
  }, [photoSrc]);

  const submit = useCallback(
    async (image: Blob) => {
      playCue('capture', settings.soundCues);
      setPhase('processing');
      announce(SPOKEN.processing);
      stopCamera();

      const prepared = await prepareImage(image);
      setPhotoSrc(URL.createObjectURL(prepared));

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const result = await identifyBanknote(prepared, { multiple, minConfidence: settings.minConfidence, signal: controller.signal });
      if (controller.signal.aborted) return;

      setOutcome(result);
      setPhase('result');
      playCue(result.status === 'success' ? 'success' : 'error', settings.soundCues);
      announce(outcomeSpeech(result), { assertive: true });
    },
    [announce, multiple, settings.minConfidence, settings.soundCues, stopCamera],
  );

  useEffect(() => {
    if (phase === 'result') resultHeadingRef.current?.focus();
  }, [phase]);

  const handleCapture = async () => {
    const frame = await camera.capture();
    if (frame) submit(frame);
    else announce('La cámara aún no está lista. Espera un momento y vuelve a pulsar Capturar.', { assertive: true });
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      announce('El archivo elegido no es una imagen. Elige una foto.', { assertive: true });
      return;
    }
    submit(file);
  };

  const retry = () => {
    setOutcome(null);
    setPhotoSrc(undefined);
    setPhase('capture');
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('home')}
          aria-label="Volver al inicio"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-surface"
        >
          <ArrowLeft aria-hidden="true" className="size-8" />
        </button>
        <h1 id="page-title" tabIndex={-1} className="text-3xl font-black">
          {phase === 'result' ? 'Resultado' : 'Identificar billete'}
        </h1>
      </header>

      {phase === 'capture' && (
        <>
          <label className="text-lg font-semibold">
            Modo de reconocimiento
            <select value={multiple ? 'multiple' : 'single'} onChange={e => setMultiple(e.target.value === 'multiple')}
              className="ml-3 rounded border-2 border-line bg-surface p-3">
              <option value="multiple">Contar y sumar billetes mexicanos</option>
              <option value="single">Identificar un billete</option>
            </select>
          </label>
          <Camera
            videoRef={camera.videoRef}
            status={camera.status}
            errorMessage={camera.error ? CAMERA_ERROR_MESSAGES[camera.error] : undefined}
          />
          {camera.status === 'error' && camera.error ? (
            <p role="alert" className="rounded-2xl border-2 border-danger bg-surface p-4 text-lg font-semibold">
              {CAMERA_ERROR_MESSAGES[camera.error]}
            </p>
          ) : (
            <p className="text-lg text-muted">Se captura toda la imagen de la cámara. Coloca los billetes planos, separados y con buena luz. Aleja el teléfono hasta que todos se vean completos, dejando espacio en los bordes.</p>
          )}

          <div className="mt-auto flex flex-col gap-3">
            <CaptureButton ref={captureRef} onCapture={handleCapture} disabled={camera.status !== 'ready'} />
            <ActionButton icon={ImagePlus} onClick={() => fileInputRef.current?.click()}>
              ELEGIR IMAGEN
            </ActionButton>
            {camera.status === 'error' && (
              <ActionButton icon={RefreshCw} onClick={() => camera.start()}>
                REINTENTAR CÁMARA
              </ActionButton>
            )}
            <ActionButton variant="ghost" onClick={() => speak(SPOKEN.cameraReady)}>
              Repetir indicaciones
            </ActionButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFile}
          />
        </>
      )}

      {phase === 'processing' && <LoadingIndicator />}

      {phase === 'result' && outcome && (
        <ResultCard
          ref={resultHeadingRef}
          outcome={outcome}
          photoSrc={photoSrc}
          onListen={() => speak(outcomeSpeech(outcome))}
          onRetry={retry}
        />
      )}
    </div>
  );
}
