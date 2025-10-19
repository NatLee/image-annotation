import { useState, useCallback, useEffect } from 'react';
import { BoundingBox, AnnotationSession } from '@/types/annotation';
import { saveAnnotationToStorage } from '@/utils/storage';
import { resolveImagePath, isExternalUrl } from '@/utils/paths';

export const useImageAnnotation = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [imageMetadata, setImageMetadata] = useState<{
    originalSize: { width: number; height: number };
    displaySize: { width: number; height: number };
    scaleFactor: number;
  } | null>(null);
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);

  // Calculate viewport like original - fits image within available space
  const calculateViewport = useCallback((imgElement: HTMLImageElement) => {
    if (!imgElement || !imgElement.naturalWidth) return null;

    const toolbarHeight = 70; // Approximate toolbar height
    const availableHeight = window.innerHeight - toolbarHeight - 20; // Add padding
    const availableWidth = window.innerWidth - 20; // Add padding

    const imgAspectRatio = imgElement.naturalWidth / imgElement.naturalHeight;

    let displayWidth = availableWidth;
    let displayHeight = displayWidth / imgAspectRatio;

    if (displayHeight > availableHeight) {
      displayHeight = availableHeight;
      displayWidth = displayHeight * imgAspectRatio;
    }

    // Ensure dimensions are integers to prevent sub-pixel rendering issues
    return {
      originalSize: { width: imgElement.naturalWidth, height: imgElement.naturalHeight },
      displaySize: { 
        width: Math.floor(displayWidth), 
        height: Math.floor(displayHeight) 
      },
      scaleFactor: displayWidth / imgElement.naturalWidth
    };
  }, []);

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
      const metadata = calculateViewport(img);
      if (!metadata) return;

      setImageMetadata(metadata);

      // Auto-add default bounding box (25% of smaller dimension, centered) like original
      const size = Math.min(img.naturalWidth, img.naturalHeight) * 0.25;
      const left = (img.naturalWidth - size) / 2;
      const top = (img.naturalHeight - size) / 2;

      const defaultBox: BoundingBox = {
        id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: left,
        y: top,
        width: size,
        height: size,
        label: 'anime_face'
      };

      setBoundingBoxes([defaultBox]);
    };

    img.onerror = () => {
      alert('Failed to load image. Please check the URL or try a different image.');
      setCurrentImage(null);
      setOriginalImageUrl(null);
    };

    img.src = resolvedUrl;
  }, [calculateViewport]);

  // Handle window resize like original - recalculate viewport and keep boxes in original coords
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      // Debounce resize to prevent excessive calculations
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!currentImage) return;
        
        const img = new Image();
        img.onload = () => {
          const newMetadata = calculateViewport(img);
          if (newMetadata) {
            setImageMetadata(newMetadata);
            // Boxes will automatically redraw at correct positions
            // because they're stored in original coordinates
          }
        };
        img.src = currentImage;
      }, 100); // 100ms debounce
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentImage, calculateViewport]);

  const submitAnnotation = useCallback(() => {
    if (!originalImageUrl || !imageMetadata) return;

    // Validation checks like original
    if (boundingBoxes.length === 0) {
      alert('Please create at least one bounding box before submitting!');
      return;
    }

    // Get user name from localStorage
    const userName = localStorage.getItem('userName') || 'anonymous';

    // Check if this image was already annotated (like original)
    const existingData = JSON.parse(localStorage.getItem('annotation_data') || '{"annotation_records":[]}');
    const alreadyAnnotated = existingData.annotation_records?.some((record: AnnotationSession) => record.image_url === originalImageUrl);

    if (alreadyAnnotated) {
      if (!confirm('This image has already been annotated. Do you want to overwrite the previous annotation?')) {
        return;
      }
    }

    const session: AnnotationSession = {
      session_id: `session_${Date.now()}`,
      image_url: originalImageUrl,
      original_size: imageMetadata.originalSize,
      display_size: imageMetadata.displaySize,
      scale_factor: imageMetadata.scaleFactor,
      annotator: userName,
      timestamp: new Date().toISOString(),
      bounding_boxes: boundingBoxes
    };

    saveAnnotationToStorage(session);

    // Get updated stats
    const data = JSON.parse(localStorage.getItem('annotation_data') || '{}');
    alert(`Annotation submitted successfully!\nTotal annotated images: ${data.total_images}\nTotal annotations: ${data.total_annotations}`);

    // Clear current state
    setBoundingBoxes([]);
    setCurrentImage(null);
    setOriginalImageUrl(null);
  }, [originalImageUrl, imageMetadata, boundingBoxes]);

  // Add box like original - centered or offset from last
  const addBoundingBox = useCallback((box?: Omit<BoundingBox, 'id'>) => {
    if (!imageMetadata) return;

    let newBoxData: Omit<BoundingBox, 'id'>;

    if (box) {
      // Use provided box data (from drawing)
      newBoxData = box;
    } else {
      // Create centered/offset box like original
      const originalWidth = imageMetadata.originalSize.width;
      const originalHeight = imageMetadata.originalSize.height;
      const size = Math.min(originalWidth, originalHeight) * 0.25;
      let left = (originalWidth - size) / 2;
      let top = (originalHeight - size) / 2;

      // If boxes exist, offset from last one like original
      if (boundingBoxes.length > 0) {
        const lastBox = boundingBoxes[boundingBoxes.length - 1];
        left = lastBox.x + 20;
        top = lastBox.y + 20;
      }

      newBoxData = {
        x: left,
        y: top,
        width: size,
        height: size,
        label: 'anime_face'
      };
    }

    const newBox: BoundingBox = {
      ...newBoxData,
      id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    setBoundingBoxes(prev => [...prev, newBox]);
  }, [imageMetadata, boundingBoxes]);

  const updateBoundingBox = useCallback((id: string, updates: Partial<BoundingBox>) => {
    setBoundingBoxes(prev =>
      prev.map(box => box.id === id ? { ...box, ...updates } : box)
    );
  }, []);

  const deleteBoundingBox = useCallback((id: string) => {
    setBoundingBoxes(prev => prev.filter(box => box.id !== id));
  }, []);

  const deleteLastBoundingBox = useCallback(() => {
    setBoundingBoxes(prev => prev.slice(0, -1));
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
    deleteLastBoundingBox,
    submitAnnotation,
    clearAnnotations
  };
};
