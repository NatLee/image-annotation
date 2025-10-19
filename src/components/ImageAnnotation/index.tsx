'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ImageCanvas from './ImageCanvas';
import { useImageAnnotation } from '@/hooks/useImageAnnotation';

const ImageAnnotationSystem: React.FC = () => {
  const {
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
  } = useImageAnnotation();

  const [userName, setUserName] = useState('');
  const [showRank, setShowRank] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [rankData, setRankData] = useState<Array<[string, number]>>([]);

  // Load username from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('userName');
    if (savedName) {
      setUserName(savedName);
    } else {
      alert('請輸入你的名字！');
    }
  }, []);

  // Auto-load random image on mount
  useEffect(() => {
    const fetchInitialImage = async () => {
      try {
        const response = await fetch('https://api.waifu.im/search');
        const data = await response.json();
        if (data.images && data.images[0]) {
          loadImage(data.images[0].url);
        }
      } catch (error) {
        console.error('Failed to fetch initial image:', error);
      }
    };
    
    fetchInitialImage();
  }, [loadImage]);

  // Handle username change
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setUserName(name);
    localStorage.setItem('userName', name);
  };

  // Submit and load next image
  const handleSubmit = useCallback(async () => {
    submitAnnotation();
    
    // Auto-load next image
    try {
      const response = await fetch('https://api.waifu.im/search');
      const data = await response.json();
      if (data.images && data.images[0]) {
        loadImage(data.images[0].url);
      }
    } catch (error) {
      console.error('Failed to fetch next image:', error);
      // Reload page as fallback
      window.location.reload();
    }
  }, [submitAnnotation, loadImage]);

  // Export all annotations
  const handleExportAll = () => {
    const allData = localStorage.getItem('annotation_data');
    
    if (!allData) {
      alert('No annotation data found to export!');
      return;
    }

    const parsed = JSON.parse(allData);
    if (parsed.annotation_records.length === 0) {
      alert('No annotation data found to export!');
      return;
    }

    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        total_images: parsed.total_images,
        total_annotations: parsed.total_annotations,
        data_range: {
          first_annotation: parsed.annotation_records[0]?.timestamp,
          last_annotation: parsed.annotation_records[parsed.annotation_records.length - 1]?.timestamp
        }
      },
      annotation_records: parsed.annotation_records
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_annotations_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Exported ${parsed.total_images} images with ${parsed.total_annotations} annotations!`);
  };

  // Clear all data
  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all annotation data? This cannot be undone.')) {
      localStorage.removeItem('annotation_data');
      alert('All annotation data cleared!');
    }
  };

  // Show rank panel
  const handleRank = () => {
    // Parse annotation_data to calculate rank
    const data = localStorage.getItem('annotation_data');
    
    if (!data) {
      setRankData([]);
      setShowRank(true);
      return;
    }

    try {
      const parsed = JSON.parse(data);
      const userStats: { [key: string]: number } = {};

      // Count annotations per user
      parsed.annotation_records.forEach((record: any) => {
        // Use 'annotator' field which is the correct field name in AnnotationSession
        const user = record.annotator || 'Unknown';
        if (!userStats[user]) {
          userStats[user] = 0;
        }
        // Count the number of images annotated by this user
        userStats[user] += 1;
      });

      // Convert to sorted array
      const sortable: Array<[string, number]> = Object.entries(userStats);
      sortable.sort((a, b) => b[1] - a[1]);
      
      setRankData(sortable);
      setShowRank(true);
    } catch (error) {
      console.error('Failed to parse annotation data for ranking:', error);
      setRankData([]);
      setShowRank(true);
    }
  };

  // Show details dialog
  const handleDetails = () => {
    alert('框頭，整顆頭！YEE！');
  };

  // Toggle grid validation (d key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') {
        setShowGrid(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get annotation count (client-side only)
  const [annotationCount, setAnnotationCount] = useState(0);
  
  useEffect(() => {
    const getAnnotationCount = () => {
      const data = localStorage.getItem('annotation_data');
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.total_images || 0;
      }
      return 0;
    };
    setAnnotationCount(getAnnotationCount());
    
    // Update count periodically
    const interval = setInterval(() => {
      setAnnotationCount(getAnnotationCount());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="wrapper">
      <div id="main">
        {/* Main panel */}
        <div id="image-annotation" className={`panel ${!showRank ? 'active' : ''}`}>
          <div className="image-container">
            {currentImage && imageMetadata ? (
              <>
                <ImageCanvas
                  image={currentImage}
                  imageMetadata={imageMetadata}
                  boundingBoxes={boundingBoxes}
                  onAddBoundingBox={addBoundingBox}
                  onUpdateBoundingBox={updateBoundingBox}
                  onDeleteBoundingBox={deleteBoundingBox}
                />
                {showGrid && (
                  <div className="grid-overlay">
                    {[...Array(10)].map((_, i) => (
                      <React.Fragment key={i}>
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: `${i * 10}%`,
                            width: '1px',
                            height: '100%',
                            backgroundColor: 'rgba(255, 0, 0, 0.5)',
                            pointerEvents: 'none'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: `${i * 10}%`,
                            left: 0,
                            width: '100%',
                            height: '1px',
                            backgroundColor: 'rgba(255, 0, 0, 0.5)',
                            pointerEvents: 'none'
                          }}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#fff', padding: '2em' }}>Loading image...</div>
            )}
          </div>
        </div>

        {/* Rank panel */}
        <div id="rank-container" className={`panel ${showRank ? 'active' : ''}`}>
          <h1>Rank</h1>
          <div className='tbl-header'>
            <table cellPadding='0' cellSpacing='0' border={0}>
              <thead>
                <tr><th>Name</th><th>Count</th></tr>
              </thead>
            </table>
          </div>
          <div className='tbl-content'>
            <table cellPadding='0' cellSpacing='0' border={0}>
              <tbody id="rank-body">
                {rankData.map(([name, count], index) => (
                  <tr key={index}>
                    <td>{name}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button id="back-to-game" className="button" onClick={() => setShowRank(false)}>
            Back
          </button>
        </div>
      </div>

      {/* Toolbar at bottom */}
      <div id="toolbar">
        <div className="left-controls">
          <input
            type="text"
            id="userName"
            placeholder="Enter your name"
            value={userName}
            onChange={handleUserNameChange}
            required
          />
          <div id="image-dimensions">
            {imageMetadata && (
              <>
                Original: {imageMetadata.originalSize.width}×{imageMetadata.originalSize.height} |
                Display: {Math.round(imageMetadata.displaySize.width)}×{Math.round(imageMetadata.displaySize.height)} |
                Scale: {(imageMetadata.scaleFactor * 100).toFixed(2)}%
              </>
            )}
          </div>
        </div>
        <div className="center-controls">
          <button id="add" className="button" onClick={() => addBoundingBox()}>
            Add Box
          </button>
          <button id="del" className="button" onClick={deleteLastBoundingBox}>
            Delete Box
          </button>
          <button id="submit" className="button" onClick={handleSubmit}>
            Submit Annotation
          </button>
          <button id="export-all" className="button" onClick={handleExportAll}>
            Export All Data
          </button>
          <button id="clear-all" className="button" onClick={handleClearAll}>
            Clear All Data
          </button>
        </div>
        <div className="right-controls">
          <button id="rank" className="button" onClick={handleRank}>
            Rank
          </button>
          <button id="details" className="button" onClick={handleDetails}>
            Details
          </button>
        </div>
        <h1 id="count" className="count-header">{annotationCount}</h1>
      </div>
    </div>
  );
};

export default ImageAnnotationSystem;
