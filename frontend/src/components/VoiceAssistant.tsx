import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { useSettings } from '../context/SettingsContext';

interface AnnounceOptions {
  /** Leer también con la voz de la app (si está activada). Por defecto true. */
  speak?: boolean;
  /** Interrumpe al lector de pantalla (errores, resultados). */
  assertive?: boolean;
}

interface VoiceAssistantValue {
  /** Anuncia un mensaje al lector de pantalla (aria-live) y, opcionalmente, por voz. */
  announce: (text: string, options?: AnnounceOptions) => void;
  /** Solo voz, sin anuncio aria-live (p. ej. botón "Escuchar"). */
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  speechSupported: boolean;
}

const VoiceAssistantContext = createContext<VoiceAssistantValue | null>(null);

/**
 * Asistente de voz: une la síntesis de voz (Web Speech API) con regiones
 * aria-live para TalkBack, VoiceOver y NVDA. Así cualquier mensaje llega por
 * los dos caminos y la app es utilizable sin mirar la pantalla.
 */
export function VoiceAssistant({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { speak, cancel, speaking, supported } = useSpeech({
    rate: settings.speechRate,
    enabled: settings.voiceEnabled,
  });
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const timer = useRef<number>();

  const announce = useCallback(
    (text: string, { speak: withVoice = true, assertive: urgent = false }: AnnounceOptions = {}) => {
      // Vaciar y volver a escribir fuerza a los lectores a repetir textos idénticos.
      const set = urgent ? setAssertive : setPolite;
      set('');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => set(text), 100);
      if (withVoice) speak(text);
    },
    [speak],
  );

  const value = useMemo<VoiceAssistantValue>(
    () => ({ announce, speak, stop: cancel, speaking, speechSupported: supported }),
    [announce, speak, cancel, speaking, supported],
  );

  return (
    <VoiceAssistantContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const ctx = useContext(VoiceAssistantContext);
  if (!ctx) throw new Error('useVoiceAssistant debe usarse dentro de <VoiceAssistant>');
  return ctx;
}
