import { useState, useCallback } from 'react';
import { BoundingBox, AnnotationSession } from '@/types/annotation';
import { saveAnnotationToStorage } from '@/utils/storage';
import { resolveImagePath, isExternalUrl } from '@/utils/paths';

export const useImageAnnotation = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  // ... other state
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [imageMetadata, setImageMetadata] = useState<{
    originalSize: { width: number; height: number };
    displaySize: { width: number; height: number };
    scaleFactor: number;
  } | null>(null);

  const loadImage = useCallback((imageUrl: string) => {
    // Store the original URL for saving
    setOriginalImageUrl(imageUrl);

    // Resolve the path for display
    const resolvedUrl = resolveImagePath(imageUrl);
    setCurrentImage(resolvedUrl);
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

    img.onerror = () => {
      alert('Failed to load image. Please check the URL or try a different image.');
      setCurrentImage(null);
      setOriginalImageUrl(null);
    };

    img.src = resolvedUrl;
  }, []);

  const submitAnnotation = useCallback(() => {
    if (!originalImageUrl || !imageMetadata) return;

    const session: AnnotationSession = {
      session_id: `session_${Date.now()}`,
      image_url: originalImageUrl, // Save original URL, not resolved path
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
    setCurrentImage(null);
    setOriginalImageUrl(null);
    alert('Annotation submitted successfully!');
  }, [originalImageUrl, imageMetadata, boundingBoxes]);

  // ... rest of the hook
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
