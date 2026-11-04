import type { BoundingBox, ImageCredit, Size } from '@/types';

/**
 * What every import reader returns for one image, before the app matches it to
 * an image it knows. `boxes` takes the image size because YOLO stores
 * coordinates as fractions of it; the other formats ignore the argument.
 */
export interface ImportedImage {
  /** How the file names the image: a URL, a path or a file name. */
  reference: string;
  /** Size stated in the file (COCO, VOC). YOLO files have none. */
  size?: Size;
  boxes: (size: Size) => BoundingBox[];
  annotator?: string;
  timestamp?: string;
  credit?: ImageCredit;
}
