'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dailyContentConfig, daysOfWeek, DailyContent } from '@/lib/config/daily-insight';
import { Skeleton } from "@/components/ui/skeleton";

// Interface for the API response data
interface DailyInsightData {
  title: string;
  description: string;
  insight: string;
  highlight?: string | null;
  positiveTrends?: string[];
  negativeTrends?: string[];
  milestones?: string[];
  error?: {
    message: string;
    type: 'ai_generation' | 'data_fetch' | 'save_error';
  } | null;
}

export const DailyInsightCard: React.FC = () => {
  const [data, setData] = useState<DailyInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const fetchInsight = async (retry = false) => {
    if (retry) {
      setRetryCount(prev => prev + 1);
    } else {
      setRetryCount(0);
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Add cache-busting parameter
      const timestamp = Date.now();
      const response = await fetch(`/api/daily-insight?t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insight: ${response.statusText}`);
      }
      
      const result: DailyInsightData = await response.json();
      
      // Check if we got a valid response
      if (!result || (!result.insight && !result.highlight && !result.error)) {
        throw new Error('Invalid response format from server');
      }
      
      setData(result);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching daily insight:", err);
      
      // If we haven't exceeded max retries and it's a potentially recoverable error
      if (retryCount < MAX_RETRIES && 
          (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('timeout'))) {
        setTimeout(() => {
          fetchInsight(true);
        }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      } else {
        setError(err.message || 'Could not load daily insight.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, []); // Fetch only once on component mount

  // Loading State
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-4/5 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Retrying... ({retryCount}/{MAX_RETRIES})
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription className="text-destructive/90">Could not load daily insight</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/80">{error}</p>
          <button
            onClick={() => fetchInsight()}
            className="mt-2 text-sm text-muted-foreground hover:text-primary underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Insight</CardTitle>
          <CardDescription>Your daily fitness insight is not available</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={() => fetchInsight()}
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            Refresh
          </button>
        </CardContent>
      </Card>
    );
  }

  // Success State (data is available)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
        <CardDescription>{data.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive italic">
              ⚠️ {data.error.message}
            </p>
            <button
              onClick={() => fetchInsight()}
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.highlight && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium text-primary">{data.highlight}</p>
              </div>
            )}
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed text-foreground">
                {data.insight}
              </p>
            </div>
            {data.positiveTrends && data.positiveTrends.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">Performance Strengths</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.positiveTrends.map((trend, i) => (
                    <li key={i} className="text-green-600 dark:text-green-400">{trend}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.negativeTrends && data.negativeTrends.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-400">Optimization Opportunities</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.negativeTrends.map((trend, i) => (
                    <li key={i} className="text-amber-600 dark:text-amber-400">{trend}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.milestones && data.milestones.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-blue-700 dark:text-blue-400">Key Metrics</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {data.milestones.map((milestone, i) => (
                    <li key={i} className="text-blue-600 dark:text-blue-400">{milestone}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyInsightCard; 