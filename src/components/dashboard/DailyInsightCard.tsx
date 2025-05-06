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
  error?: { // Add optional error field
    message: string;
    type: 'ai_generation' | 'data_fetch';
  } | null;
}

export const DailyInsightCard: React.FC = () => {
  // State for loading, error, and fetched data
  const [data, setData] = useState<DailyInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsight = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/daily-insight');
        if (!response.ok) {
          throw new Error(`Failed to fetch insight: ${response.statusText}`);
        }
        const result: DailyInsightData = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Could not load daily insight.');
        console.error("Error fetching daily insight:", err);
      } finally {
        setIsLoading(false);
      }
    };

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
        </CardContent>
      </Card>
    );
  }

  // Success State (data is available)
  if (!data) {
    return null; // Should not happen if not loading and no error, but good practice
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
        <CardDescription>{data.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Check for internal errors returned in the response */}
        {data.error ? (
          <p className="text-sm text-destructive italic">
            ⚠️ {data.error.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data.insight}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyInsightCard; 