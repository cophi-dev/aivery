'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserAvatar } from "@/components/user-avatar";
import { getQuote } from "@/lib/client-utils";
import UserNicknameDisplay from "@/components/UserNicknameDisplay";
import { type ReactNode } from 'react';

interface DashboardHeaderProps {
  displayName: ReactNode;
  userImage: string | null;
}

export function DashboardHeader({ displayName, userImage }: DashboardHeaderProps) {
  const [quote, setQuote] = useState("Loading quote...");
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null); // Optional location state

  // Function to fetch quote (similar to original logic)
  const fetchQuoteData = useCallback(async (forceFresh = false) => {
    try {
      // console.log(`[Header] Fetching quote...`);
      // Pass location if available, and force refresh flag
      const quoteText = await getQuote(location?.lat, location?.lon, forceFresh);
      setQuote(quoteText);
      // console.log(`[Header] Quote updated: ${quoteText.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setQuote("Your fitness journey begins with a single step."); // Fallback quote
    }
  }, [location]); // Dependency on location if used

  // Initial quote fetch and setup interval/listeners (similar to original logic)
  useEffect(() => {
    let isMounted = true;

    // Fetch immediately
    fetchQuoteData(true);

    // Optional: Get location if needed for quote API
    // navigator.geolocation.getCurrentPosition(pos => {
    //   if (isMounted) setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    // }, err => console.error("Geo error:", err));

    // Refresh on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // console.log('[Header] Tab visible again, refreshing quote');
        fetchQuoteData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Refresh periodically
    const quoteInterval = setInterval(() => {
      // console.log('[Header] Quote refresh interval');
      fetchQuoteData(true);
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQuoteData]); // Ensure fetchQuoteData is stable or included

  return (
    <section className="p-4 md:p-6 bg-card rounded-xl shadow-sm w-full max-w-4xl">
      <div className="flex items-center gap-3 md:gap-4">
        <UserAvatar 
          imageUrl={userImage}
          size="lg"
        />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            Hey {displayName}!
          </h1>
          {/* Add a button to manually refresh quote? */} 
          <p className="text-sm text-muted-foreground mt-1 italic">{quote}</p> 
        </div>
      </div>
    </section>
  );
} 