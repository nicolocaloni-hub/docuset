import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { DeliveryStatus } from '../types';

/* ---------- Bottoni ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-manila-ink',
  secondary: 'bg-card text-ink border border-line hover:border-ink/50',
  ghost: 'text-ink-soft hover:text-ink hover:bg-ink/5',
  danger: 'bg-cue text-card hover:bg-cue/90',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: React.ReactNode }> = ({
  variant = 'primary', icon, className = '', children, type = 'button', ...props
}) => (
  <button
    type={type}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'default' | 'danger' | 'go' }> = ({
  label, tone = 'default', className = '', children, type = 'button', ...props
}) => {
  const toneClass = tone === 'danger' ? 'hover:text-cue hover:bg-cue/10'
    : tone === 'go' ? 'text-st-delivered hover:bg-st-delivered/10'
    : 'hover:text-ink hover:bg-ink/5';
  return (
    <button type={type} aria-label={label} title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] text-ink-soft transition-colors ${toneClass} ${className}`} {...props}>
      {children}
    </button>
  );
};

/* ---------- Campi ---------- */

export const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
    {children}
    {hint && <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>}
  </label>
);

export const inputClass = 'w-full min-h-11 rounded-[3px] border border-line bg-card px-3 py-2 text-base text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-ink sm:text-sm';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => <input ref={ref} className={`${inputClass} ${className}`} {...props} />,
);

/* ---------- Modale (sheet dal basso su telefono) ---------- */

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, footer, wide }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title}
        className={`animate-enter flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[6px] bg-paper sm:rounded-[4px] shadow-[0_-8px_32px_rgba(42,37,29,0.18)] sm:shadow-[0_16px_48px_rgba(42,37,29,0.25)] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between gap-4 border-b border-line bg-paper-deep px-5 py-3 text-ink">
          <h2 className="font-display text-2xl font-bold leading-none">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="-mr-2 inline-flex h-10 w-10 items-center justify-center text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
};

/* ---------- Schede e timbri ---------- */

/** `band`: colore pieno (linguetta, legenda); `chip`: colore del timbro. */
export const STATUS_META: Record<DeliveryStatus, { label: string; band: string; chip: string }> = {
  delivered: { label: 'Consegnato', band: 'bg-st-delivered', chip: 'text-st-delivered' },
  solicited: { label: 'Sollecitato', band: 'bg-st-solicited', chip: 'text-st-solicited' },
  sent: { label: 'Inviato', band: 'bg-st-sent', chip: 'text-st-sent' },
  todo: { label: 'Da inviare', band: 'bg-st-todo', chip: 'text-st-todo' },
};

export const StatusChip: React.FC<{ status: DeliveryStatus }> = ({ status }) => (
  <span className={`stamp inline-flex items-center whitespace-nowrap rounded-[3px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${STATUS_META[status].chip}`}>
    {STATUS_META[status].label}
  </span>
);

/** Scheda come un foglio in un faldone: linguetta colorata in alto a sinistra. */
export const Strip: React.FC<{ band: string; onClick?: () => void; children: React.ReactNode }> = ({ band, onClick, children }) => (
  <div
    onClick={onClick}
    className={`relative rounded-[3px] bg-card shadow-[0_1px_0_var(--color-line),0_2px_6px_rgba(42,37,29,0.06)] ${onClick ? 'cursor-pointer transition-shadow hover:shadow-[0_1px_0_var(--color-line),0_4px_12px_rgba(42,37,29,0.12)]' : ''}`}
  >
    <span aria-hidden className={`absolute left-4 top-0 h-[5px] w-11 rounded-b-[3px] ${band}`} />
    <div className="flex min-w-0 items-center gap-3 px-3 pb-2.5 pt-3 sm:px-4">{children}</div>
  </div>
);

/** Pila di schede separate. */
export const Board: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-2.5">{children}</div>
);

export const EmptyState: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="rounded-[3px] border border-dashed border-line bg-card/50 px-6 py-12 text-center">
    <p className="font-display text-2xl font-bold">{title}</p>
    <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{text}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const PageHeader: React.FC<{ title: string; text?: string; actions?: React.ReactNode }> = ({ title, text, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="font-display text-[2.1rem] leading-[1.05] sm:text-[2.6rem]">{title}</h1>
      {text && <p className="mt-2 max-w-xl text-sm text-ink-soft">{text}</p>}
    </div>
    {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
  </div>
);

/* ---------- Toast ---------- */

type Toast = { id: number; text: string; tone: 'info' | 'error' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, text, tone }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), tone === 'error' ? 8000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
            className={`animate-enter pointer-events-auto flex max-w-md items-start gap-3 rounded-[3px] px-4 py-3 text-sm shadow-lg ${t.tone === 'error' ? 'bg-cue text-card' : 'bg-ink text-paper'}`}>
            <span className="flex-1">{t.text}</span>
            <button type="button" aria-label="Chiudi avviso" className="opacity-70 hover:opacity-100" onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
