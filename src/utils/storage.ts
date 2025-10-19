import { AnnotationSession, AnnotationData } from '@/types/annotation';

export const saveAnnotationToStorage = (session: AnnotationSession) => {
  const data = getAnnotationFromStorage();

  // Check if an annotation for this image already exists
  const existingIndex = data.annotation_records.findIndex(
    record => record.image_url === session.image_url
  );

  if (existingIndex !== -1) {
    // Overwrite existing annotation
    data.annotation_records[existingIndex] = session;
  } else {
    // Add new annotation
    data.annotation_records.push(session);
  }

  // Update metadata
  data.total_images = data.annotation_records.length;
  data.total_annotations = data.annotation_records.reduce(
    (acc, record) => acc + record.bounding_boxes.length,
    0
  );
  data.last_updated = new Date().toISOString();

  localStorage.setItem('annotation_data', JSON.stringify(data));
};

export const getAnnotationFromStorage = (): AnnotationData => {
  const data = localStorage.getItem('annotation_data');
  if (data) {
    return JSON.parse(data);
  }
  return {
    annotation_records: [],
    total_images: 0,
    total_annotations: 0,
    last_updated: new Date().toISOString(),
  };
};
