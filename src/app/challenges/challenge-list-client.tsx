"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Trophy, Target, TrendingUp, Activity, Gauge, Route, Dumbbell, CalendarDays, Sparkles, Repeat, RefreshCw, Loader2, Info, Lightbulb, BarChart, CheckCircle, X } from "lucide-react";
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
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { format } from "date-fns";
import type { ChallengeMetric } from "@prisma/client";

// --- Helper functions (Copied from original page.tsx) ---

// Helper function to calculate progress percentage
const calculateProgress = (current: number | null | undefined, goal: number | null | undefined, start?: number | null | undefined, metric?: ChallengeMetric | null ): number => {
    // Ensure values are valid numbers
    const currentVal = typeof current === 'number' ? current : 0;
    const goalVal = typeof goal === 'number' ? goal : 0;
    const startVal = typeof start === 'number' ? start : null;

    if (goalVal === 0 && metric !== 'Pace' && metric !== 'Time') return currentVal > 0 ? 100 : 0; // Handle 0 goal for non-inverse

    // Handle inverse metrics like Pace/Time (lower is better)
    if (metric === 'Pace' || metric === 'Time') { 
        // If current is already at or better than goal, progress is 100%
        if (currentVal <= goalVal) return 100; 
        // Use provided start value, or default to current if start is null/undefined or not worse than goal
        const benchmark = (startVal !== null && startVal > goalVal) ? startVal : currentVal; 
        // If benchmark is already at or better than goal, and current isn't, progress is 0%
        if (benchmark <= goalVal) return 0;
        // Calculate progress based on the gap between benchmark and goal
        const progress = ((benchmark - currentVal) / (benchmark - goalVal)) * 100;
        return Math.max(0, Math.min(100, progress));
    }
    
    // Default logic (higher is better)
    return Math.max(0, Math.min(100, (currentVal / goalVal) * 100));
};

