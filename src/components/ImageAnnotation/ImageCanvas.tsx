'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BoundingBox } from '@/types/annotation';
import { resolveImagePath } from '@/utils/paths';

interface ImageCanvasProps {
  image: string | null;
  imageMetadata: {
    originalSize: { width: number; height: number };
    displaySize: { width: number; height: number };
    scaleFactor: number;
  } | null;
  boundingBoxes: BoundingBox[];
  onAddBoundingBox: (box?: Omit<BoundingBox, 'id'>) => void;
  onUpdateBoundingBox: (id: string, updates: Partial<BoundingBox>) => void;
  onDeleteBoundingBox: (id: string) => void;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  image,
  imageMetadata,
  boundingBoxes,
  onAddBoundingBox,
  onUpdateBoundingBox,
  onDeleteBoundingBox,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<{
    type: 'move' | 'resize' | null;
    boxId?: string;
    handle?: string;
    startX: number;
    startY: number;
    originalBox?: BoundingBox;
  } | null>(null);

  const originalToDisplay = useCallback(
    (coords: { x: number; y: number; width: number; height: number }) => {
      if (!imageMetadata) return { x: 0, y: 0, width: 0, height: 0 };
      const { displaySize, originalSize } = imageMetadata;
      const scaleX = displaySize.width / originalSize.width;
      const scaleY = displaySize.height / originalSize.height;
      
      // Calculate display coordinates
      const displayX = coords.x * scaleX;
      const displayY = coords.y * scaleY;
      const displayWidth = coords.width * scaleX;
      const displayHeight = coords.height * scaleY;

      const maxX = displaySize.width - displayWidth;
      const maxY = displaySize.height - displayHeight;
      
      return {
        x: Math.max(0, Math.min(displayX, maxX)),
        y: Math.max(0, Math.min(displayY, maxY)),
        width: displayWidth,
        height: displayHeight,
      };
    },
    [imageMetadata]
  );

  const displayToOriginal = useCallback(
    (coords: { x: number; y: number; width: number; height: number }) => {
      if (!imageMetadata) return { x: 0, y: 0, width: 0, height: 0 };
      const { displaySize, originalSize } = imageMetadata;
      const scaleX = originalSize.width / displaySize.width;
      const scaleY = originalSize.height / displaySize.height;
      return {
        x: coords.x * scaleX,
        y: coords.y * scaleY,
        width: coords.width * scaleX,
        height: coords.height * scaleY,
      };
    },
    [imageMetadata]
  );

  // Constrain bounding box within image bounds
  const constrainBoundingBox = useCallback(
    (box: { x: number; y: number; width: number; height: number }) => {
      if (!imageMetadata) return box;
      const { originalSize } = imageMetadata;
      
      // Ensure box stays within image bounds
      let { x, y, width, height } = box;
      
      // First ensure minimum size
      const minSize = 10;
      width = Math.max(minSize, width);
      height = Math.max(minSize, height);
      
      // Then ensure size doesn't exceed image bounds
      width = Math.min(width, originalSize.width);
      height = Math.min(height, originalSize.height);
      
      // Finally constrain position to keep box fully within image

      x = Math.max(0, Math.min(x, originalSize.width - width));
      y = Math.max(0, Math.min(y, originalSize.height - height));
      
      // Round to integers to prevent sub-pixel issues
      return { 
        x: Math.round(x), 
        y: Math.round(y), 
        width: Math.round(width), 
        height: Math.round(height) 
      };
    },
    [imageMetadata]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect boxes when clicking on canvas background
    if (e.target === e.currentTarget) {
      setSelectedBox(null);
    }
  };

