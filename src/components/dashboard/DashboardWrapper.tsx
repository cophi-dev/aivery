import React from 'react';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 ai-gradient dark:ai-gradient-dark">
      {/* Minimal Header Spacer - More generous for breathing room */}
      <div className="h-24"></div>
      
      {/* Editorial Main Content */}
      <main className="editorial-container">
        <div className="space-y-12 pb-32">
          {children}
        </div>
      </main>
    </div>
  );
}

export default DashboardWrapper; 