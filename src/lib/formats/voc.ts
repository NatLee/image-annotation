import { newBoxId } from '@/lib/ids';
import { annotationPaths, baseName, dirName, exportFileName } from '@/lib/paths';
import { readCredit } from '@/lib/records';
import type { AnnotationSession, BoundingBox, ImageCredit } from '@/types';
import type { ImportedImage } from './imported';

/**
 * Pascal VOC XML, one `Annotations/<image>.xml` per image. Corners are
 * `xmin = x`, `xmax = x + width`, the same convention LabelImg and CVAT use.
 */

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** Online images: the provider, post and original source go in <source>, the artist in <owner>. */
function creditXml(credit: ImageCredit | undefined): string[] {
  if (!credit) return ['  <source>', '    <database>image-annotation</database>', '  </source>'];
  const optional = (tag: string, value: string | undefined) => (value ? [`    <${tag}>${escapeXml(value)}</${tag}>`] : []);
  return [
    '  <source>',
    '    <database>image-annotation</database>',
    `    <provider>${escapeXml(credit.provider)}</provider>`,
    ...optional('post_url', credit.post_url),
    ...optional('source_url', credit.source_url),
    '  </source>',
    ...(credit.artist ? ['  <owner>', `    <name>${escapeXml(credit.artist)}</name>`, '  </owner>'] : []),
  ];
}

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
    ...creditXml(record.credit),
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

/** Child elements by tag name; no CSS selectors, so any XML parser behaves the same. */
const childrenNamed = (parent: Element, name: string) => [...parent.children].filter((c) => c.tagName === name);

/** Text at a path of child tags, e.g. `textAt(root, 'source', 'post_url')`. */
function textAt(parent: Element, ...path: string[]): string {
  let element: Element | undefined = parent;
  for (const name of path) element = element && childrenNamed(element, name)[0];
  return element?.textContent?.trim() ?? '';
}

/** Parses one VOC file. `parseXml` is the browser's DOMParser in the app. */
export function readVoc(xml: string, parseXml: (xml: string) => Document): ImportedImage | undefined {
  const doc = parseXml(xml);
  const root = doc.documentElement;
  if (!root || root.tagName !== 'annotation' || doc.getElementsByTagName('parsererror').length) return undefined;
  const number = (parent: Element, ...path: string[]) => Number(textAt(parent, ...path));

  // <path> first (this app writes the image id there), then <folder>/<filename>.
  const filename = textAt(root, 'filename');
  const folder = textAt(root, 'folder');
  const reference = textAt(root, 'path') || (folder && filename ? `${folder}/${filename}` : filename);
  if (!reference) return undefined;

  const width = number(root, 'size', 'width');
  const height = number(root, 'size', 'height');

  const boxes: BoundingBox[] = [];
  for (const obj of childrenNamed(root, 'object')) {
    const [xmin, ymin, xmax, ymax] = ['xmin', 'ymin', 'xmax', 'ymax'].map((k) => number(obj, 'bndbox', k));
    if (![xmin, ymin, xmax, ymax].every(Number.isFinite) || xmax <= xmin || ymax <= ymin) continue;
    boxes.push({ id: newBoxId(), x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin, label: textAt(obj, 'name') || 'object' });
  }

  const credit = readCredit({
    provider: textAt(root, 'source', 'provider'),
    artist: textAt(root, 'owner', 'name') || undefined,
    post_url: textAt(root, 'source', 'post_url'),
    source_url: textAt(root, 'source', 'source_url'),
  });

  return {
    reference,
    size: width > 0 && height > 0 ? { width, height } : undefined,
    boxes: () => boxes,
    credit,
  };
}
