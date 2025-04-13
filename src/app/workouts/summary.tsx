'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistance, formatDuration } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchUserWorkoutSummary } from '@/app/actions/workout-actions';

export default function WorkoutSummary() {
  const [summary, setSummary] = useState<{
    totalWorkouts: number;
    totalTimeInSeconds: number;
    totalDistanceInKm: number;
    favoriteType: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setIsLoading(true);
        const data = await fetchUserWorkoutSummary();
        console.log("Fetched workout summary:", data);
        setSummary(data);
      } catch (error) {
        console.error("Error loading workout summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSummary();
  }, []);

  return (
    <Card className="bg-card border-none overflow-hidden">
      <CardContent className="p-0">
        <div className="flex justify-between items-center py-4 px-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-muted-foreground">Total Workouts</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-20 mx-auto mt-1" />
            ) : (
              <p className="text-2xl font-bold">{summary?.totalWorkouts || 0}</p>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-sm font-medium text-muted-foreground">Total Time</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-36 mx-auto mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {summary?.totalTimeInSeconds ? 
                  `${Math.floor(summary.totalTimeInSeconds / 3600)} hours` 
                  : '0 hours'}
              </p>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-sm font-medium text-muted-foreground">Total Distance</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-28 mx-auto mt-1" />
            ) : (
              <div>
                <p className="text-2xl font-bold">{formatDistance(summary?.totalDistanceInKm || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (Running/Cycling)
                </p>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <h3 className="text-sm font-medium text-muted-foreground">Favorite Type</h3>
            {isLoading ? (
              <Skeleton className="h-9 w-24 mx-auto mt-1" />
            ) : (
              <p className="text-2xl font-bold capitalize">{summary?.favoriteType || 'None'}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 