'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserAvatar } from "@/components/user-avatar";
import { getQuote } from "@/lib/client-utils";
import UserNicknameDisplay from "@/components/UserNicknameDisplay";
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sun, Moon } from 'lucide-react';

interface DashboardHeaderProps {
  displayName: ReactNode;
  userImage: string | null;
}

export function DashboardHeader({ displayName, userImage }: DashboardHeaderProps) {
  const [quote, setQuote] = useState("Loading quote...");
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

  // Get current time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: Sun };
    if (hour < 17) return { text: "Good afternoon", icon: Sun };
    return { text: "Good evening", icon: Moon };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  return (
    <section 
      className={cn(
        "p-6 md:p-8 rounded-xl w-full",
        "bg-card border shadow-sm",
        "hover:shadow-md transition-shadow duration-200"
      )}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar */}
        <div className="relative">
          <UserAvatar 
            imageUrl={userImage}
            size="lg"
            className="shadow-sm"
          />
          {/* Simple status indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background" />
        </div>
        
        <div className="flex-1 text-center sm:text-left space-y-2">
          {/* Time-based greeting */}
          <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
            <GreetingIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{greeting.text}</span>
          </div>
          
          {/* Main heading */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Welcome back, <span className="text-primary">{displayName}</span>!
          </h1>
          
          {/* Daily insight */}
          <div className="pt-1">
            {loading ? (
              <div className="flex items-center justify-center sm:justify-start gap-1">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <span className="text-sm text-muted-foreground ml-2">Loading your daily insight...</span>
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground italic">
                Ready to crush your fitness goals today? 💪
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic leading-relaxed max-w-2xl">
                {insight}
              </p>
            )}
          </div>
        </div>

        {/* Date display */}
        <div className="hidden lg:flex flex-col items-center text-center">
          <div className="p-3 rounded-lg bg-muted/50">
            <GreetingIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <div className="font-semibold">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 