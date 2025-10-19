import { useState, useCallback } from 'react';
import { BoundingBox, AnnotationSession } from '@/types/annotation';
import { saveAnnotationToStorage } from '@/utils/storage';

export const useImageAnnotation = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [imageMetadata, setImageMetadata] = useState<{
    originalSize: { width: number; height: number };
    displaySize: { width: number; height: number };
    scaleFactor: number;
  } | null>(null);

  const loadImage = useCallback((imageUrl: string) => {
    setCurrentImage(imageUrl);
    setBoundingBoxes([]);

    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      const maxWidth = 800;
      const maxHeight = 600;
      const scaleFactor = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);

      setImageMetadata({
        originalSize: { width: img.naturalWidth, height: img.naturalHeight },
        displaySize: {
          width: img.naturalWidth * scaleFactor,
          height: img.naturalHeight * scaleFactor
        },
        scaleFactor
      });
    };
    img.src = imageUrl;
  }, []);

  const addBoundingBox = useCallback((box: Omit<BoundingBox, 'id'>) => {
    const newBox: BoundingBox = {
      ...box,
      id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setBoundingBoxes(prev => [...prev, newBox]);
  }, []);

  const updateBoundingBox = useCallback((id: string, updates: Partial<BoundingBox>) => {
    setBoundingBoxes(prev =>
      prev.map(box => box.id === id ? { ...box, ...updates } : box)
    );
  }, []);

  const deleteBoundingBox = useCallback((id: string) => {
    setBoundingBoxes(prev => prev.filter(box => box.id !== id));
  }, []);

  const submitAnnotation = useCallback(() => {
    if (!currentImage || !imageMetadata) return;

    const session: AnnotationSession = {
      session_id: `session_${Date.now()}`,
      image_url: currentImage,
      original_size: imageMetadata.originalSize,
      display_size: imageMetadata.displaySize,
      scale_factor: imageMetadata.scaleFactor,
      annotator: 'anonymous',
      timestamp: new Date().toISOString(),
      bounding_boxes: boundingBoxes
    };

    saveAnnotationToStorage(session);

    // Clear current state
    setBoundingBoxes([]);
    alert('Annotation submitted successfully!');
  }, [currentImage, imageMetadata, boundingBoxes]);

  const clearAnnotations = useCallback(() => {
    setBoundingBoxes([]);
  }, []);

  return {
    currentImage,
    boundingBoxes,
    imageMetadata,
    loadImage,
    addBoundingBox,
    updateBoundingBox,
    deleteBoundingBox,
    submitAnnotation,
    clearAnnotations
  };
};
