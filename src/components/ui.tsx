import type { LucideIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Tone = 'default' | 'primary' | 'danger' | 'ghost';

const TONES: Record<Tone, string> = {
  default: 'bg-ink-800 text-ink-100 border-ink-700 hover:bg-ink-750 hover:border-ink-600',
  primary: 'bg-accent text-ink-950 border-accent hover:bg-accent-strong hover:border-accent-strong font-semibold',
  danger: 'bg-danger/10 text-danger border-danger/40 hover:bg-danger/20',
  ghost: 'bg-transparent text-ink-300 border-transparent hover:bg-ink-800 hover:text-ink-100',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: LucideIcon;
  /** Keycaps shown at the end of the button. */
  keys?: string;
}

export function Button({ tone = 'default', icon: Icon, keys, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
      {keys && <kbd className={cx('kbd ml-auto', tone === 'primary' && 'border-ink-950/30 bg-ink-950/15 text-ink-950')}>{keys}</kbd>}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  /** Shortcut shown in the tooltip. */
  hint?: string;
  active?: boolean;
  tipSide?: 'bottom' | 'top' | 'left';
}

const ICON_CONTROL =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-35';

export function IconButton({ icon: Icon, label, hint, active, tipSide = 'bottom', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active}
      data-tip={hint ? `${label} · ${hint}` : label}
      data-tip-side={tipSide}
      className={cx(ICON_CONTROL, active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent', className)}
      {...rest}
    >
      <Icon size={18} strokeWidth={1.9} aria-hidden />
    </button>
  );
}

export interface IconLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  tipSide?: 'bottom' | 'top' | 'left';
  children: ReactNode;
}

/** An icon that leaves the app: same look as IconButton, opens in a new tab. */
export function IconLink({ label, tipSide = 'bottom', className, children, ...rest }: IconLinkProps) {
  return (
    <a
      aria-label={label}
      data-tip={label}
      data-tip-side={tipSide}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(ICON_CONTROL, className)}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Keycaps({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      {keys.map((k, i) => (
        <kbd key={i} className="kbd">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex min-h-0 flex-col', className)}>
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 px-4">
        <h2 className="panel-title">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

