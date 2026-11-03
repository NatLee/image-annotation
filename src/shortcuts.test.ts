import { describe, expect, it } from 'vitest';
import { type Commands, comboOf, findShortcut, hint, keycapsOf, SHORTCUTS } from './shortcuts';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) =>
  comboOf({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

describe('shortcuts', () => {
  it('names key events consistently', () => {
    expect(key('z', { ctrlKey: true })).toBe('mod+z');
    expect(key('Z', { metaKey: true, shiftKey: true })).toBe('mod+shift+z');
    expect(key('?', { shiftKey: true })).toBe('?'); // Shift is how you type "?"
    expect(key('ArrowLeft', { shiftKey: true })).toBe('shift+arrowleft');
    expect(key(' ')).toBe('space');
  });

  it('never binds one combo twice', () => {
    const combos = SHORTCUTS.flatMap((s) => s.combos);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it('keeps the v1 keys: Delete removes a box, d toggles the grid', () => {
    expect(findShortcut('delete')?.id).toBe('deleteBox');
    expect(findShortcut('d')?.id).toBe('grid');
  });

  it('routes keys to commands with the right arguments', () => {
    const calls: string[] = [];
    const commands = new Proxy({} as Commands, {
      get: (_, name) => (...args: unknown[]) => calls.push(`${String(name)}(${args.join(',')})`),
    });
    for (const combo of ['3', 'shift+arrowup', 'arrowright', 'shift+tab', 'mod+y', ']']) findShortcut(combo)!.run(commands, combo);
    expect(calls).toEqual(['pickClass(2)', 'nudge(0,-10)', 'nudge(1,0)', 'cycleBox(-1)', 'redo()', 'step(1)']);
  });

  it('shows readable keycaps', () => {
    expect(keycapsOf('mod+shift+z')).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(keycapsOf('+')).toEqual(['+']);
    expect(hint('undo')).toBe('Ctrl+Z');
    expect(hint('pickClass')).toBe('1 … 9');
  });
});

describe('README', () => {
  it('lists every shortcut, so the docs match the keys', async () => {
    const { readFileSync } = await import('node:fs');
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    for (const shortcut of SHORTCUTS) expect(readme, shortcut.label).toContain(`| ${shortcut.label} |`);
  });
});
