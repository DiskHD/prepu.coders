import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechOptions {
  /** Velocidad de lectura (0.5–2). */
  rate?: number;
  /** Si es false, speak() no hace nada (el usuario usa solo su lector de pantalla). */
  enabled?: boolean;
  lang?: string;
}

export interface SpeakOptions {
  /** Corta lo que se esté diciendo antes de empezar (por defecto true). */
  interrupt?: boolean;
}

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const base = lang.split('-')[0];
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.replace('_', '-').startsWith(`${base}-`)) ??
    voices.find((v) => v.lang.startsWith(base))
  );
}

/** Envoltorio de la Web Speech API (síntesis de voz). */
export function useSpeech({ rate = 1, enabled = true, lang = 'es-MX' }: UseSpeechOptions = {}) {
  const supported = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);

  useEffect(() => {
    if (!synth) return;
    const load = () => {
      voiceRef.current = pickVoice(synth.getVoices(), lang);
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, [lang]);

  const cancel = useCallback(() => {
    synth?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, { interrupt = true }: SpeakOptions = {}) => {
      if (!synth || !supported || !enabled || !text) return;
      if (interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceRef.current?.lang ?? lang;
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = rate;
      u.onstart = () => setSpeaking(true);
      u.onend = u.onerror = () => setSpeaking(synth.speaking);
      // Algunos navegadores ignoran speak() justo después de cancel().
      window.setTimeout(() => synth.speak(u), interrupt ? 50 : 0);
    },
    [enabled, lang, rate, supported],
  );

  useEffect(() => () => synth?.cancel(), []);

  return { speak, cancel, speaking, supported };
}
