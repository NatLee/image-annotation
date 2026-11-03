import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { IMPORTED_ANNOTATOR } from '@/config';
import { newSessionId } from '@/lib/ids';
import { findImageKey } from '@/lib/paths';
import { readRecordList } from '@/lib/records';
import type { AnnotationData, AnnotationSession, LabelClass, Size } from '@/types';
import { isCoco, readCoco, toCoco } from './coco';
import type { ImportedImage } from './imported';
import { toLegacyExport } from './legacy';
import { readVoc, toVocFiles } from './voc';
import { isClassNamesFile, isYoloLabelText, parseClassNames, readYoloLabels, toYoloFiles } from './yolo';

/* ------------------------------------------------------------------------ */
/* Export                                                                   */
/* ------------------------------------------------------------------------ */

export type ExportFormat = 'json' | 'coco' | 'yolo' | 'voc';

export interface FormatInfo {
  id: ExportFormat;
  label: string;
  description: string;
  /** `date` is YYYY-MM-DD (UTC), like v1's file name. */
  fileName: (date: string) => string;
}

export const FORMATS: readonly FormatInfo[] = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Everything, in the original export format. Imports back without loss.',
    fileName: (date) => `all_annotations_${date}.json`,
  },
  {
    id: 'coco',
    label: 'COCO',
    description: 'One JSON file with images, annotations and categories.',
    fileName: (date) => `coco_annotations_${date}.json`,
  },
  {
    id: 'yolo',
    label: 'YOLO',
    description: 'ZIP with labels/*.txt, classes.txt and data.yaml.',
    fileName: (date) => `yolo_labels_${date}.zip`,
  },
  {
    id: 'voc',
    label: 'Pascal VOC',
    description: 'ZIP with one Annotations/*.xml per image.',
    fileName: (date) => `voc_annotations_${date}.zip`,
  },
];

export interface ExportFile {
  fileName: string;
  mime: string;
  bytes: Uint8Array;
}

const jsonBytes = (value: unknown) => strToU8(JSON.stringify(value, null, 2));
const zipBytes = (files: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])));

export function buildExport(
  format: ExportFormat,
  data: AnnotationData,
  classes: readonly LabelClass[],
  now: Date,
): ExportFile {
  const iso = now.toISOString();
  const fileName = FORMATS.find((f) => f.id === format)!.fileName(iso.split('T')[0]);
  const records = data.annotation_records;
  switch (format) {
    case 'json':
      return { fileName, mime: 'application/json', bytes: jsonBytes(toLegacyExport(data, iso)) };
    case 'coco':
      return { fileName, mime: 'application/json', bytes: jsonBytes(toCoco(records, classes, iso)) };
    case 'yolo':
      return { fileName, mime: 'application/zip', bytes: zipBytes(toYoloFiles(records, classes)) };
    case 'voc':
      return { fileName, mime: 'application/zip', bytes: zipBytes(toVocFiles(records)) };
  }
}

/* ------------------------------------------------------------------------ */
/* Import                                                                   */
/* ------------------------------------------------------------------------ */

export interface InputFile {
  path: string;
  bytes: Uint8Array;
}

export interface KnownImage {
  key: string;
  size?: Size;
}

export interface ImportContext {
  /** Images currently in the list; imported references are matched against them. */
  images: readonly KnownImage[];
  /** Class names to use for YOLO ids when no classes.txt / data.yaml is included. */
  classNames: readonly string[];
  now: Date;
  parseXml?: (xml: string) => Document;
}

export interface ImportResult {
  records: AnnotationSession[];
  formats: string[];
  /** References with no matching image (YOLO needs the image for its size). */
  unmatched: string[];
  /** Images in the files that have no boxes. */
  skipped: number;
  /** Files that are not annotation files. */
  ignored: string[];
}

const IGNORED_ZIP_ENTRIES = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

