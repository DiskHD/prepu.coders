import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: Variant;
  /** Texto secundario debajo de la etiqueta (forma parte del nombre accesible). */
  hint?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg border-accent hover:brightness-110',
  secondary: 'bg-surface text-fg border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-fg border-transparent hover:bg-surface',
};

/** Botón grande y reutilizable: mínimo 64 px de alto, foco muy visible. */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { icon: Icon, variant = 'secondary', hint, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold
        tracking-wide transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" className="size-8 shrink-0" strokeWidth={2.25} />}
      <span className="flex flex-col">
        <span>{children}</span>
        {hint && <span className="text-base font-medium normal-case opacity-85">{hint}</span>}
      </span>
    </button>
  );
});
