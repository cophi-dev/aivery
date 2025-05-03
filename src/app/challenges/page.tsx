"use client"; // Add this directive for hooks

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Assuming Card component is available
import { Progress } from "@/components/ui/progress"; // Assuming Progress component is available
import { Button } from "@/components/ui/button"; // Import Button
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { toast } from "@/components/ui/use-toast"; // Import toast for feedback
import { Trophy, Target, TrendingUp, Activity, Gauge, Route, Dumbbell, CalendarDays, Sparkles, Repeat, RefreshCw, Loader2 } from "lucide-react"; // Icons for visual flair

// Matches Prisma Challenge model + needed fields
interface Challenge {
  id: string; 
  title: string;
  description: string;
  goalValue: number; 
  currentValue: number; 
  startValue?: number | null;
  unit?: string | null;
  status: 'NotStarted' | 'InProgress' | 'Completed' | 'Failed';
  type: string; // ChallengeType enum as string
  metric: string; // ChallengeMetric enum as string
}

// Helper function to calculate progress percentage
const calculateProgress = (current: number, goal: number, start?: number | null, metric?: string ): number => {
    // Handle inverse metrics like Pace/Time (lower is better)
    if (metric === 'Pace' || metric === 'Time') { 
        // If startValue is missing or invalid, estimate it (e.g., 10% worse than goal)
        // This is a fallback, ideally startValue should always be present for inverse goals.
        const startVal = (start !== null && start !== undefined && start > goal) ? start : goal * 1.1;
        if (goal <= 0 || startVal <= goal) return current <= goal ? 100 : 0; // Goal met or invalid range
        const progress = ((startVal - current) / (startVal - goal)) * 100;
        return Math.max(0, Math.min(100, progress));
    }

    // Default logic (higher is better)
    if (goal <= 0) return current > 0 ? 100 : 0; // Handle goal 0 edge case
    return Math.max(0, Math.min(100, (current / goal) * 100));
};

