import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_MIN_CONFIDENCE } from '../services/identificationService';

export type TextSize = 'normal' | 'large' | 'xlarge' | 'xxlarge';

export interface Settings {
  /** Leer en voz alta resultados e indicaciones con la voz de la app. */
  voiceEnabled: boolean;
  speechRate: number;
  highContrast: boolean;
  textSize: TextSize;
  /** Tonos y vibración. */
  soundCues: boolean;
  minConfidence: number;
}

export const TEXT_SIZES: Record<TextSize, { label: string; scale: string }> = {
  normal: { label: 'Normal', scale: '100%' },
  large: { label: 'Grande', scale: '115%' },
  xlarge: { label: 'Muy grande', scale: '130%' },
  xxlarge: { label: 'Enorme', scale: '150%' },
};

const DEFAULTS: Settings = {
  voiceEnabled: true,
  speechRate: 1,
  highContrast: false,
  textSize: 'large',
  soundCues: true,
  minConfidence: DEFAULT_MIN_CONFIDENCE,
};

const STORAGE_KEY = 'billetealtiro.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* almacenamiento no disponible */
  }
  const prefersContrast = window.matchMedia?.('(prefers-contrast: more)').matches;
  return { ...DEFAULTS, highContrast: !!prefersContrast };
}

interface SettingsContextValue {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* almacenamiento no disponible */
    }
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.style.fontSize = TEXT_SIZES[settings.textSize].scale;
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update: (key, value) => setSettings((s) => ({ ...s, [key]: value })),
      reset: () => setSettings(DEFAULTS),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  return ctx;
}
