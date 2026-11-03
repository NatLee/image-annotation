import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
  });

  it('drops the redo stack on a new commit', () => {
    const h = commit(undo(commit(createHistory(1), 2)), 3);
    expect(h.present).toBe(3);
    expect(canRedo(h)).toBe(false);
    expect(h.past).toEqual([1]);
  });

  it('ignores no-op commits and empty undo/redo', () => {
    const h = createHistory('x');
    expect(commit(h, 'x')).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('keeps at most `limit` undo steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = commit(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
  });
});
