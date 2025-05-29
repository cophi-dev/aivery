'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserAvatar } from "@/components/user-avatar";
import { getQuote } from "@/lib/client-utils";
import UserNicknameDisplay from "@/components/UserNicknameDisplay";
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  displayName: ReactNode;
  userImage: string | null;
}

export function DashboardHeader({ displayName, userImage }: DashboardHeaderProps) {
  const [quote, setQuote] = useState("");
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuoteData = useCallback(async (forceFresh = false) => {
    try {
      const quoteText = await getQuote(location?.lat, location?.lon, forceFresh);
      setQuote(quoteText);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setQuote("Your fitness journey begins with a single step.");
    }
  }, [location]);

  useEffect(() => {
    let isMounted = true;
    fetchQuoteData(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQuoteData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const quoteInterval = setInterval(() => {
      fetchQuoteData(true);
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQuoteData]);

  useEffect(() => {
    async function fetchInsight() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/daily-insight?fresh=${Math.random()}`);
        if (!response.ok) throw new Error('Failed to fetch daily insight');
        const data = await response.json();
        setInsight(data.insight || '');
      } catch (err: any) {
        setError('Could not load daily insight.');
      } finally {
        setLoading(false);
      }
    }
    fetchInsight();
  }, []);

  // Get current time for minimal greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className={cn(
      "w-full py-12 md:py-16 lg:py-20 animate-fade-in",
      "bg-gradient-to-b from-background to-background/80"
    )}>
      <div className="max-w-4xl mx-auto px-6">
        {/* Date */}
        <div className="mb-4">
          <time className="text-caption uppercase tracking-wider text-neutral-500 font-medium">
            {currentDate}
          </time>
        </div>

        {/* Main Greeting */}
        <div className="space-y-3 mb-8">
          <h1 className={cn(
            "font-display text-display-md lg:text-display-lg",
            "text-foreground tracking-tight leading-none"
          )}>
            {getGreeting()}
          </h1>
          
          <div className="flex items-center gap-4">
            <UserAvatar 
              imageUrl={userImage}
              size="md"
              className="ring-2 ring-background shadow-lg"
            />
            <div>
              <p className="text-heading-md text-foreground/90 font-medium">
                {displayName}
              </p>
              <div className="w-8 h-0.5 bg-primary mt-1 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Daily Insight */}
        <div className="max-w-2xl">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
              <span className="text-body-sm text-neutral-500">Generating insight</span>
            </div>
          ) : error ? (
            <p className="text-body-lg text-neutral-600 leading-relaxed italic">
              Ready to make today count?
            </p>
          ) : (
            <p className="text-body-lg text-neutral-700 leading-relaxed max-w-none">
              {insight}
            </p>
          )}
        </div>
      </div>
    </header>
  );
} 