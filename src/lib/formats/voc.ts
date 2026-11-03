import { newBoxId } from '@/lib/ids';
import { annotationPaths, baseName, dirName, exportFileName } from '@/lib/paths';
import type { AnnotationSession, BoundingBox } from '@/types';
import type { ImportedImage } from './imported';

/**
 * Pascal VOC XML, one `Annotations/<image>.xml` per image. Corners are
 * `xmin = x`, `xmax = x + width`, the same convention LabelImg and CVAT use.
 */

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function toVocXml(record: AnnotationSession): string {
  const name = exportFileName(record.image_url);
  const objects = record.bounding_boxes.map((b) =>
    [
      '  <object>',
      `    <name>${escapeXml(b.label)}</name>`,
      '    <pose>Unspecified</pose>',
      '    <truncated>0</truncated>',
      '    <difficult>0</difficult>',
      '    <bndbox>',
      `      <xmin>${b.x}</xmin>`,
      `      <ymin>${b.y}</ymin>`,
      `      <xmax>${b.x + b.width}</xmax>`,
      `      <ymax>${b.y + b.height}</ymax>`,
      '    </bndbox>',
      '  </object>',
    ].join('\n'),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<annotation>',
    `  <folder>${escapeXml(dirName(name))}</folder>`,
    `  <filename>${escapeXml(baseName(name))}</filename>`,
    `  <path>${escapeXml(record.image_url)}</path>`,
    '  <source>',
    '    <database>image-annotation</database>',
    '  </source>',
    '  <size>',
    `    <width>${record.original_size.width}</width>`,
    `    <height>${record.original_size.height}</height>`,
    '    <depth>3</depth>',
    '  </size>',
    '  <segmented>0</segmented>',
    ...objects,
    '</annotation>',
    '',
  ].join('\n');
}

export function toVocFiles(records: readonly AnnotationSession[]): Record<string, string> {
  const paths = annotationPaths(records.map((r) => r.image_url), 'Annotations', 'xml');
  return Object.fromEntries(records.map((r) => [paths.get(r.image_url)!, toVocXml(r)]));
}

/** Parses one VOC file. `parseXml` is the browser's DOMParser in the app. */
export function readVoc(xml: string, parseXml: (xml: string) => Document): ImportedImage | undefined {
  const doc = parseXml(xml);
  const root = doc.querySelector('annotation');
  if (!root || doc.querySelector('parsererror')) return undefined;
  const text = (parent: Element, selector: string) => parent.querySelector(selector)?.textContent?.trim() ?? '';
  const number = (parent: Element, selector: string) => Number(text(parent, selector));

  // <path> first (this app writes the image id there), then <folder>/<filename>.
  const filename = text(root, ':scope > filename');
  const folder = text(root, ':scope > folder');
  const reference = text(root, ':scope > path') || (folder && filename ? `${folder}/${filename}` : filename);
  if (!reference) return undefined;

  const sizeEl = root.querySelector(':scope > size');
  const width = sizeEl ? number(sizeEl, 'width') : 0;
  const height = sizeEl ? number(sizeEl, 'height') : 0;

  const boxes: BoundingBox[] = [];
  for (const obj of root.querySelectorAll(':scope > object')) {
    const bnd = obj.querySelector('bndbox');
    if (!bnd) continue;
    const [xmin, ymin, xmax, ymax] = ['xmin', 'ymin', 'xmax', 'ymax'].map((k) => number(bnd, k));
    if (![xmin, ymin, xmax, ymax].every(Number.isFinite) || xmax <= xmin || ymax <= ymin) continue;
    boxes.push({ id: newBoxId(), x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, label: text(obj, ':scope > name') || 'object' });
  }

  return {
    reference,
    size: width > 0 && height > 0 ? { width, height } : undefined,
    boxes: () => boxes,
  };
}
