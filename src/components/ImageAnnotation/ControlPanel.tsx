'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ControlPanelProps {
  onImageLoad: (imageUrl: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onDraw: () => void;
  onDeleteLast: () => void;
  boundingBoxCount: number;
  hasImage: boolean;
  imageMetadata: {
    originalSize: { width: number; height: number };
    displaySize: { width: number; height: number };
    scaleFactor: number;
  } | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  onImageLoad, 
  onSubmit, 
  onClear, 
  onDraw, 
  onDeleteLast,
  boundingBoxCount, 
  hasImage,
  imageMetadata
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [annotationCount, setAnnotationCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('userName');
    if (savedName) {
      setUserName(savedName);
    }

    // Load annotation count
    const data = localStorage.getItem('annotation_data');
    if (data) {
      const parsed = JSON.parse(data);
      setAnnotationCount(parsed.total_images || 0);
    }
  }, []);

  // Update annotation count when it changes
  useEffect(() => {
    const interval = setInterval(() => {
      const data = localStorage.getItem('annotation_data');
      if (data) {
        const parsed = JSON.parse(data);
        setAnnotationCount(parsed.total_images || 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Save user name to localStorage when it changes
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setUserName(name);
    localStorage.setItem('userName', name);
  };

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
    <div className="space-y-4">
      {/* Load Image Card */}
      <div className="anime-card p-6">
        <h3 className="text-lg font-bold mb-4 gradient-text flex items-center gap-2">
          <span>🖼️</span> Load Image
        </h3>

        <div className="space-y-3">
          <button
            onClick={fetchRandomImage}
            className="anime-button w-full bg-gradient-to-r from-purple-400 to-pink-500 text-white py-3 px-4 rounded-2xl font-bold shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span className="mr-2">🎲</span> Random Image
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <form onSubmit={handleUrlSubmit} className="space-y-2">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image URL..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-all text-sm"
            />
            <button
              type="submit"
              className="anime-button w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-2 px-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-sm"
            >
              Load URL
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <label className="anime-button block w-full bg-gradient-to-r from-gray-400 to-gray-600 text-white py-2 px-4 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-sm cursor-pointer text-center">
            <span className="mr-2">📁</span> Upload File
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Action Buttons Card */}
      <div className="anime-card p-6">
        <h2 className="text-xl font-bold mb-4 gradient-text flex items-center gap-2">
          <span>🎯</span> Actions
        </h2>

        <div className="space-y-3">
          <button 
            onClick={onDraw} 
            disabled={!hasImage} 
            className="anime-button w-full bg-gradient-to-r from-green-400 to-green-600 text-white py-4 px-4 rounded-2xl font-bold disabled:from-gray-300 disabled:to-gray-400 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all text-base"
          >
            <span className="text-xl mr-2">✏️</span> Draw Box
          </button>
          
          <button 
            onClick={onDeleteLast} 
            disabled={!hasImage || boundingBoxCount === 0} 
            className="anime-button w-full bg-gradient-to-r from-orange-400 to-orange-600 text-white py-3 px-4 rounded-2xl font-bold disabled:from-gray-300 disabled:to-gray-400 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span className="mr-2">🗑️</span> Delete Last
          </button>
          
          <button 
            onClick={onClear} 
            disabled={!hasImage || boundingBoxCount === 0} 
            className="anime-button w-full bg-gradient-to-r from-red-400 to-red-600 text-white py-3 px-4 rounded-2xl font-bold disabled:from-gray-300 disabled:to-gray-400 shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span className="mr-2">🔄</span> Clear All
          </button>
          
          <div className="pt-2">
            <button 
              onClick={onSubmit} 
              disabled={!hasImage || boundingBoxCount === 0 || !userName} 
              className="anime-button w-full bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 text-white py-4 px-4 rounded-2xl font-black disabled:from-gray-300 disabled:to-gray-400 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all text-lg neon-border"
            >
              <span className="text-xl mr-2">✨</span> Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;