import { useEffect, useRef } from 'react';
import { BookOpen, ScanLine, Settings as SettingsIcon } from 'lucide-react';
import { ActionButton } from '../components/ActionButton';
import { useVoiceAssistant } from '../components/VoiceAssistant';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { SPOKEN } from '../utils/messages';
import type { Route } from '../App';

interface HomeProps {
  navigate: (route: Route) => void;
}

export function Home({ navigate }: HomeProps) {
  const { announce, speak } = useVoiceAssistant();
  const backend = useBackendStatus();
  const welcomed = useRef(false);

  useEffect(() => {
    if (backend === 'checking' || welcomed.current) return;
    welcomed.current = true;
    // Muchos navegadores móviles bloquean la voz hasta el primer toque;
    // el texto igualmente llega al lector de pantalla por aria-live.
    announce(backend === 'offline' ? `${SPOKEN.welcome} ${SPOKEN.backendOffline}` : SPOKEN.welcome);
  }, [announce, backend]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex flex-col items-center gap-4 pt-6 text-center">
        <img src="/logo.svg" alt="" className="size-24" />
        <h1 id="page-title" tabIndex={-1} className="text-5xl font-black tracking-tight">
          Billete al Tiro
        </h1>
        <p className="max-w-sm text-xl text-muted">Apunta la cámara a un billete y te diré cuánto vale.</p>
      </header>

      {backend === 'offline' && (
        <p className="rounded-2xl border-2 border-danger bg-surface p-4 text-lg font-semibold">
          Sin conexión con el servidor de reconocimiento: el reconocimiento real todavía no está disponible.
        </p>
      )}

      <nav aria-label="Acciones principales" className="mt-auto flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('identify')}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-3xl border-4 border-accent bg-accent
            px-6 py-6 text-3xl font-black tracking-wide text-accent-fg shadow-lg transition active:scale-[0.98]"
        >
          <ScanLine aria-hidden="true" className="size-14" strokeWidth={2.5} />
          IDENTIFICAR BILLETE
        </button>
        <ActionButton icon={BookOpen} onClick={() => speak(SPOKEN.instructions)}>
          ESCUCHAR INSTRUCCIONES
        </ActionButton>
        <ActionButton icon={SettingsIcon} onClick={() => navigate('settings')}>
          CONFIGURACIÓN
        </ActionButton>
      </nav>

      <p className="text-center text-base text-muted" aria-live="polite">
        {backend === 'checking' && 'Comprobando el servidor…'}
        {backend === 'online' && 'Servidor de reconocimiento conectado.'}
      </p>
    </div>
  );
}
