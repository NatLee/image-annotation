import React from 'react';

interface ControlPanelProps {
  onImageLoad: (imageUrl: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  boundingBoxCount: number;
  hasImage: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onImageLoad, onSubmit, onClear, boundingBoxCount, hasImage }) => {
  const handleImageLoad = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      onImageLoad(url);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold">Controls</h2>
      <button onClick={handleImageLoad} className="w-full bg-blue-500 text-white p-2 rounded">Load Image</button>
      <button onClick={onSubmit} disabled={!hasImage || boundingBoxCount === 0} className="w-full bg-green-500 text-white p-2 rounded disabled:bg-gray-300">Submit Annotation</button>
      <button onClick={onClear} disabled={!hasImage || boundingBoxCount === 0} className="w-full bg-red-500 text-white p-2 rounded disabled:bg-gray-300">Clear Annotations</button>
      <p>Bounding Boxes: {boundingBoxCount}</p>
    </div>
  );
};

export default ControlPanel;