/** Replace each .zip by the files inside it. */
export function expandZips(files: readonly InputFile[]): InputFile[] {
  return files.flatMap((file) => {
    if (!/\.zip$/i.test(file.path)) return [file];
    const entries = unzipSync(file.bytes);
    return Object.entries(entries)
      .filter(([path]) => !path.endsWith('/') && !IGNORED_ZIP_ENTRIES.test(path))
      .map(([path, bytes]) => ({ path, bytes }));
  });
}

const browserXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

/** YOLO label path → image stem: `ds/labels/train/a.txt` → `train/a`. */
const yoloReference = (path: string) => path.replace(/\\/g, '/').replace(/^(.*\/)?labels\//, '').replace(/\.txt$/i, '');

export function importFiles(files: readonly InputFile[], ctx: ImportContext): ImportResult {
  const nowIso = ctx.now.toISOString();
  const keys = ctx.images.map((i) => i.key);
  const sizeOf = new Map(ctx.images.map((i) => [i.key, i.size]));
  const result: ImportResult = { records: [], formats: [], unmatched: [], skipped: 0, ignored: [] };
  const found = new Set<string>();
  const imported: { image: ImportedImage; yolo: boolean }[] = [];

  const all = expandZips(files);
  const classFile = all.find((f) => isClassNamesFile(f.path) && parseClassNames(f.path, strFromU8(f.bytes)));
  const yoloNames = classFile ? parseClassNames(classFile.path, strFromU8(classFile.bytes))! : ctx.classNames;

  for (const file of all) {
    const text = () => strFromU8(file.bytes);
    if (/\.json$/i.test(file.path)) {
      let json: unknown;
      try {
        json = JSON.parse(text());
      } catch {
        result.ignored.push(file.path);
        continue;
      }
      if (isCoco(json)) {
        const coco = readCoco(json);
        imported.push(...coco.images.map((image) => ({ image, yolo: false })));
        result.skipped += coco.skipped;
        found.add('COCO');
        continue;
      }
      const records = readRecordList(json, nowIso);
      if (!records) {
        result.ignored.push(file.path);
        continue;
      }
      // Our own JSON: already in record form, only the image ids may need matching.
      for (const record of records) {
        if (!record.bounding_boxes.length) result.skipped++;
        else result.records.push({ ...record, image_url: findImageKey(record.image_url, keys) ?? record.image_url });
      }
      found.add('JSON');
    } else if (/\.xml$/i.test(file.path)) {
      const voc = readVoc(text(), ctx.parseXml ?? browserXml);
      if (!voc) result.ignored.push(file.path);
      else {
        imported.push({ image: voc, yolo: false });
        found.add('Pascal VOC');
      }
    } else if (/\.txt$/i.test(file.path) && !isClassNamesFile(file.path)) {
      const labels = text();
      if (!isYoloLabelText(labels)) {
        result.ignored.push(file.path);
        continue;
      }
      imported.push({
        image: { reference: yoloReference(file.path), boxes: (size) => readYoloLabels(labels, size, yoloNames) },
        yolo: true,
      });
      found.add('YOLO');
    } else if (!isClassNamesFile(file.path)) {
      result.ignored.push(file.path);
    }
  }

  for (const { image, yolo } of imported) {
    const key = findImageKey(image.reference, keys, { ignoreExtension: yolo }) ?? (yolo ? undefined : image.reference);
    const size = image.size ?? (key ? sizeOf.get(key) : undefined);
    if (!key || !size) {
      result.unmatched.push(image.reference);
      continue;
    }
    const boxes = image.boxes(size);
    if (!boxes.length) {
      result.skipped++;
      continue;
    }
    const timestamp = image.timestamp && !Number.isNaN(Date.parse(image.timestamp)) ? image.timestamp : nowIso;
    result.records.push({
      session_id: newSessionId(new Date(timestamp)),
      image_url: key,
      original_size: size,
      display_size: size,
      scale_factor: 1,
      annotator: image.annotator || IMPORTED_ANNOTATOR,
      timestamp,
      bounding_boxes: boxes,
    });
  }

  result.formats = [...found];
  return result;
}
