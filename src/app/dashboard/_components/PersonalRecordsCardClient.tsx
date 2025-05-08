'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ChevronRight, TrendingUp, Gauge, Weight, Trophy, ChevronsRight, Edit, Search } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { DashboardPREntry } from "@/lib/workout-actions";
import type { IUser } from '@/lib/db/models/user';
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Base type for a single record entry (value and date are required)
type SingleRecord = { value: number; date: Date };

// New definition for RecordWithWorkoutId, ensuring it handles optional fields
type RecordWithWorkoutId = SingleRecord & { workoutId?: string };

// Helper: Format pace from seconds/meter to min/km
const formatPace = (paceSecondsPerMeter: number | undefined): string => {
  if (!paceSecondsPerMeter || paceSecondsPerMeter === Infinity) return "N/A";
  const paceMinPerKm = (paceSecondsPerMeter * 1000) / 60;
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
};

// Helper: Format distance (already in km)
const formatDistance = (distanceKm: number | undefined): string => {
  if (!distanceKm) return "N/A";
  return `${distanceKm.toFixed(2)} km`;
};

// Helper: Format volume (already in kg)
const formatVolume = (volumeKg: number | undefined): string => {
  if (!volumeKg) return "N/A";
  return `${volumeKg.toFixed(0)} kg`;
};

interface PersonalRecordsCardProps {
  exercisePRs?: DashboardPREntry[];
  overallPRs?: {
    longestRun?: RecordWithWorkoutId;
    fastest5kPace?: RecordWithWorkoutId;
    maxStrengthVolume?: RecordWithWorkoutId;
  };
}

const PRCard = motion(Card);

export function PersonalRecordsCard({ exercisePRs = [], overallPRs = {} }: PersonalRecordsCardProps) {
  const { longestRun, fastest5kPace, maxStrengthVolume } = overallPRs;
  
  const hasExercisePRs = exercisePRs.length > 0;
  const hasOverallPRs = !!(longestRun?.value || fastest5kPace?.value || maxStrengthVolume?.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Personal Records</h2>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasOverallPRs && (
          <>
            {longestRun?.value && (
              <PRCard
                className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href={longestRun.workoutId ? `/workouts/${longestRun.workoutId}` : '#'} 
                      className="block p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-blue-600 dark:text-blue-400">Longest Run</span>
                      </div>
                      <div className="text-2xl font-bold">{formatDistance(longestRun.value)}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(longestRun.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {longestRun.workoutId && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </Link>
              </PRCard>
            )}

            {fastest5kPace?.value && (
              <PRCard
                className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href={fastest5kPace.workoutId ? `/workouts/${fastest5kPace.workoutId}` : '#'}
                      className="block p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Gauge className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-600 dark:text-green-400">Fastest 5K Pace</span>
                      </div>
                      <div className="text-2xl font-bold">{formatPace(fastest5kPace.value)}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(fastest5kPace.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {fastest5kPace.workoutId && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </Link>
              </PRCard>
            )}

            {maxStrengthVolume?.value && (
              <PRCard
                className="overflow-hidden hover:shadow-lg transition-shadow duration-300 md:col-span-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href={maxStrengthVolume.workoutId ? `/workouts/${maxStrengthVolume.workoutId}` : '#'}
                      className="block p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Weight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <span className="font-medium text-purple-600 dark:text-purple-400">Max Strength Volume</span>
                      </div>
                      <div className="text-2xl font-bold">{formatVolume(maxStrengthVolume.value)}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(maxStrengthVolume.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    {maxStrengthVolume.workoutId && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </Link>
              </PRCard>
            )}
          </>
        )}

        {hasExercisePRs && (
          <div className={cn("grid gap-4", {
            "md:col-span-2": true,
            "mt-6": hasOverallPRs
          })}>
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h3 className="font-medium">Exercise Records</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exercisePRs.map((pr) => (
                <PRCard
                  key={pr._id}
                  className="overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link href={pr.workoutId ? `/workouts/${pr.workoutId}` : '#'}
                        className="block p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="font-medium text-amber-700 dark:text-amber-400">{pr.exerciseName}</div>
                        <div className="text-xl font-bold">
                          {/* Display differently based on whether it's a bodyweight exercise and what unit it is */}
                          {pr.unit === 'kg' 
                            ? `${pr.value} ${pr.unit}`
                            : pr.unit === 'reps/day' 
                              ? `${pr.value} reps (Day PR)` // For bodyweight daily total PR
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
              ))}
            </div>
          </div>
        )}

        {!hasOverallPRs && !hasExercisePRs && (
          <div className="col-span-2 text-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Trophy className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No personal records found yet. Keep pushing!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}