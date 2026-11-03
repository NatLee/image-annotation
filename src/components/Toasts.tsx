import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import type { Toast } from '@/hooks/useToasts';
import { cx } from '@/lib/cx';

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };
const COLORS = { info: 'text-sky-400', success: 'text-accent', error: 'text-danger' };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-[toast-in_0.18s_ease-out] items-start gap-3 rounded-xl border border-ink-700 bg-ink-850/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur"
          >
            <Icon size={18} className={cx('mt-0.5 shrink-0', COLORS[toast.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-100">{toast.title}</p>
              {toast.detail && <p className="mt-0.5 text-xs text-ink-400">{toast.detail}</p>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)} className="-mr-1 rounded p-1 text-ink-500 hover:text-ink-200">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
