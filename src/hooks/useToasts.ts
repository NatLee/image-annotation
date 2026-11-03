import { useCallback, useRef, useState } from 'react';
import { TOAST_MS } from '@/config';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

/** Short messages that replace v1's alert() pop-ups without blocking the page. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, title, detail }]);
      setTimeout(() => dismiss(id), tone === 'error' ? TOAST_MS * 2 : TOAST_MS);
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}