// Helper to format values with units
const formatValue = (value: number | null | undefined, unit: string | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';

    if (unit === 's/m') {
        // Pace formatting (seconds/meter to min:sec /km)
        const paceMinKm = (value * 1000) / 60;
        if (isNaN(paceMinKm) || !isFinite(paceMinKm)) return 'N/A'; 
        const minutes = Math.floor(paceMinKm);
        const seconds = Math.round((paceMinKm - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    } else if (unit === 'kg' || unit === 'km') {
         // Round kg/km to 1 decimal place
         return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
    } else if (unit === 'reps' || unit === 'sessions' || unit === 'days' || unit === 'categories') {
        // Whole numbers for counts
        return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
    }
    // Default: value + unit (no special formatting/rounding)
    // Consider adding default rounding to 2 decimals? For now, keep as is.
    return `${value}${unit ? ` ${unit}` : ''}`;
};

// --- Icon Mapping --- (Optional, for visual flair)
const challengeIcons: Record<string, React.ElementType> = {
    StrengthPR: Dumbbell,
    RepMaxPR: Dumbbell,
    BodyweightReps: Activity, // Or a specific bodyweight icon?
    DistanceTime: Gauge, // Or Timer?
    DistancePace: Gauge,
    LongestSession: Route,
    MonthlyDistance: Route,
    MonthlyVolume: TrendingUp, // Or Weight?
    WorkoutFrequency: CalendarDays,
    ExerciseVariety: Sparkles,
    ConsistencyStreak: Repeat, // Or CalendarCheck?
    default: Target // Fallback icon
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // State for refresh loading
  const [error, setError] = useState<string | null>(null);

  // Wrap fetchChallenges in useCallback to keep its identity stable
  const fetchChallenges = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/challenges');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
           setChallenges(data);
      } else {
           console.error("Received non-array data for challenges:", data);
           throw new Error("Invalid data format received from server.");
      }
    } catch (e: any) {
      console.error("Failed to fetch challenges:", e);
      setError(e.message || "Failed to load challenges.");
      toast({ // Show error toast
        variant: "destructive",
        title: "Error Loading Challenges",
        description: e.message || "Could not load challenges.",
      })
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []); // Empty dependency array - fetchChallenges function itself doesn't change

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]); // Depend on the stable fetchChallenges function

  // Handle refresh action
  const handleRefreshChallenges = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
        // Call DELETE endpoint
        const deleteResponse = await fetch('/api/challenges', { method: 'DELETE' });
        if (!deleteResponse.ok) {
             const errorData = await deleteResponse.json().catch(() => ({ error: `HTTP error! status: ${deleteResponse.status}` }));
            throw new Error(errorData.error || `Failed to delete challenges. Status: ${deleteResponse.status}`);
        }
        const deleteResult = await deleteResponse.json();
        toast({
            title: "Challenges Cleared",
            description: deleteResult.message || "Previous challenges removed.",
        });

        // Immediately refetch to generate and display new challenges
        await fetchChallenges(false); // Fetch without setting main loading state
        toast({ title: "Challenges Refreshed!", description: "New challenges generated for the month." });

    } catch (e: any) {
        console.error("Failed to refresh challenges:", e);
        setError(e.message || "Failed to refresh challenges.");
         toast({ // Show error toast
            variant: "destructive",
            title: "Error Refreshing Challenges",
            description: e.message || "Could not refresh challenges.",
        })
    } finally {
        setIsRefreshing(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Monthly Challenges</h1>
        </div>
        {/* Refresh Button and Dialog */} 
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isRefreshing || isLoading}>
              {isRefreshing ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              ) : (
                 <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh Challenges
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh Monthly Challenges?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete your current challenges for this month and generate a new set based on your latest progress. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRefreshing}>Cancel</AlertDialogCancel>
              {/* Call handleRefreshChallenges on confirmation */}
              <AlertDialogAction onClick={handleRefreshChallenges} disabled={isRefreshing}>
                 {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="mb-8 text-muted-foreground">
        Welcome to your Monthly Challenges! Based on your progress, we'll set personalized goals here each month to help you push your limits, discover new strengths, and stay motivated.
      </p>

      {/* Display Loading/Error states */}
      {isLoading && (
          <div className="text-center py-10">
            <Activity className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading challenges...</p>
          </div>
      )}
      {/* Display main error OR refresh error */} 
      {error && !isLoading && (
          <p className="text-center text-red-500 py-10">Error: {error}</p>
      )}

      {/* Render challenges or empty state */}
      {!isLoading && !error && (
        // Add relative positioning for potential overlay during refresh?
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isRefreshing ? 'opacity-50 pointer-events-none' : ''}`}>
          {challenges.length > 0 ? (
            challenges.map((challenge) => {
              // Pass metric and startValue to calculateProgress
              const progress = calculateProgress(challenge.currentValue, challenge.goalValue, challenge.startValue, challenge.metric);
              const IconComponent = challengeIcons[challenge.type] || challengeIcons.default;
              
              return (
                <Card key={challenge.id} className="flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-primary flex-shrink-0"/> 
                        {challenge.title || 'Challenge'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground mb-3">{challenge.description || 'Complete this challenge!'}</p>
                    
                    {/* Use updated formatValue */} 
                    <p className="text-sm font-medium mb-1">
                        Goal: {formatValue(challenge.goalValue, challenge.unit)}
                    </p>
                    
                    {/* Display Progress Bar & Text */}
                    <div className="mb-3">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-right text-muted-foreground mt-1">
                            {challenge.status === 'Completed' ? 'Completed!' : 
                             challenge.status === 'Failed' ? 'Failed' : 
                             `${formatValue(challenge.currentValue, challenge.unit)} (${progress.toFixed(0)}%)`}
                        </p>
                    </div>
                    
                  </CardContent>
                </Card>
              );
            })
          ) : (
             <div className="col-span-full text-center py-10">
                  <Trophy className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                 <p className="text-muted-foreground">No challenges generated yet this month.</p>
                 {/* Suggest refresh if applicable? */}
                 {/* <Button variant="link" onClick={() => { }}>Generate Challenges</Button> */}
             </div>
          )}
        </div>
      )}
       {/* TODO: Add logic for generating/fetching challenges and displaying them */}
       {/* TODO: Add logic for tracking progress and marking challenges as complete */}

    </div>
  );
} 