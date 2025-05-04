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
import { Trophy, Target, TrendingUp, Activity, Gauge, Route, Dumbbell, CalendarDays, Sparkles, Repeat, RefreshCw, Loader2, Info, Lightbulb, BarChart, CheckCircle } from "lucide-react";
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {challengeIcons[challenge.type] && (
                <span className="text-primary">
                  {React.createElement(challengeIcons[challenge.type], { size: 24 })}
                </span>
              )}
              {challenge.title}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {challenge.description}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Progress Circle */}
            <div className="flex justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    className="text-muted-foreground/20"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    className="text-primary"
                    strokeWidth="8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: progress / 100 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      transform: "rotate(-90deg)",
                      transformOrigin: "50% 50%",
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-2xl font-bold">{progress.toFixed(0)}%</span>
                    <span className="block text-sm text-muted-foreground">Complete</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Challenge Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-lg font-semibold">
                    {formatValue(challenge.currentValue, challenge.unit)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Goal</p>
                  <p className="text-lg font-semibold">
                    {formatValue(challenge.goalValue, challenge.unit)}
                  </p>
                </div>
                {challenge.startValue !== null && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Starting Value</p>
                      <p className="text-lg font-semibold">
                        {formatValue(challenge.startValue, challenge.unit)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Improvement</p>
                      <p className="text-lg font-semibold">
                        {calculateImprovement(challenge.currentValue, challenge.startValue, challenge.metric)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {challenge.completedAt && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Completed on {format(new Date(challenge.completedAt), 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!challenge.completedAt && (
              <Button onClick={() => router.push('/workouts/new')}>
                Start Workout
              </Button>
            )}
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function calculateImprovement(current: number, start: number, metric: ChallengeMetric): string {
  if (metric === 'Pace' || metric === 'Time') {
    // For these metrics, lower is better
    const improvement = ((start - current) / start) * 100;
    return improvement > 0 ? `${improvement.toFixed(1)}% faster` : `${Math.abs(improvement).toFixed(1)}% slower`;
  } else {
    // For other metrics, higher is better
    const improvement = ((current - start) / start) * 100;
    return improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;
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
  // const feasibility = getFeasibility(challenge);
  // const controls = useAnimation();

  // useEffect(() => {
  //   if (challenge.status === 'Completed') {
  //     controls.start({
  //       scale: [1, 1.02, 1],
  //       transition: { duration: 0.3 }
  //     });
  //   }
  // }, [challenge.status, controls]);

  return (
    // <motion.div
    //   layout
    //   initial={{ opacity: 0, y: 20 }}
    //   animate={controls}
    //   whileHover={{ scale: 1.02 }}
    //   whileTap={{ scale: 0.98 }}
    //   transition={{ duration: 0.2 }}
    // >
      <Card 
        className={`
          relative overflow-hidden group transition-all duration-300 ease-in-out cursor-pointer border-2 border-red-500 // Added red border for visibility
          ${challenge.status === 'Completed' ? 'bg-primary/5 dark:bg-primary/10' : ''}
        `}
        onClick={onClick}
      >
        {/* Feasibility Badge - Commented out for simplicity */}
        {/* <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Badge 
            variant="default" 
            className={`
              absolute top-3 right-3 text-xs font-medium px-2 py-1 rounded-full 
              backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90
              ${feasibility.color.replace('bg-', 'bg-opacity-90 ')}
            `}
          >
            {feasibility.level}
          </Badge>
        </motion.div> */}

        {/* Progress Arc Background - Commented out */}
        {/* <motion.div 
          className="absolute right-0 top-0 w-32 h-32 -mr-16 -mt-16 opacity-5"
          initial={{ rotate: -90 }}
          animate={{ rotate: (progress * 3.6) - 90 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            background: `conic-gradient(currentColor ${progress}%, transparent ${progress}%)`,
            borderRadius: '50%'
          }}
        /> */}
                
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight pr-12">
            {challenge.title}
          </CardTitle>
          {/* <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          > */}
            <Icon className="h-5 w-5 text-primary" />
          {/* </motion.div> */}
        </CardHeader>

        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            {challenge.description}
          </div>

          {/* Progress Section */}
          <div className="space-y-3">
            <div className="relative">
              <Progress 
                value={progress} 
                className={`h-2 ${challenge.status === 'Completed' ? 'bg-primary/20' : ''}`}
              />
              {/* <motion.div
                className="absolute inset-0 bg-primary/10"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progress / 100 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              /> */}
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                {/* <motion.span 
                  className="font-medium"
                  animate={{ opacity: [0, 1], y: [10, 0] }}
                  transition={{ duration: 0.3 }}
                > */}
                  {formatValue(challenge.currentValue, challenge.unit)}
                {/* </motion.span> */}
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">
                  {formatValue(challenge.goalValue, challenge.unit)}
                </span>
              </div>
              {/* <motion.span 
                className={`font-medium ${progress === 100 ? 'text-primary' : 'text-muted-foreground'}`}
                animate={progress === 100 ? {
                  scale: [1, 1.2, 1],
                  transition: { duration: 0.3 }
                } : {}}
              > */}
                {challenge.status === 'Completed' ? (
                  <span className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Complete
                  </span>
                ) : (
                  `${progress.toFixed(0)}%`
                )}
              {/* </motion.span> */}
            </div>
          </div>
        </CardContent>
      </Card>
    // </motion.div>
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

  // Add stats
  const completedChallenges = challenges.filter(c => c.status === 'Completed').length;
  const totalProgress = challenges.reduce((acc, c) => {
    const progress = calculateProgress(c.currentValue, c.goalValue, c.startValue, c.metric);
    return acc + progress;
  }, 0) / challenges.length;

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
    <>
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && <Confetti />}
      </AnimatePresence>

      {/* Header Stats Section */}
      <motion.div 
        className="mb-8 space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Monthly Challenges
          </h1>
          <p className="text-center text-muted-foreground">
            Push your limits, track your progress, achieve your goals
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Challenges</p>
                  <h2 className="text-2xl font-bold">{challenges.length}</h2>
                </div>
                <Trophy className="h-8 w-8 text-primary opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <h2 className="text-2xl font-bold">{completedChallenges}</h2>
                </div>
                <CheckCircle className="h-8 w-8 text-primary opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                  <h2 className="text-2xl font-bold">{totalProgress.toFixed(0)}%</h2>
                </div>
                <BarChart className="h-8 w-8 text-primary opacity-75" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isRefreshing}
                className="relative group"
              >
                <RefreshCw className={`
                  mr-2 h-4 w-4 
                  ${isRefreshing ? 'animate-spin' : 'group-hover:animate-spin'}
                `} />
                Refresh Challenges
                {!isRefreshing && (
                  <span className="absolute inset-0 rounded-md bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refresh Monthly Challenges?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will generate a new set of personalized challenges based on your recent progress. Previous challenges will be archived.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRefreshing}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleRefreshClick} 
                  disabled={isRefreshing}
                  className="relative group"
                >
                  {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate New Challenges
                  <span className="absolute inset-0 rounded-md bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {/* Empty state message */}
      {challenges.length === 0 && !isRefreshing && (
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

      {/* Challenge Grid */}
      <motion.div 
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
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
      </motion.div>

      {/* Challenge Detail Modal */}
      <AnimatePresence>
        <ChallengeDetailModal
          challenge={selectedChallenge}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
        />
      </AnimatePresence>
    </>
  );
} 