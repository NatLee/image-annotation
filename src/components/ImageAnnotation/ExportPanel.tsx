import React from 'react';

const ExportPanel: React.FC = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold">Export</h2>
      <button className="w-full bg-gray-700 text-white p-2 rounded mt-2">Export All Data</button>
    </div>
  );
};

export default ExportPanel;
