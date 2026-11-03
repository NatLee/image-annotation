import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { cx } from '@/lib/cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

/** A native <dialog>: focus trapping, Esc to close and the backdrop come for free. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs before the dialog is shown, so focus here instead.
      (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog).focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      tabIndex={-1}
      className={cx(
        'm-auto outline-none w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 p-0 shadow-2xl shadow-black/60',
        WIDTHS[size],
      )}
    >
      {open && (
        <div className="flex max-h-[min(85dvh,52rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink-100">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2 -mt-1 rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              <X size={18} />
            </button>
          </header>
          {children && <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>}
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-800 bg-ink-850 px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
