'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shuffle, ChevronRight, Trophy, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { DashboardPREntry } from "@/lib/workout-actions";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { fetchRandomDashboardExercisePRs } from "@/lib/workout-actions";

interface RandomPRsCardProps {
  initialRandomPRs?: DashboardPREntry[];
}

const PRCard = motion(Card);

// Color schemes for random PRs to make them visually distinct
const colorSchemes = [
  {
    bg: "from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20",
    text: "text-orange-600 dark:text-orange-400",
    icon: "text-orange-600 dark:text-orange-400"
  },
  {
    bg: "from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20",
    text: "text-pink-600 dark:text-pink-400",
    icon: "text-pink-600 dark:text-pink-400"
  },
  {
    bg: "from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20",
    text: "text-indigo-600 dark:text-indigo-400",
    icon: "text-indigo-600 dark:text-indigo-400"
  },
  {
    bg: "from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20",
    text: "text-teal-600 dark:text-teal-400",
    icon: "text-teal-600 dark:text-teal-400"
  },
];

export function RandomPRsCard({ initialRandomPRs = [] }: RandomPRsCardProps) {
  const [randomPRs, setRandomPRs] = useState<DashboardPREntry[]>(initialRandomPRs);
  const [isPending, startTransition] = useTransition();

  const refreshPRs = () => {
    startTransition(async () => {
      try {
        const newRandomPRs = await fetchRandomDashboardExercisePRs(4);
        setRandomPRs(newRandomPRs);
      } catch (error) {
        console.error("Error refreshing random PRs:", error);
      }
    });
  };

  const hasRandomPRs = randomPRs.length > 0;

  if (!hasRandomPRs) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Shuffle className="h-5 w-5" />
            <span className="font-medium">Random PRs</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete some workouts to see your achievements here!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shuffle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Random Achievements</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshPRs}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className={cn("h-4 w-4", isPending && "animate-spin")} />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {randomPRs.map((pr, index) => {
          const colorScheme = colorSchemes[index % colorSchemes.length];
          
          return (
            <PRCard
              key={pr._id}
              className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link href={pr.workoutId ? `/workouts/${pr.workoutId}` : '#'}
                    className={cn("block p-4 bg-gradient-to-br", colorScheme.bg)}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <Trophy className={cn("h-4 w-4", colorScheme.icon)} />
                      <div className={cn("font-medium", colorScheme.text)}>
                        {pr.exerciseName}
                      </div>
                    </div>
                    <div className="text-xl font-bold">
                      {pr.unit === 'kg' 
                        ? `${pr.value} ${pr.unit}`
                        : pr.unit === 'reps/day' 
                          ? `${pr.value} reps (Day PR)` 
                          : `${pr.value} ${pr.unit}`
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(pr.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                  {pr.workoutId && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </Link>
            </PRCard>
          );
        })}
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Discover different achievements from your fitness journey
        </p>
      </div>
    </div>
  );
} 