  const handleBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>, boxId: string) => {
    e.stopPropagation();
    setSelectedBox(boxId);
    const originalBox = boundingBoxes.find(b => b.id === boxId);
    if (originalBox) {
      setInteractionState({
        type: 'move',
        boxId,
        startX: e.clientX,
        startY: e.clientY,
        originalBox,
      });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, boxId: string, handle: string) => {
    e.stopPropagation();
    setSelectedBox(boxId);
    const originalBox = boundingBoxes.find(b => b.id === boxId);
    if (originalBox) {
      setInteractionState({
        type: 'resize',
        boxId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        originalBox,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactionState || !canvasRef.current) return;
    
    if (interactionState.type === 'move' && interactionState.originalBox) {
      const dx = e.clientX - interactionState.startX;
      const dy = e.clientY - interactionState.startY;
      const originalDx = displayToOriginal({ x: dx, y: dy, width: 0, height: 0 }).x;
      const originalDy = displayToOriginal({ x: dx, y: dy, width: 0, height: 0 }).y;

      const newBox = constrainBoundingBox({
        x: interactionState.originalBox.x + originalDx,
        y: interactionState.originalBox.y + originalDy,
        width: interactionState.originalBox.width,
        height: interactionState.originalBox.height,
      });

      onUpdateBoundingBox(interactionState.boxId!, newBox);
    } else if (interactionState.type === 'resize' && interactionState.originalBox) {
      const dx = e.clientX - interactionState.startX;
      const dy = e.clientY - interactionState.startY;
      const { handle, originalBox } = interactionState;
      let { x: newX, y: newY, width: newWidth, height: newHeight } = originalToDisplay(originalBox);

      if (handle) {
        if (handle.includes('right')) newWidth += dx;
        if (handle.includes('left')) { newX += dx; newWidth -= dx; }
        if (handle.includes('bottom')) newHeight += dy;
        if (handle.includes('top')) { newY += dy; newHeight -= dy; }
      }

      const tempBox = displayToOriginal({ x: newX, y: newY, width: newWidth, height: newHeight });
      const finalBox = constrainBoundingBox(tempBox);
      onUpdateBoundingBox(interactionState.boxId!, finalBox);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setInteractionState(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedBox) {
        onDeleteBoundingBox(selectedBox);
        setSelectedBox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBox, onDeleteBoundingBox]);

  if (!image) {
    return (
        <div className="flex items-center justify-center h-96 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <p className="text-gray-500 text-lg">No image loaded</p>
            <p className="text-gray-400 text-sm mt-2">Load an image to start annotating</p>
          </div>
        </div>
      );
  }

  return (
    <div
      ref={canvasRef}
      className="image-canvas relative no-select"
      style={{
        width: imageMetadata?.displaySize.width,
        height: imageMetadata?.displaySize.height,
        display: 'inline-block',
        position: 'relative',
        margin: 0,
        padding: 0,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <img
        src={image}
        alt="Annotation target"
        style={{
          width: `${imageMetadata?.displaySize.width}px`,
          height: `${imageMetadata?.displaySize.height}px`,
          display: 'block',
          margin: 0,
          padding: 0,
          border: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
        onError={(e) => {
          console.error('Failed to load image:', image);
          e.currentTarget.src = resolveImagePath('placeholder-error.png');
        }}
      />

      {/* Existing bounding boxes */}
      {boundingBoxes.map((box) => {
        const displayBox = originalToDisplay(box);
        const isSelected = selectedBox === box.id;
        const handles = [
          { position: 'top-left', cursor: 'nwse-resize' },
          { position: 'top-right', cursor: 'nesw-resize' },
          { position: 'bottom-left', cursor: 'nesw-resize' },
          { position: 'bottom-right', cursor: 'nwse-resize' },
        ];
        return (
          <div
            key={box.id}
            className={`bounding-box-original absolute ${isSelected ? 'selected' : ''}`}
            style={{
              left: displayBox.x,
              top: displayBox.y,
              width: displayBox.width,
              height: displayBox.height,
              cursor: 'move',
              border: '3px solid #00ff00',
              backgroundColor: 'rgba(0, 255, 0, 0.2)',
              boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
              boxSizing: 'border-box', // Ensure border is included in dimensions
            }}
            onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBox(box.id);
            }}
          >
             {/* Label inside the box */}
             <div className="box-label-inside">
               {box.label}
             </div>
             
             {/* Size and position info inside the box */}
             <div className="box-info-inside">
               {Math.round(box.width)}×{Math.round(box.height)}
             </div>
             
             {/* Position info inside the box */}
             <div className="box-position-inside">
               ({Math.round(box.x)}, {Math.round(box.y)})
             </div>
            {/* Resize handles - only show for selected box */}
            {isSelected &&
              handles.map(({ position, cursor }) => (
                <div
                  key={position}
                  className="resize-handle-ui"
                  style={{
                    cursor,
                    position: 'absolute',
                    top: position.includes('top') ? -4 : undefined,
                    bottom: position.includes('bottom') ? -4 : undefined,
                    left: position.includes('left') ? -4 : undefined,
                    right: position.includes('right') ? -4 : undefined,
                  }}
                  onMouseDown={(e) => handleResizeMouseDown(e, box.id, position)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
};

export default ImageCanvas;
