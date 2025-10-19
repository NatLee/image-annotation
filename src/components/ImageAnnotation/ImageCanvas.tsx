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
  onAddBoundingBox: (box: Omit<BoundingBox, 'id'>) => void;
  onUpdateBoundingBox: (id: string, updates: Partial<BoundingBox>) => void;
  onDeleteBoundingBox: (id: string) => void;
  isDrawing: boolean;
  setIsDrawing: (isDrawing: boolean) => void;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  image,
  imageMetadata,
  boundingBoxes,
  onAddBoundingBox,
  onUpdateBoundingBox,
  onDeleteBoundingBox,
  isDrawing,
  setIsDrawing,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<{
    type: 'move' | 'resize' | 'draw' | null;
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
      return {
        x: coords.x * scaleX,
        y: coords.y * scaleY,
        width: coords.width * scaleX,
        height: coords.height * scaleY,
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
      const newBox = {
        x,
        y,
        width: 0,
        height: 0,
        label: 'new-box',
      };
      setInteractionState({ type: 'draw', startX: x, startY: y, originalBox: newBox as BoundingBox });
    }
  };

  const handleBoxMouseDown = (e: React.MouseEvent<HTMLDivElement>, boxId: string) => {
    e.stopPropagation();
    setSelectedBox(boxId);
    if (!isDrawing) {
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
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (interactionState.type === 'draw' && interactionState.originalBox) {
        const { startX, startY } = interactionState;
        const newBox: BoundingBox = {
          ...interactionState.originalBox,
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        };
      } else if (interactionState.type === 'move' && interactionState.originalBox) {
        const dx = e.clientX - interactionState.startX;
        const dy = e.clientY - interactionState.startY;
        const originalDx = displayToOriginal({ x: dx, y: dy, width: 0, height: 0 }).x;
        const originalDy = displayToOriginal({ x: dx, y: dy, width: 0, height: 0 }).y;

        onUpdateBoundingBox(interactionState.boxId!, {
          x: interactionState.originalBox.x + originalDx,
          y: interactionState.originalBox.y + originalDy,
        });
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

        const finalBox = displayToOriginal({ x: newX, y: newY, width: newWidth, height: newHeight });
        onUpdateBoundingBox(interactionState.boxId!, finalBox);
      }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactionState && interactionState.type === 'draw' && interactionState.originalBox) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { startX, startY } = interactionState;

        const finalBox = displayToOriginal({
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        });

        if (finalBox.width > 5 && finalBox.height > 5) {
          onAddBoundingBox({ ...finalBox, label: 'new-box' });
        }
      }
      setInteractionState(null);
      setIsDrawing(false);
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
      className="relative border border-gray-300 rounded-lg overflow-hidden bg-white"
      style={{
        width: imageMetadata?.displaySize.width,
        height: imageMetadata?.displaySize.height,
        cursor: isDrawing ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <img
        src={image}
        alt="Annotation target"
        className="max-w-full h-auto"
        style={{
          width: imageMetadata?.displaySize.width,
          height: imageMetadata?.displaySize.height,
        }}
        onError={(e) => {
          console.error('Failed to load image:', image);
          e.currentTarget.src = resolveImagePath('placeholder-error.png');
        }}
      />
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
            className={`absolute transition-colors duration-150 ease-in-out
              ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-yellow-400 hover:bg-yellow-400/20'}
              border-2`}
            style={{
              left: displayBox.x,
              top: displayBox.y,
              width: displayBox.width,
              height: displayBox.height,
              cursor: 'move',
            }}
            onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedBox(box.id);
              }}
          >
            <div className={`absolute -top-7 left-0 text-xs font-semibold px-1.5 py-0.5 rounded-sm
              ${isSelected ? 'bg-blue-500 text-white' : 'bg-yellow-400 text-black'}`}>
              {box.label}
            </div>
            {isSelected &&
              handles.map(({ position, cursor }) => (
                <div
                  key={position}
                  className="absolute w-4 h-4 -m-2 rounded-full bg-blue-500 border-2 border-white"
                  style={{
                    cursor,
                    top: position.includes('top') ? 0 : undefined,
                    bottom: position.includes('bottom') ? 0 : undefined,
                    left: position.includes('left') ? 0 : undefined,
                    right: position.includes('right') ? 0 : undefined,
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
