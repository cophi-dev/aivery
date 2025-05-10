"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PRAchievement } from '@/components/ui/pr-achievement';

interface PRNotification {
  prType: string;
  value: string;
}

interface PRNotificationContextType {
  showPR: (prType: string, value: string) => void;
  activePRs: PRNotification[];
}

const PRNotificationContext = createContext<PRNotificationContextType | undefined>(undefined);

export function usePRNotification() {
  const context = useContext(PRNotificationContext);
  if (context === undefined) {
    throw new Error('usePRNotification must be used within a PRNotificationProvider');
  }
  return context;
}

export function PRNotificationProvider({ children }: { children: React.ReactNode }) {
  const [activePRs, setActivePRs] = useState<PRNotification[]>([]);
  const [currentPR, setCurrentPR] = useState<PRNotification | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  
  // Queue system for PRs
  useEffect(() => {
    if (!showNotification && activePRs.length > 0) {
      // Show next PR in queue
      setCurrentPR(activePRs[0]);
      setShowNotification(true);
      
      // Remove from queue
      setActivePRs(prev => prev.slice(1));
    }
  }, [showNotification, activePRs]);
  
  // Function to trigger PR notification
  const showPR = (prType: string, value: string) => {
    const newPR = { prType, value };
    
    // If no PR is currently showing, show it immediately
    if (!showNotification && activePRs.length === 0) {
      setCurrentPR(newPR);
      setShowNotification(true);
    } else {
      // Otherwise, add to queue
      setActivePRs(prev => [...prev, newPR]);
    }
  };
  
  const handleClose = () => {
    setShowNotification(false);
    setCurrentPR(null);
  };
  
  return (
    <PRNotificationContext.Provider value={{ showPR, activePRs }}>
      {children}
      
      {currentPR && (
        <PRAchievement
          prType={currentPR.prType}
          value={currentPR.value}
          isOpen={showNotification}
          onClose={handleClose}
        />
      )}
    </PRNotificationContext.Provider>
  );
} 