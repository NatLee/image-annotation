'use client';

import React, { useState, useEffect } from 'react';
import { getAnnotationFromStorage } from '@/utils/storage';
import { AnnotationData } from '@/types/annotation';

const ExportPanel: React.FC = () => {
  const [data, setData] = useState<AnnotationData>({
    annotation_records: [],
    total_images: 0,
    total_annotations: 0,
    last_updated: new Date().toISOString(),
  });

  // Only access localStorage on client side
  useEffect(() => {
    const loadData = () => {
      const annotationData = getAnnotationFromStorage();
      setData(annotationData);
    };
    loadData();

    // Refresh data every second to keep it updated
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleExportAll = () => {
    const currentData = getAnnotationFromStorage();
    
    if (currentData.annotation_records.length === 0) {
      alert('No annotation data found to export!');
      return;
    }

    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        total_images: currentData.total_images,
        total_annotations: currentData.total_annotations,
        data_range: {
          first_annotation: currentData.annotation_records[0]?.timestamp,
          last_annotation: currentData.annotation_records[currentData.annotation_records.length - 1]?.timestamp
        }
      },
      annotation_records: currentData.annotation_records
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Exported ${currentData.total_images} images with ${currentData.total_annotations} annotations!`);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all annotation data? This cannot be undone.')) {
      localStorage.removeItem('annotation_data');
      setData({
        annotation_records: [],
        total_images: 0,
        total_annotations: 0,
        last_updated: new Date().toISOString(),
      });
      alert('All annotation data cleared!');
    }
  };

  return (
    <div className="anime-card p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
        <span>💾</span> Data Management
      </h3>
      
      <div className="glass-panel p-3 rounded-xl mb-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-2xl font-black text-pink-600">{data.total_images}</p>
            <p className="text-xs text-gray-600">Images</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-600">{data.total_annotations}</p>
            <p className="text-xs text-gray-600">Boxes</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <button 
          onClick={handleExportAll}
          disabled={data.annotation_records.length === 0}
          className="anime-button w-full bg-gradient-to-r from-blue-400 to-cyan-500 text-white py-2 px-3 rounded-xl font-bold disabled:from-gray-300 disabled:to-gray-400 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-sm"
        >
          💾 Export
        </button>
        <button 
          onClick={handleClearAll}
          disabled={data.annotation_records.length === 0}
          className="anime-button w-full bg-gradient-to-r from-gray-400 to-gray-500 text-white py-2 px-3 rounded-xl font-bold disabled:from-gray-300 disabled:to-gray-400 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-sm"
        >
          🗑️ Clear
        </button>
      </div>
      
      {data.last_updated && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          {new Date(data.last_updated).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default ExportPanel;
