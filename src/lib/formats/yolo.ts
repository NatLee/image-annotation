import { newBoxId } from '@/lib/ids';
import { annotationPaths } from '@/lib/paths';
import type { AnnotationSession, BoundingBox, LabelClass, Size } from '@/types';
import { categoriesFor } from './coco';

/**
 * YOLO / Ultralytics detection labels: one `labels/<image>.txt` per image,
 * one `class cx cy w h` line per box, all normalised to 0–1.
 */

const DECIMALS = 6;
const fmt = (n: number) => Number(n.toFixed(DECIMALS)).toString();

export function toYoloFiles(records: readonly AnnotationSession[], classes: readonly LabelClass[]): Record<string, string> {
  const names = categoriesFor(records, classes);
  const index = new Map(names.map((name, i) => [name, i]));
  const paths = annotationPaths(records.map((r) => r.image_url), 'labels', 'txt');
  const files: Record<string, string> = {
    'classes.txt': `${names.join('\n')}\n`,
    'data.yaml': [
      '# Class names for Ultralytics YOLO. Add `path`, `train` and `val` for your image folders.',
      `nc: ${names.length}`,
      'names:',
      ...names.map((name, i) => `  ${i}: ${JSON.stringify(name)}`),
      '',
    ].join('\n'),
  };
  for (const record of records) {
    const { width: W, height: H } = record.original_size;
    files[paths.get(record.image_url)!] = record.bounding_boxes
      .map((b) => [index.get(b.label), fmt((b.x + b.width / 2) / W), fmt((b.y + b.height / 2) / H), fmt(b.width / W), fmt(b.height / H)].join(' '))
      .join('\n')
      .concat(record.bounding_boxes.length ? '\n' : '');
  }
  return files;
}

/** Reads `names:` from a data.yaml: inline list, block list or index map. */
export function parseYamlNames(text: string): string[] | undefined {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^names\s*:/.test(l));
  if (at < 0) return undefined;
  const unquote = (s: string) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

  const inline = lines[at].replace(/^names\s*:\s*/, '').replace(/\s+#.*$/, '').trim();
  if (inline.startsWith('[')) {
    return inline.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
  }
  if (inline.startsWith('{')) {
    return inline
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((pair) => pair.split(':'))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map((pair) => unquote(pair.slice(1).join(':')));
  }

  const names: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (!/^\s+\S/.test(line)) break; // the block ends at the next top-level key
    const item = /^\s+-\s*(.+)$/.exec(line);
    const pair = /^\s+(\d+)\s*:\s*(.+)$/.exec(line);
    if (item) names.push(unquote(item[1]));
    else if (pair) names[Number(pair[1])] = unquote(pair[2]);
  }
  return names.length ? Array.from(names, (n, i) => n ?? `class_${i}`) : undefined;
}

/** Class names from `classes.txt` / `obj.names` (one per line) or `*.yaml`. */
export function parseClassNames(path: string, text: string): string[] | undefined {
  if (/\.ya?ml$/i.test(path)) return parseYamlNames(text);
  const names = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return names.length ? names : undefined;
}

export const isClassNamesFile = (path: string) => /(^|\/)(classes\.txt|[^/]*\.names|[^/]*\.ya?ml)$/i.test(path);

/** Every non-empty line is numbers only, at least five of them. An empty file is a valid "no objects" label. */
export const isYoloLabelText = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .every((l) => {
      const parts = l.trim().split(/\s+/);
      return parts.length >= 5 && parts.every((p) => Number.isFinite(Number(p)));
    });

/** Boxes from one label file, in image pixels. Segmentation lines (polygons) become their bounding box. */
export function readYoloLabels(text: string, size: Size, names: readonly string[]): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/).map(Number);
    if (parts.length < 5 || parts.some((n) => !Number.isFinite(n))) continue;
    const [cls, ...coords] = parts;
    let cx: number, cy: number, w: number, h: number;
    if (coords.length === 4) {
      [cx, cy, w, h] = coords;
    } else {
      const xs = coords.filter((_, i) => i % 2 === 0);
      const ys = coords.filter((_, i) => i % 2 === 1);
      w = Math.max(...xs) - Math.min(...xs);
      h = Math.max(...ys) - Math.min(...ys);
      cx = Math.min(...xs) + w / 2;
      cy = Math.min(...ys) + h / 2;
    }
    if (!(w > 0 && h > 0)) continue;
    boxes.push({
      id: newBoxId(),
      x: Math.round((cx - w / 2) * size.width),
      y: Math.round((cy - h / 2) * size.height),
      width: Math.round(w * size.width),
      height: Math.round(h * size.height),
      label: names[cls] ?? `class_${cls}`,
    });
  }
  return boxes;
}
