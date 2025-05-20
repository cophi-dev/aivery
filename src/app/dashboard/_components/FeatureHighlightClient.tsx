"use client";

import { FeatureHighlightSection } from "@/components/dashboard/FeatureHighlightSection";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export function FeatureHighlightClient() {
  const { data: session } = useSession();
  const [shouldShow, setShouldShow] = useState(true);
  
  // This would ideally check some user preference or last viewed date
  // For now, we'll use local storage to prevent showing it every time
  useEffect(() => {
    const hasSeenHighlights = localStorage.getItem("hasSeenHighlights");
    if (hasSeenHighlights) {
      setShouldShow(false);
    }
  }, []);
  
  const dismissHighlights = () => {
    localStorage.setItem("hasSeenHighlights", "true");
    setShouldShow(false);
  };
  
  if (!shouldShow) return null;
  
  return (
    <div className="relative">
      <button 
        onClick={dismissHighlights}
        className="absolute top-2 right-2 z-10 rounded-full p-1 bg-muted/80 text-muted-foreground hover:bg-muted transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
        <span className="sr-only">Dismiss</span>
      </button>
      <FeatureHighlightSection className="mb-6 mt-2" />
    </div>
  );
} 