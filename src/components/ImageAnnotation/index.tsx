'use client';

import React, { useState, useCallback } from 'react';
import ImageCanvas from './ImageCanvas';
import ControlPanel from './ControlPanel';
import ExportPanel from './ExportPanel';
import { useImageAnnotation } from '@/hooks/useImageAnnotation';
import { BoundingBox } from '@/types/annotation';

const ImageAnnotationSystem: React.FC = () => {
  const {
    currentImage,
    boundingBoxes,
    loadImage,
    addBoundingBox,
    updateBoundingBox,
    deleteBoundingBox,
    submitAnnotation,
    clearAnnotations
  } = useImageAnnotation();

  const [isDrawing, setIsDrawing] = useState(false);

  const handleImageLoad = useCallback((imageUrl: string) => {
    loadImage(imageUrl);
  }, [loadImage]);

  const handleSubmit = useCallback(() => {
    if (boundingBoxes.length === 0) {
      alert('Please create at least one bounding box before submitting!');
      return;
    }
    submitAnnotation();
  }, [boundingBoxes, submitAnnotation]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Image Annotation System
          </h1>
          <p className="text-gray-600">
            Create bounding boxes for machine learning training data
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Canvas Area */}
          <div className="lg:col-span-3">
            <ImageCanvas
              image={currentImage}
              boundingBoxes={boundingBoxes}
              onAddBoundingBox={addBoundingBox}
              onUpdateBoundingBox={updateBoundingBox}
              onDeleteBoundingBox={deleteBoundingBox}
              isDrawing={isDrawing}
              setIsDrawing={setIsDrawing}
            />
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <ControlPanel
              onImageLoad={handleImageLoad}
              onSubmit={handleSubmit}
              onClear={clearAnnotations}
              boundingBoxCount={boundingBoxes.length}
              hasImage={!!currentImage}
            />

            <ExportPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageAnnotationSystem;
