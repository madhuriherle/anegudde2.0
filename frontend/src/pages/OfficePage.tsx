import React from 'react';

const OfficePage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-4">
      <div className="p-6 bg-purple-50 rounded-full text-purple-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      </div>
      <h2 className="text-2xl font-bold text-secondary font-serif">Office Module</h2>
      <p className="text-gray-500 max-w-md">The Office module is currently under development. Please check back later.</p>
    </div>
  );
};

export default OfficePage;
