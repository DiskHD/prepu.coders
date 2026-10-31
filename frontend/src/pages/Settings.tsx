import { useId, type ReactNode } from 'react';
import { ArrowLeft, RotateCcw, Volume2 } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { useVoiceAssistant } from '../components/VoiceAssistant';
import { TEXT_SIZES, useSettings, type TextSize } from '../context/SettingsContext';
import type { Route } from '../App';

interface SettingsProps {
  navigate: (route: Route) => void;
}

export function Settings({ navigate }: SettingsProps) {
  const { settings, update, reset } = useSettings();
  const { announce, speak, speechSupported } = useVoiceAssistant();

  const rateLabel = `${settings.speechRate.toFixed(1)}×`;

  return (
    <div className="flex flex-1 flex-col gap-6">
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
          Configuración
        </h1>
      </header>

      <SettingGroup title="Voz">
        {!speechSupported && (
          <p className="text-lg text-danger">Este navegador no tiene síntesis de voz. Usa tu lector de pantalla.</p>
        )}
        <Toggle
          label="Voz de la aplicación"
          description="Desactívala si prefieres oír solo tu lector de pantalla."
          checked={settings.voiceEnabled}
          onChange={(v) => {
            update('voiceEnabled', v);
            announce(v ? 'Voz activada' : 'Voz desactivada', { speak: false });
          }}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="speech-rate" className="text-xl font-bold">
            Velocidad de voz: {rateLabel}
          </label>
          <input
            id="speech-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.speechRate}
            aria-valuetext={`${settings.speechRate.toFixed(1)} veces`}
            onChange={(e) => update('speechRate', Number(e.target.value))}
            className="h-12 w-full accent-[var(--color-accent)]"
          />
        </div>
        <ActionButton icon={Volume2} onClick={() => speak('Así suena la voz a esta velocidad.')} disabled={!settings.voiceEnabled}>
          PROBAR VOZ
        </ActionButton>
        <Toggle
          label="Sonidos y vibración"
          description="Un tono y una vibración al capturar y al recibir el resultado."
          checked={settings.soundCues}
          onChange={(v) => update('soundCues', v)}
        />
      </SettingGroup>

      <SettingGroup title="Pantalla">
        <Toggle
          label="Alto contraste"
          description="Fondo negro, texto blanco y botones amarillos."
          checked={settings.highContrast}
          onChange={(v) => update('highContrast', v)}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xl font-bold">Tamaño del texto</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TEXT_SIZES) as TextSize[]).map((size) => (
              <label
                key={size}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-surface px-4
                  text-lg font-semibold has-[:checked]:border-accent has-[:checked]:bg-surface-2 has-[:focus-visible]:outline"
              >
                <input
                  type="radio"
                  name="text-size"
                  value={size}
                  checked={settings.textSize === size}
                  onChange={() => update('textSize', size)}
                  className="size-6 accent-[var(--color-accent)]"
                />
                {TEXT_SIZES[size].label}
              </label>
            ))}
          </div>
        </fieldset>
      </SettingGroup>

      <SettingGroup title="Reconocimiento">
        <div className="flex flex-col gap-2">
          <label htmlFor="min-confidence" className="text-xl font-bold">
            Confianza mínima: {Math.round(settings.minConfidence * 100)} %
          </label>
          <p id="min-confidence-desc" className="text-base text-muted">
            Por debajo de este valor, la app te pedirá repetir la foto en lugar de darte un resultado dudoso.
          </p>
          <input
            id="min-confidence"
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={settings.minConfidence}
            aria-describedby="min-confidence-desc"
            aria-valuetext={`${Math.round(settings.minConfidence * 100)} por ciento`}
            onChange={(e) => update('minConfidence', Number(e.target.value))}
            className="h-12 w-full accent-[var(--color-accent)]"
          />
        </div>
      </SettingGroup>

      <ActionButton
        icon={RotateCcw}
        variant="ghost"
        onClick={() => {
          reset();
          announce('Configuración restablecida', { speak: false });
        }}
      >
        Restablecer valores
      </ActionButton>
    </div>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-3xl border-2 border-line bg-surface p-5">
      <h2 id={id} className="text-2xl font-black">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

/** Interruptor accesible (role="switch"). */
function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const descId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? descId : undefined}
      onClick={() => onChange(!checked)}
      className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border-2 border-line bg-bg px-4 py-3 text-left"
    >
      <span className="flex flex-col">
        <span className="text-xl font-bold">{label}</span>
        {description && (
          <span id={descId} className="text-base text-muted">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-9 w-16 shrink-0 rounded-full border-2 transition ${
          checked ? 'border-accent bg-accent' : 'border-line bg-surface-2'
        }`}
      >
        <span
          className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full transition-all ${
            checked ? 'left-8 bg-accent-fg' : 'left-1 bg-fg'
          }`}
        />
        <span className="sr-only">{checked ? 'Activado' : 'Desactivado'}</span>
      </span>
    </button>
  );
}
