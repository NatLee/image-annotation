import { BOX } from '@/config';

/**
 * Keyboard shortcuts. This one table drives the key handler and the help
 * dialog, so what the help says is what the keys do.
 */

export interface Commands {
  addBox(): void;
  deleteBox(): void;
  cycleBox(delta: 1 | -1): void;
  deselect(): void;
  nudge(dx: number, dy: number): void;
  pickClass(index: number): void;
  undo(): void;
  redo(): void;
  submit(): void;
  step(delta: 1 | -1): void;
  random(): void;
  openFiles(): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  toggleGrid(): void;
  help(): void;
}

export type ShortcutGroup = 'Boxes' | 'Images' | 'View';

export interface Shortcut {
  id: string;
  group: ShortcutGroup;
  label: string;
  /** Normalised combos, e.g. `mod+shift+z`, `arrowleft`, `?`. */
  combos: string[];
  /** Keycaps to show instead of one per combo. */
  keycaps?: string[];
  run: (commands: Commands, combo: string) => void;
}

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const SHORTCUTS: readonly Shortcut[] = [
  { group: 'Boxes', id: 'addBox', label: 'Add a box (centred, or next to the last one)', combos: ['n'], run: (c) => c.addBox() },
  { group: 'Boxes', id: 'deleteBox', label: 'Delete the selected box (or the last one)', combos: ['delete', 'backspace'], run: (c) => c.deleteBox() },
  { group: 'Boxes', id: 'cycleBox', label: 'Select the next / previous box', combos: ['tab', 'shift+tab'], run: (c, k) => c.cycleBox(k === 'tab' ? 1 : -1) },
  { group: 'Boxes', id: 'deselect', label: 'Deselect', combos: ['escape'], run: (c) => c.deselect() },
  {
    group: 'Boxes', id: 'nudge',
    label: `Move the selected box by ${BOX.nudge} px`,
    combos: Object.keys(ARROWS),
    keycaps: ['←', '↑', '→', '↓'],
    run: (c, k) => c.nudge(ARROWS[k][0] * BOX.nudge, ARROWS[k][1] * BOX.nudge),
  },
  {
    group: 'Boxes', id: 'nudgeLarge',
    label: `… by ${BOX.nudgeLarge} px`,
    combos: Object.keys(ARROWS).map((k) => `shift+${k}`),
    keycaps: ['Shift', '←↑→↓'],
    run: (c, k) => {
      const [dx, dy] = ARROWS[k.replace('shift+', '')];
      c.nudge(dx * BOX.nudgeLarge, dy * BOX.nudgeLarge);
    },
  },
  { group: 'Boxes', id: 'pickClass', label: 'Pick a class (relabels the selected box)', combos: DIGITS, keycaps: ['1', '…', '9'], run: (c, k) => c.pickClass(Number(k) - 1) },
  { group: 'Boxes', id: 'undo', label: 'Undo', combos: ['mod+z'], run: (c) => c.undo() },
  { group: 'Boxes', id: 'redo', label: 'Redo', combos: ['mod+shift+z', 'mod+y'], run: (c) => c.redo() },

  { group: 'Images', id: 'submit', label: 'Submit and go to the next image', combos: ['enter'], run: (c) => c.submit() },
  { group: 'Images', id: 'next', label: 'Next image', combos: [']', 'pagedown'], run: (c) => c.step(1) },
  { group: 'Images', id: 'previous', label: 'Previous image', combos: ['[', 'pageup'], run: (c) => c.step(-1) },
  { group: 'Images', id: 'random', label: 'Fetch a random online image', combos: ['r'], run: (c) => c.random() },
  { group: 'Images', id: 'openFiles', label: 'Open image files', combos: ['o'], run: (c) => c.openFiles() },

  { group: 'View', id: 'zoomIn', label: 'Zoom in', combos: ['=', '+'], run: (c) => c.zoomIn() },
  { group: 'View', id: 'zoomOut', label: 'Zoom out', combos: ['-'], run: (c) => c.zoomOut() },
  { group: 'View', id: 'fit', label: 'Fit the image to the screen', combos: ['0', 'f'], run: (c) => c.fit() },
  { group: 'View', id: 'grid', label: 'Show or hide the 10 × 10 grid', combos: ['d'], run: (c) => c.toggleGrid() },
  { group: 'View', id: 'help', label: 'Show shortcuts and help', combos: ['?'], run: (c) => c.help() },
];

/** Mouse gestures, listed in the help next to the keys. */
export const GESTURES: readonly { keycaps: string[]; label: string }[] = [
  { keycaps: ['Drag'], label: 'Draw a box on an empty part of the image' },
  { keycaps: ['Drag box'], label: 'Move it; drag a handle to resize' },
  { keycaps: ['Wheel'], label: 'Zoom at the cursor' },
  { keycaps: ['Space', 'Drag'], label: 'Pan (or drag with the middle button)' },
];

/** `ctrl+shift+z` style name for a key event. Shift is ignored for symbols like `?` and `+`. */
export function comboOf(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string {
  const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
  const symbol = e.key.length === 1 && !/[a-z0-9]/i.test(e.key);
  return [(e.ctrlKey || e.metaKey) && 'mod', e.altKey && 'alt', e.shiftKey && !symbol && 'shift', key].filter(Boolean).join('+');
}

const index = new Map(SHORTCUTS.flatMap((s) => s.combos.map((combo) => [combo, s] as const)));

export const findShortcut = (combo: string) => index.get(combo);

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

const KEY_NAMES: Record<string, string> = {
  mod: isMac ? '⌘' : 'Ctrl',
  shift: 'Shift',
  alt: isMac ? '⌥' : 'Alt',
  enter: 'Enter',
  escape: 'Esc',
  delete: 'Del',
  backspace: '⌫',
  tab: 'Tab',
  pagedown: 'PgDn',
  pageup: 'PgUp',
};

/** Keycaps for one combo: `mod+shift+z` → ['Ctrl', 'Shift', 'Z']. */
export const keycapsOf = (combo: string) => combo.split(/\+(?!$)/).map((part) => KEY_NAMES[part] ?? part.toUpperCase());

/** The first combo of a shortcut, for button tooltips: `hint('undo')` → "Ctrl+Z". */
export function hint(id: string): string {
  const shortcut = SHORTCUTS.find((s) => s.id === id);
  if (!shortcut) throw new Error(`Unknown shortcut "${id}"`);
  return (shortcut.keycaps ?? keycapsOf(shortcut.combos[0])).join(shortcut.keycaps ? ' ' : '+');
}
