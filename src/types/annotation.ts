export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface AnnotationSession {
  session_id: string;
  image_url: string;
  original_size: {
    width: number;
    height: number;
  };
  display_size: {
    width: number;
    height: number;
  };
  scale_factor: number;
  annotator: string;
  timestamp: string;
  bounding_boxes: BoundingBox[];
}

export interface AnnotationData {
  annotation_records: AnnotationSession[];
  total_images: number;
  total_annotations: number;
  last_updated: string;
}
