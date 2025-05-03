"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Trophy, Target, TrendingUp, Activity, Gauge, Route, Dumbbell, CalendarDays, Sparkles, Repeat, RefreshCw, Loader2, Info, Lightbulb, BarChart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Challenge } from '@prisma/client'; // Use Prisma type

// --- Helper functions (Copied from original page.tsx) ---

// Helper function to calculate progress percentage
const calculateProgress = (current: number, goal: number, start?: number | null, metric?: string ): number => {
    // Handle inverse metrics like Pace/Time (lower is better)
    if (metric === 'Pace' || metric === 'Time') { 
        const startVal = (start !== null && start !== undefined && start > goal) ? start : goal * 1.1;
        if (goal <= 0 || startVal <= goal) return current <= goal ? 100 : 0; 
        const progress = ((startVal - current) / (startVal - goal)) * 100;
        return Math.max(0, Math.min(100, progress));
    }
    // Default logic (higher is better)
    if (goal <= 0) return current > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, (current / goal) * 100));
};

// Helper to format values with units
const formatValue = (value: number | null | undefined, unit: string | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    if (unit === 's/m') {
        const paceMinKm = (value * 1000) / 60;
        if (isNaN(paceMinKm) || !isFinite(paceMinKm)) return 'N/A'; 
        const minutes = Math.floor(paceMinKm);
        const seconds = Math.round((paceMinKm - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    } else if (unit === 'kg' || unit === 'km') {
         return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
    } else if (unit === 'reps' || unit === 'sessions' || unit === 'days' || unit === 'categories') {
        return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
    }
    return `${value}${unit ? ` ${unit}` : ''}`;
};

// --- Icon Mapping ---
const challengeIcons: Record<string, React.ElementType> = {
    StrengthPR: Dumbbell, RepMaxPR: Dumbbell, BodyweightReps: Activity,
    DistanceTime: Gauge, DistancePace: Gauge, LongestSession: Route,
    MonthlyDistance: Route, MonthlyVolume: TrendingUp, WorkoutFrequency: CalendarDays,
    ExerciseVariety: Sparkles, ConsistencyStreak: Repeat, default: Target 
};

// --- Feasibility Logic ---
const getFeasibility = (challenge: Challenge): { level: string; color: string } => {
    const progress = calculateProgress(challenge.currentValue, challenge.goalValue, challenge.startValue, challenge.metric);
    const goalDelta = Math.abs(challenge.goalValue - (challenge.startValue ?? challenge.currentValue));
    const startValue = challenge.startValue ?? challenge.currentValue;
    if (challenge.metric === 'Pace' || challenge.metric === 'Time') {
        const improvementPercentage = startValue > 0 ? ((startValue - challenge.goalValue) / startValue) * 100 : 0;
        if (improvementPercentage > 5) return { level: 'Ambitious', color: 'bg-red-500' };
        if (improvementPercentage > 2) return { level: 'Stretch Goal', color: 'bg-yellow-500' };
        return { level: 'Achievable', color: 'bg-green-500' };
    } else {
        const improvementPercentage = startValue > 0 ? (goalDelta / startValue) * 100 : (challenge.goalValue > 0 ? 100 : 0);
         if (improvementPercentage > 20) return { level: 'Ambitious', color: 'bg-red-500' };
         if (improvementPercentage > 10) return { level: 'Stretch Goal', color: 'bg-yellow-500' };
         return { level: 'Achievable', color: 'bg-green-500' };
    }
};

// --- Suggestions Logic ---
const getSuggestions = (challenge: Challenge): string[] => {
    switch (challenge.type) {
        case 'StrengthPR': return ["Focus on progressive overload.", "Ensure proper form.", "Incorporate accessory exercises.", "Optimize nutrition and rest."];
        case 'BodyweightReps': return ["Practice variations.", "Increase training frequency.", "Work on core strength.", "Try 'greasing the groove'."];
        case 'LongestSession': return ["Gradually increase duration/distance.", "Incorporate easy-paced runs.", "Pay attention to hydration/fueling.", "Listen to your body."];
        case 'DistancePace': return ["Incorporate interval training.", "Try tempo runs.", "Work on running form.", "Include strength training."];
        case 'MonthlyDistance': case 'MonthlyVolume': return ["Plan your workouts.", "Break goal into weekly targets.", "Track cumulative progress.", "Stay consistent."];
        case 'WorkoutFrequency': case 'ConsistencyStreak': return ["Schedule workouts.", "Find enjoyable activities.", "Prepare gear beforehand.", "Get back on track if you miss."];
        case 'ExerciseVariety': return ["Explore templates/classes.", "Dedicate time to try new things.", "Target unused muscle groups.", "Focus on functional fitness."];
        default: return ["Consistency is key!", "Listen to your body.", "Celebrate small victories."];
    }
};

// --- Client Component ---

interface ChallengeListClientProps {
  initialChallenges: Challenge[];
  onRefreshChallenges: () => Promise<{ success: boolean; message?: string; error?: string }>;
}

export function ChallengeListClient({ initialChallenges, onRefreshChallenges }: ChallengeListClientProps) {
  // Use initialChallenges directly, no client-side fetching needed here
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null); // Keep error state for refresh action
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await onRefreshChallenges(); // Call the passed server action
      // Note: We might not need to manually setChallenges here if revalidatePath works
      // But for immediate feedback, could potentially refetch or rely on router.refresh() in parent
      toast({ title: "Challenges Refreshed!", description: "New challenges generated." });
    } catch (e: any) {
      console.error("Failed to refresh challenges:", e);
      setError(e.message || "Failed to refresh challenges.");
      toast({
        variant: "destructive",
        title: "Error Refreshing Challenges",
        description: e.message || "Could not refresh challenges.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenDetail = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setIsDetailOpen(true);
  };

  // --- Render Logic ---
  if (error && !isRefreshing) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  return (
    <>
      {/* Header section with interactive elements */}
      <div className="flex justify-between items-center mb-6"> 
         {/* <h1 className="text-3xl font-bold tracking-tight">Monthly Challenges</h1> */}
         {/* Add a placeholder or adjust spacing if needed now title is gone */}
         <div></div> {/* Placeholder to maintain flex layout */}
         {/* Keep Refresh Button and Dialog here */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Challenges
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refresh Monthly Challenges?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear your current challenges and generate a new set for this month. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRefreshing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRefreshClick} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Empty state message */}
      {challenges.length === 0 && !isRefreshing && (
         <div className="text-center text-gray-500 py-10">
            <p>No challenges found for this month.</p>
            <p>Complete some workouts or click Refresh to generate new ones.</p>
         </div>
       )}

      {/* Challenge Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {challenges.map((challenge) => {
          const Icon = challengeIcons[challenge.type] || challengeIcons.default;
          const progress = calculateProgress(challenge.currentValue, challenge.goalValue, challenge.startValue, challenge.metric);
          const feasibility = getFeasibility(challenge);
          
          return (
            <Card key={challenge.id} className="hover:shadow-lg transition-shadow duration-200 cursor-pointer relative overflow-hidden group" onClick={() => handleOpenDetail(challenge)}>
              {/* Feasibility Badge */}
               <Badge 
                    variant="default" 
                    className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full text-white ${feasibility.color}`}
                >
                    {feasibility.level}
                </Badge>
                
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium pr-10"> {/* Added padding right */}
                  {challenge.title}
                </CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {challenge.description}
                </div>
                <Progress value={progress} className="mb-2 h-2" />
                <div className="text-xs font-medium flex justify-between">
                  <span>{formatValue(challenge.currentValue, challenge.unit)} / {formatValue(challenge.goalValue, challenge.unit)}</span>
                  <span className={`${progress === 100 ? 'text-green-500' : 'text-muted-foreground'}`}>
                     {challenge.status === 'Completed' ? 'Completed!' : `${progress.toFixed(0)}%`}
                   </span>
                </div>
              </CardContent>
               {/* Info icon for suggestions hint */}
               <Info className="absolute bottom-2 right-2 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Card>
          );
        })}
      </div>

      {/* Challenge Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Target className="mr-2 h-5 w-5"/> {selectedChallenge?.title}</DialogTitle>
            <DialogDescription>
              {selectedChallenge?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Current Progress:</span>
                <span className="text-sm font-semibold">{formatValue(selectedChallenge?.currentValue, selectedChallenge?.unit)}</span>
            </div>
             <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Goal:</span>
                <span className="text-sm font-semibold">{formatValue(selectedChallenge?.goalValue, selectedChallenge?.unit)}</span>
            </div>
             <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge 
                    variant={"default"} 
                    className={selectedChallenge?.status === 'Completed' ? 'bg-green-500 text-white' : 'bg-secondary text-secondary-foreground'}
                >
                     {selectedChallenge?.status}
                </Badge>
            </div>
            <Progress 
                value={calculateProgress(selectedChallenge?.currentValue ?? 0, selectedChallenge?.goalValue ?? 0, selectedChallenge?.startValue, selectedChallenge?.metric)} 
                className="h-3" />
            
             {/* Feasibility */}
            {selectedChallenge && (
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Feasibility:</span>
                    <Badge 
                        variant="default" 
                        className={`text-xs font-semibold px-2 py-1 rounded-full text-white ${getFeasibility(selectedChallenge).color}`}
                    >
                        {getFeasibility(selectedChallenge).level}
                    </Badge>
                </div>
            )}

            {/* Suggestions */}
            {selectedChallenge && (
                <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2 flex items-center"><Lightbulb className="mr-2 h-4 w-4 text-yellow-500"/> Suggestions:</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                        {getSuggestions(selectedChallenge).map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            )}
          </div>
          <DialogFooter>
             <DialogClose asChild>
                 <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 