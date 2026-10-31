import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  label?: string;
}

/** Indicador de procesamiento. El anuncio por voz lo hace la página que lo usa. */
export function LoadingIndicator({ label = 'Analizando el billete…' }: LoadingIndicatorProps) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col items-center gap-5 py-10 text-center">
      <Loader2 aria-hidden="true" className="size-20 animate-spin text-accent motion-reduce:animate-none" strokeWidth={2.5} />
      <p className="text-2xl font-bold">{label}</p>
      <p className="text-lg text-muted">Esto puede tardar unos segundos.</p>
    </div>
  );
}
