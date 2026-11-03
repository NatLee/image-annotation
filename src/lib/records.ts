import { DEFAULT_ANNOTATOR, DEFAULT_LABEL } from '@/config';
import { newBoxId } from '@/lib/ids';
import type { AnnotationData, AnnotationSession, BoundingBox, Size } from '@/types';

/**
 * Submitted annotations: building the v1 `AnnotationData` summary, upserting
 * by image, and reading untrusted record data (storage or imported files).
 */

export const emptyData = (now: string): AnnotationData => ({
  annotation_records: [],
  total_images: 0,
  total_annotations: 0,
  last_updated: now,
});

/** v1 totals: one image per record, one annotation per box. */
export const summarize = (records: AnnotationSession[], now: string): AnnotationData => ({
  annotation_records: records,
  total_images: records.length,
  total_annotations: records.reduce((sum, r) => sum + r.bounding_boxes.length, 0),
  last_updated: now,
});

/** v1 rule: a record for the same image replaces the old one in place. */
export function upsertRecords(data: AnnotationData, incoming: AnnotationSession[], now: string): AnnotationData {
  const records = [...data.annotation_records];
  const index = new Map(records.map((r, i) => [r.image_url, i]));
  for (const record of incoming) {
    const at = index.get(record.image_url);
    if (at === undefined) {
      index.set(record.image_url, records.length);
      records.push(record);
    } else {
      records[at] = record;
    }
  }
  return summarize(records, now);
}

export const findRecord = (data: AnnotationData, key: string) =>
  data.annotation_records.find((r) => r.image_url === key);

/* ------------------------------------------------------------------------ */
/* Reading untrusted data                                                   */
/* ------------------------------------------------------------------------ */

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

function readSize(v: unknown): Size | undefined {
  if (!isObject(v)) return undefined;
  const width = num(v.width);
  const height = num(v.height);
  return width && height && width > 0 && height > 0 ? { width, height } : undefined;
}

export function readBox(v: unknown): BoundingBox | undefined {
  if (!isObject(v)) return undefined;
  const x = num(v.x);
  const y = num(v.y);
  const width = num(v.width);
  const height = num(v.height);
  if (x === undefined || y === undefined || !width || !height || width <= 0 || height <= 0) return undefined;
  return { id: str(v.id) ?? newBoxId(), x, y, width, height, label: str(v.label) ?? DEFAULT_LABEL };
}

/** A record in the v1 shape, with defaults for optional fields; `undefined` if unusable. */
export function readRecord(v: unknown, now: string): AnnotationSession | undefined {
  if (!isObject(v)) return undefined;
  const imageUrl = str(v.image_url);
  const originalSize = readSize(v.original_size);
  if (!imageUrl || !originalSize) return undefined;
  const boxes = Array.isArray(v.bounding_boxes) ? v.bounding_boxes.map(readBox).filter((b) => b !== undefined) : [];
  const timestamp = str(v.timestamp) ?? now;
  return {
    session_id: str(v.session_id) ?? `session_${Date.parse(timestamp) || Date.now()}`,
    image_url: imageUrl,
    original_size: originalSize,
    display_size: readSize(v.display_size) ?? originalSize,
    scale_factor: num(v.scale_factor) ?? 1,
    annotator: str(v.annotator) ?? DEFAULT_ANNOTATOR,
    timestamp,
    bounding_boxes: boxes,
  };
}

/**
 * Find records in any JSON the app has ever written: the v1 export
 * (`export_info` + `annotation_records`), the `annotation_data` storage value,
 * the README's storage dump (`{ annotation_data: … }`) or a bare array.
 * Returns `undefined` when the JSON is none of these.
 */
export function readRecordList(json: unknown, now: string): AnnotationSession[] | undefined {
  let list: unknown;
  if (Array.isArray(json)) list = json;
  else if (isObject(json) && Array.isArray(json.annotation_records)) list = json.annotation_records;
  else if (isObject(json) && isObject(json.annotation_data)) return readRecordList(json.annotation_data, now);
  if (!Array.isArray(list)) return undefined;
  return list.map((r) => readRecord(r, now)).filter((r) => r !== undefined);
}