// Helper to format values with units
const formatValue = (value: number | null | undefined, unit: string | null | undefined): string => {
    if (value === null || value === undefined || !isFinite(value)) return 'N/A'; // Added !isFinite check
    if (unit === 's/m') {
        const totalSecondsPerKm = value * 1000;
        // if (isNaN(totalSecondsPerKm) || !isFinite(totalSecondsPerKm)) return 'N/A'; // Redundant with check above
        const minutes = Math.floor(totalSecondsPerKm / 60);
        const seconds = Math.floor(totalSecondsPerKm % 60); // Correct logic
        return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
    } else if (unit === 'kg' || unit === 'km' || unit === 'm') { // Added meters
         return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
    } else if (unit === 'reps' || unit === 'sessions' || unit === 'days' || unit === 'exercises' || unit === 'points') { // Added exercises, points
        return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
    }
    // Fallback for other units or no unit
    return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
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

function ChallengeDetailModal({ 
  challenge, 
  isOpen, 
  onClose 
}: { 
  challenge: Challenge | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!challenge) return null;

  const progress = calculateProgress(
    challenge.currentValue, 
    challenge.goalValue, 
    challenge.startValue, 
    challenge.metric
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <div className="relative space-y-6 pt-2">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-muted">
              {challengeIcons[challenge.type] && (
                <span className="text-primary">
                  {React.createElement(challengeIcons[challenge.type], { size: 24 })}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <h2 className="text-2xl font-semibold">
                {challenge.title}
              </h2>
              <p className="text-muted-foreground">
                {challenge.description}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X size={24} />
              <span className="sr-only">Close</span>
            </button>
          </div>

          {/* Progress Circle */}
          <div className="flex justify-center py-8">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
                <circle
                  className="text-muted"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="none"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <motion.circle
                  className="text-primary"
                  strokeWidth="8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  r="40"
                  cx="50"
                  cy="50"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: progress / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-bold">
                  {progress.toFixed(0)}%
                </span>
                <span className="text-sm text-muted-foreground">Complete</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl font-semibold">
                {formatValue(challenge.currentValue, challenge.unit)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Goal</p>
              <p className="text-2xl font-semibold">
                {formatValue(challenge.goalValue, challenge.unit)}
              </p>
            </div>
            {challenge.startValue !== null && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Starting Value</p>
                  <p className="text-2xl font-semibold">
                    {formatValue(challenge.startValue, challenge.unit)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Improvement</p>
                  <p className="text-2xl font-semibold">
                    {calculateImprovement(challenge.currentValue, challenge.startValue, challenge.metric)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Close
            </Button>
            {!challenge.completedAt && (
              <Button 
                onClick={() => router.push('/workouts/new')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Start Workout
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function calculateImprovement(current: number | null | undefined, start: number | null | undefined, metric: ChallengeMetric | null): string {
    if (current === null || current === undefined || start === null || start === undefined || start === 0 || !isFinite(current) || !isFinite(start)) {
        return "N/A"; // Not enough data or invalid start value
    }

    if (metric === 'Pace' || metric === 'Time') {
        const improvement = ((start - current) / start) * 100;
        if (Math.abs(improvement) < 0.05) return "0.0% change"; // Handle very small changes
        return improvement > 0 ? `${improvement.toFixed(1)}% faster` : `${Math.abs(improvement).toFixed(1)}% slower`;
    } else {
        const improvement = ((current - start) / start) * 100;
         if (Math.abs(improvement) < 0.05) return "0.0% change"; // Handle very small changes
        return improvement >= 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
    }
}

// Add this component for the confetti animation
function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-primary"
          initial={{
            opacity: 1,
            scale: 0,
            x: 0,
            y: 0,
          }}
          animate={{
            opacity: 0,
            scale: 1,
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 1,
            ease: "easeOut",
            delay: Math.random() * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Add this component for the challenge card
function ChallengeCard({ challenge, onClick }: { challenge: Challenge; onClick: () => void }) {
  const Icon = challengeIcons[challenge.type] || challengeIcons.default;
  const progress = calculateProgress(challenge.currentValue, challenge.goalValue, challenge.startValue, challenge.metric);
  const controls = useAnimation();

  useEffect(() => {
    if (challenge.status === 'Completed') {
      controls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 0.3 }
      });
    }
  }, [challenge.status, controls]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <Card className={`
        relative overflow-hidden
        bg-card border border-border/50
        hover:border-border/80 transition-all duration-300
        ${challenge.status === 'Completed' ? 'bg-primary/5' : ''}
      `}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">
            {challenge.title}
          </CardTitle>
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>

        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            {challenge.description}
          </div>

          <div className="space-y-3">
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <span className="font-medium">
                  {formatValue(challenge.currentValue, challenge.unit)}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">
                  {formatValue(challenge.goalValue, challenge.unit)}
                </span>
              </div>
              <span className={`font-medium ${progress === 100 ? 'text-primary' : ''}`}>
                {challenge.status === 'Completed' ? (
                  <span className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Complete
                  </span>
                ) : (
                  `${progress.toFixed(0)}%`
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ChallengeListClient({ initialChallenges, onRefreshChallenges }: ChallengeListClientProps) {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Calculate stats based on the *current* state
  const totalChallenges = challenges.length;
  const completedCount = challenges.filter(c => c.status === "Completed").length; 
  const overallProgress = totalChallenges > 0 
      ? challenges.reduce((sum, c) => sum + calculateProgress(c.currentValue, c.goalValue, c.startValue, c.metric), 0) / totalChallenges
      : 0;

  useEffect(() => {
    console.log("[ChallengeListClient] initialChallenges prop changed, updating state.");
    setChallenges(initialChallenges);
  }, [initialChallenges]);

  // Handle challenge completion
  useEffect(() => {
    const completedCount = challenges.filter(c => c.status === 'Completed').length;
    if (completedCount > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }
  }, [challenges]);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await onRefreshChallenges();
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

  // --- Render Logic ---
  if (error && !isRefreshing) {
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && <Confetti />}
      </AnimatePresence>

      {/* Header Section */}
      <div className="space-y-4">
        <h1 className="relative">
          <span className="text-4xl font-bold tracking-tight lg:text-5xl bg-gradient-to-br from-foreground from-20% via-foreground/80 via-50% to-foreground/25 to-90% bg-clip-text text-transparent">
            Monthly Challenges
          </span>
          <span className="sr-only">Monthly Challenges</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-[750px]">
          Your personalized fitness goals, dynamically generated based on your workout history and progress. Each challenge adapts to your performance, pushing you to achieve new milestones.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="group overflow-hidden relative border-0 bg-white/5 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground/80">Active Challenges</p>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  {challenges.length}
                </h2>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Trophy className="h-8 w-8 text-primary relative z-10" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden relative border-0 bg-white/5 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground/80">Completed</p>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  {completedCount}
                </h2>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <CheckCircle className="h-8 w-8 text-primary relative z-10" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden relative border-0 bg-white/5 backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground/80">Overall Progress</p>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  {overallProgress.toFixed(0)}%
                </h2>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <BarChart className="h-8 w-8 text-primary relative z-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="relative group border-0 bg-white/5 backdrop-blur-xl hover:bg-white/10"
        >
          <RefreshCw className={`
            mr-2 h-4 w-4 text-primary
            ${isRefreshing ? 'animate-spin' : 'group-hover:animate-spin'}
          `} />
          Refresh Challenges
          <span className="absolute inset-0 rounded-md bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </div>

      {/* Challenge Grid */}
      {challenges.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onClick={() => {
                setSelectedChallenge(challenge);
                setIsDetailOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-block p-3 rounded-full bg-primary/5 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Active Challenges</h3>
          <p className="text-muted-foreground mb-6">
            Complete some workouts or click Refresh to generate new personalized challenges.
          </p>
          <Button onClick={() => router.push('/workouts/new')}>
            Start a Workout
          </Button>
        </div>
      )}

      {/* Challenge Detail Modal */}
      <ChallengeDetailModal
        challenge={selectedChallenge}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
} 