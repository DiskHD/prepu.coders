import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceAssistant, useVoiceAssistant } from './components/VoiceAssistant';
import { Home } from './pages/Home';
import { Identification } from './pages/Identification';
import { Settings } from './pages/Settings';

export type Route = 'home' | 'identify' | 'settings';

const HASHES: Record<Route, string> = { home: '#/', identify: '#/identificar', settings: '#/configuracion' };
const TITLES: Record<Route, string> = {
  home: 'Billete al Tiro',
  identify: 'Identificar billete · Billete al Tiro',
  settings: 'Configuración · Billete al Tiro',
};

function routeFromHash(): Route {
  const match = (Object.keys(HASHES) as Route[]).find((r) => HASHES[r] === window.location.hash);
  return match ?? 'home';
}

/** Navegación por hash: el botón Atrás del sistema funciona y no hace falta un router. */
function useHashRoute() {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = HASHES[next];
  }, []);

  return { route, navigate };
}

function Shell() {
  const { route, navigate } = useHashRoute();
  const { stop } = useVoiceAssistant();
  const firstRender = useRef(true);

  // Al cambiar de pantalla: cortar la voz, actualizar el título y llevar el foco al encabezado.
  useEffect(() => {
    document.title = TITLES[route];
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stop();
    window.scrollTo(0, 0);
    document.getElementById('page-title')?.focus();
  }, [route, stop]);

  // Escape vuelve al inicio desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && route !== 'home') navigate('home');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, navigate]);

  return (
    <>
      {/* Sin href="#main": cambiaría el hash y con él la ruta. */}
      <button
        type="button"
        className="skip-link"
        onClick={() => document.getElementById('page-title')?.focus()}
      >
        Saltar al contenido
      </button>
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      >
        {route === 'home' && <Home navigate={navigate} />}
        {route === 'identify' && <Identification navigate={navigate} />}
        {route === 'settings' && <Settings navigate={navigate} />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <VoiceAssistant>
        <Shell />
      </VoiceAssistant>
    </SettingsProvider>
  );
}
