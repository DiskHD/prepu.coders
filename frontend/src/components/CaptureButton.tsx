import { forwardRef } from 'react';
import { Camera as CameraIcon } from 'lucide-react';

interface CaptureButtonProps {
  onCapture: () => void;
  disabled?: boolean;
}

/** Botón de captura: ocupa todo el ancho en la parte inferior, fácil de encontrar al tacto. */
export const CaptureButton = forwardRef<HTMLButtonElement, CaptureButtonProps>(function CaptureButton(
  { onCapture, disabled },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onCapture}
      disabled={disabled}
      aria-label="Capturar foto del billete"
      className="flex min-h-24 w-full items-center justify-center gap-4 rounded-3xl border-4 border-accent bg-accent
        text-2xl font-extrabold uppercase tracking-wider text-accent-fg shadow-lg transition active:scale-[0.98]
        disabled:cursor-not-allowed disabled:opacity-50"
    >
      <CameraIcon aria-hidden="true" className="size-10" strokeWidth={2.5} />
      Capturar
    </button>
  );
});
