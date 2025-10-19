'use client';

import React, { useState, useRef } from 'react';

interface ControlPanelProps {
  onImageLoad: (imageUrl: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onDraw: () => void;
  boundingBoxCount: number;
  hasImage: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onImageLoad, onSubmit, onClear, onDraw, boundingBoxCount, hasImage }) => {
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrl.trim()) {
      onImageLoad(imageUrl.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onImageLoad(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleImage = () => {
    // Use relative path for sample images
    const sampleImagePath = 'sample-images/sample1.jpg';
    onImageLoad(sampleImagePath);
  };

  const fetchRandomImage = () => {
    fetch('https://api.waifu.im/search')
      .then(response => response.json())
      .then(data => {
        onImageLoad(data.images[0].url);
      });
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Controls</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL
          </label>
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Load
            </button>
          </form>
        </div>

        <div className="text-center text-gray-500">or</div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="text-center text-gray-500">or</div>

        <button
          onClick={loadSampleImage}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Load Sample Image
        </button>

        <div className="text-center text-gray-500">or</div>

        <button
          onClick={fetchRandomImage}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Fetch Random Image
        </button>
      </div>

      <div className="border-t border-gray-200 my-4" />

      <div className="space-y-2">
        <button onClick={onDraw} disabled={!hasImage} className="w-full bg-cyan-500 text-white p-2 rounded disabled:bg-gray-300">Draw Box</button>
        <button onClick={onSubmit} disabled={!hasImage || boundingBoxCount === 0} className="w-full bg-green-500 text-white p-2 rounded disabled:bg-gray-300">Submit Annotation</button>
        <button onClick={onClear} disabled={!hasImage || boundingBoxCount === 0} className="w-full bg-red-500 text-white p-2 rounded disabled:bg-gray-300">Clear Annotations</button>
      </div>
      <p className="text-sm text-gray-600">Bounding Boxes: {boundingBoxCount}</p>
    </div>
  );
};

export default ControlPanel;