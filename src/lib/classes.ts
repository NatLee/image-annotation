import { DEFAULT_LABEL, PALETTE } from '@/config';
import type { LabelClass } from '@/types';

export const DEFAULT_CLASSES: LabelClass[] = [{ name: DEFAULT_LABEL, color: PALETTE[0] }];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** First palette colour not taken yet (cycles when all are used). */
function nextColor(classes: readonly LabelClass[]): string {
  const used = new Set(classes.map((c) => c.color.toLowerCase()));
  return PALETTE.find((color) => !used.has(color)) ?? PALETTE[classes.length % PALETTE.length];
}

/** Add any labels that are not classes yet, in order, with fresh colours. */
export function ensureClasses(classes: readonly LabelClass[], labels: Iterable<string>): LabelClass[] {
  const result = [...classes];
  const known = new Set(result.map((c) => c.name));
  for (const raw of labels) {
    const name = raw.trim();
    if (!name || known.has(name)) continue;
    known.add(name);
    result.push({ name, color: nextColor(result) });
  }
  return result.length === classes.length ? (classes as LabelClass[]) : result;
}

/** Validate classes read from storage; fall back to the defaults. */
export function normalizeClasses(raw: unknown): LabelClass[] {
  if (!Array.isArray(raw)) return DEFAULT_CLASSES;
  const seen = new Set<string>();
  const classes: LabelClass[] = [];
  for (const item of raw) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const color = typeof item.color === 'string' && HEX_COLOR.test(item.color) ? item.color : nextColor(classes);
    classes.push({ name, color });
  }
  return classes.length ? classes : DEFAULT_CLASSES;
}

/** Colour for a label; labels without a class get a stable palette colour. */
export function colorFor(classes: readonly LabelClass[], label: string): string {
  const found = classes.find((c) => c.name === label);
  if (found) return found.color;
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
