import { REPO_URL } from '@/config';
import { newBoxId } from '@/lib/ids';
import { exportFileName, isRemote } from '@/lib/paths';
import type { AnnotationSession, LabelClass } from '@/types';
import type { ImportedImage } from './imported';

/** COCO object detection format: https://cocodataset.org/#format-data */

export interface CocoImage {
  id: number;
  file_name: string;
  width: number;
  height: number;
  coco_url?: string;
  /** Not part of COCO; readers ignore it. Keeps who annotated it on a round trip. */
  annotator?: string;
  date_captured?: string;
}

export interface CocoAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  bbox: [number, number, number, number];
  area: number;
  iscrowd: 0 | 1;
  segmentation: number[][];
}

export interface CocoCategory {
  id: number;
  name: string;
  supercategory: string;
}

export interface CocoFile {
  info: { description: string; url: string; version: string; date_created: string };
  licenses: unknown[];
  images: CocoImage[];
  annotations: CocoAnnotation[];
  categories: CocoCategory[];
}

/** Categories follow the class list, then any extra labels found in the records. Ids start at 1. */
export function categoriesFor(records: readonly AnnotationSession[], classes: readonly LabelClass[]): string[] {
  const names = classes.map((c) => c.name);
  for (const record of records) {
    for (const box of record.bounding_boxes) if (!names.includes(box.label)) names.push(box.label);
  }
  return names;
}

export function toCoco(records: readonly AnnotationSession[], classes: readonly LabelClass[], now: string): CocoFile {
  const names = categoriesFor(records, classes);
  const categoryId = new Map(names.map((name, i) => [name, i + 1]));
  let annotationId = 1;
  const images: CocoImage[] = [];
  const annotations: CocoAnnotation[] = [];

  records.forEach((record, i) => {
    const imageId = i + 1;
    images.push({
      id: imageId,
      file_name: exportFileName(record.image_url),
      width: record.original_size.width,
      height: record.original_size.height,
      ...(isRemote(record.image_url) ? { coco_url: record.image_url } : {}),
      annotator: record.annotator,
      date_captured: record.timestamp,
    });
    for (const box of record.bounding_boxes) {
      annotations.push({
        id: annotationId++,
        image_id: imageId,
        category_id: categoryId.get(box.label)!,
        bbox: [box.x, box.y, box.width, box.height],
        area: box.width * box.height,
        iscrowd: 0,
        segmentation: [],
      });
    }
  });

  return {
    info: { description: 'Exported from image-annotation', url: REPO_URL, version: '1.0', date_created: now },
    licenses: [],
    images,
    annotations,
    categories: names.map((name, i) => ({ id: i + 1, name, supercategory: '' })),
  };
}

export const isCoco = (json: unknown): json is CocoFile =>
  typeof json === 'object' &&
  json !== null &&
  Array.isArray((json as CocoFile).images) &&
  Array.isArray((json as CocoFile).annotations) &&
  Array.isArray((json as CocoFile).categories);

/** One entry per image that has at least one box. */
export function readCoco(coco: CocoFile): { images: ImportedImage[]; skipped: number } {
  const categoryName = new Map(coco.categories.map((c) => [c.id, String(c.name)]));
  const byImage = new Map<number, CocoAnnotation[]>();
  for (const a of coco.annotations) {
    if (!Array.isArray(a.bbox) || a.bbox.length < 4) continue;
    byImage.set(a.image_id, [...(byImage.get(a.image_id) ?? []), a]);
  }

  const images: ImportedImage[] = [];
  let skipped = 0;
  for (const image of coco.images) {
    const anns = byImage.get(image.id) ?? [];
    const width = Number(image.width);
    const height = Number(image.height);
    const reference = image.coco_url || image.file_name;
    if (!anns.length || !reference) {
      skipped++;
      continue;
    }
    const boxes = anns.map((a) => ({
      id: newBoxId(),
      x: Number(a.bbox[0]),
      y: Number(a.bbox[1]),
      width: Number(a.bbox[2]),
      height: Number(a.bbox[3]),
      label: categoryName.get(a.category_id) ?? `category_${a.category_id}`,
    }));
    images.push({
      reference,
      size: width > 0 && height > 0 ? { width, height } : undefined,
      boxes: () => boxes,
      annotator: image.annotator,
      timestamp: image.date_captured,
    });
  }
  return { images, skipped };
}
