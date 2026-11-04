/**
 * Data shapes. The record types (`BoundingBox`, `AnnotationSession`,
 * `AnnotationData`, `LegacyExport`) are the v1 storage and export format and
 * must stay backward compatible: v1 exports and v1 browser data load as-is.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A box in original image pixels. `label` is the class name. */
export interface BoundingBox extends Rect {
  id: string;
  label: string;
}

/** Who made an online image and where it came from. Written into exports for online images. */
export interface ImageCredit {
  /** The service the image was loaded from, e.g. "Danbooru". */
  provider: string;
  /** Artist name(s) as the provider lists them. */
  artist?: string;
  /** The image's page on the provider (a Danbooru post). */
  post_url?: string;
  /** Where the artist originally published it. */
  source_url?: string;
}

/** One submitted image (v1 name kept). */
export interface AnnotationSession {
  session_id: string;
  /** Identifies the image: a URL, an app-relative path or a local file's relative path. */
  image_url: string;
  original_size: Size;
  display_size: Size;
  scale_factor: number;
  annotator: string;
  timestamp: string;
  bounding_boxes: BoundingBox[];
  /** Only for online images; v1 records have none. */
  credit?: ImageCredit;
}

/** What the browser stores under `annotation_data` (v1). */
export interface AnnotationData {
  annotation_records: AnnotationSession[];
  total_images: number;
  total_annotations: number;
  last_updated: string;
}

/** The v1 "Export All Data" file. */
export interface LegacyExport {
  export_info: {
    export_date: string;
    total_images: number;
    total_annotations: number;
    data_range: {
      first_annotation: string | undefined;
      last_annotation: string | undefined;
    };
  };
  annotation_records: AnnotationSession[];
}

export interface LabelClass {
  name: string;
  color: string;
}

export type ImageSource = 'sample' | 'online' | 'local';

export interface ImageItem {
  /** Stable id, stored as `image_url` in records. */
  key: string;
  /** What the browser loads (may be a blob: URL for local files). */
  src: string;
  name: string;
  source: ImageSource;
  credit?: ImageCredit;
  size?: Size;
  failed?: boolean;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
