import { HISTORY_LIMIT } from '@/config';

/** Undo/redo stack for immutable values. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** Record a new present. Clears the redo stack; keeps at most `limit` undo steps. */
export function commit<T>(history: History<T>, next: T, limit: number = HISTORY_LIMIT): History<T> {
  if (Object.is(next, history.present)) return history;
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

export const canUndo = (history: History<unknown> | undefined) => !!history?.past.length;
export const canRedo = (history: History<unknown> | undefined) => !!history?.future.length;
