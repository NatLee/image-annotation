import React from 'react';
import { BoundingBox } from '@/types/annotation';

interface ImageCanvasProps {
  image: string | null;
  boundingBoxes: BoundingBox[];
  onAddBoundingBox: (box: Omit<BoundingBox, 'id'>) => void;
  onUpdateBoundingBox: (id: string, updates: Partial<BoundingBox>) => void;
  onDeleteBoundingBox: (id: string) => void;
  isDrawing: boolean;
  setIsDrawing: (isDrawing: boolean) => void;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({ image }) => {
  return (
    <div className="relative w-full h-[600px] bg-gray-200">
      {image && <img src={image} alt="Annotation target" className="w-full h-full object-contain" />}
    </div>
  );
};

export default ImageCanvas;
