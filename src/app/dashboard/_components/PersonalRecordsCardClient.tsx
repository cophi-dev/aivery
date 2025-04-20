'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ChevronRight, TrendingUp, Gauge, Weight } from "lucide-react";
import { format } from "date-fns"; // For formatting the date
import Link from "next/link"; // Import Link for navigation
// Import the new PR type
import type { DashboardPREntry } from "@/lib/workout-actions";
import type { IUser } from '@/lib/db/models/user'; // Import IUser for overall PRs type

// --- Add workoutId to the Record type used within IUser['personalRecords'] ---
// This is an assumption based on the desired linking functionality.
// The backend data source will need to provide this workoutId.
type RecordWithWorkoutId = IUser['personalRecords']['longestRun'] & { workoutId?: string };

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
  // Update prop type to expect potential workoutId on overall records
  overallPRs?: {
    longestRun?: RecordWithWorkoutId;
    fastest5kPace?: RecordWithWorkoutId;
    maxStrengthVolume?: RecordWithWorkoutId;
  };
}

export function PersonalRecordsCard({ exercisePRs = [], overallPRs = {} }: PersonalRecordsCardProps) {
  const { longestRun, fastest5kPace, maxStrengthVolume } = overallPRs;
  
  const hasExercisePRs = exercisePRs.length > 0;
  const hasOverallPRs = !!(longestRun?.value || fastest5kPace?.value || maxStrengthVolume?.value); // Ensure boolean

  // --- Add Log --- 
  console.log("[PersonalRecordsCard] Rendering. hasOverallPRs:", hasOverallPRs, "hasExercisePRs:", hasExercisePRs, "overallPRs:", overallPRs, "exercisePRs:", exercisePRs);
  // --- End Log ---

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center justify-center">
          <Zap className="mr-2 h-5 w-5 text-primary" /> Personal Records
        </CardTitle>
        {/* <CardDescription className="text-center">Your best recent achievements</CardDescription> */} 
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-center">
        {/* Overall PRs Section (if any) */} 
        {hasOverallPRs && (
          <>
            {longestRun?.value && (
              // Wrap in Link if workoutId exists
              longestRun.workoutId ? (
                <Link href={`/workouts/${longestRun.workoutId}`} className="block group hover:text-primary transition-colors text-sm border-b border-border/50 pb-2">
                  <p className="font-medium truncate flex items-center justify-center">
                    <TrendingUp className="mr-1.5 h-4 w-4 text-muted-foreground" /> Longest Run
                    <ChevronRight className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDistance(longestRun.value)}</span>
                    {longestRun.date && (
                        <span className="text-xs"> on {format(new Date(longestRun.date), 'MMM d, yyyy')}</span>
                    )}
                  </p>
                </Link>
              ) : (
                // Original div if no workoutId
                <div className="text-sm border-b border-border/50 pb-2">
                  <p className="font-medium truncate flex items-center justify-center">
                    <TrendingUp className="mr-1.5 h-4 w-4 text-muted-foreground" /> Longest Run
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDistance(longestRun.value)}</span>
                    {longestRun.date && (
                        <span className="text-xs"> on {format(new Date(longestRun.date), 'MMM d, yyyy')}</span>
                    )}
                  </p>
                </div>
              )
            )}
            {fastest5kPace?.value && (
               // Wrap in Link if workoutId exists
               fastest5kPace.workoutId ? (
                 <Link href={`/workouts/${fastest5kPace.workoutId}`} className="block group hover:text-primary transition-colors text-sm border-b border-border/50 pb-2">
                  <p className="font-medium truncate flex items-center justify-center">
                    <Gauge className="mr-1.5 h-4 w-4 text-muted-foreground" /> Fastest 5k Pace
                    <ChevronRight className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatPace(fastest5kPace.value)}</span>
                    {fastest5kPace.date && (
                        <span className="text-xs"> on {format(new Date(fastest5kPace.date), 'MMM d, yyyy')}</span>
                    )}
                  </p>
                 </Link>
               ) : (
                 // Original div if no workoutId
                 <div className="text-sm border-b border-border/50 pb-2">
                  <p className="font-medium truncate flex items-center justify-center">
                    <Gauge className="mr-1.5 h-4 w-4 text-muted-foreground" /> Fastest 5k Pace
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatPace(fastest5kPace.value)}</span>
                    {fastest5kPace.date && (
                        <span className="text-xs"> on {format(new Date(fastest5kPace.date), 'MMM d, yyyy')}</span>
                    )}
                  </p>
                </div>
               )
            )}
            {maxStrengthVolume?.value && (
               // Wrap in Link if workoutId exists
               maxStrengthVolume.workoutId ? (
                 <Link href={`/workouts/${maxStrengthVolume.workoutId}`} className="block group hover:text-primary transition-colors text-sm border-b border-border/50 pb-2 sm:col-span-2">
                    <p className="font-medium truncate flex items-center justify-center">
                      <Weight className="mr-1.5 h-4 w-4 text-muted-foreground" /> Max Strength Volume
                      <ChevronRight className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatVolume(maxStrengthVolume.value)}</span>
                      {maxStrengthVolume.date && (
                          <span className="text-xs"> in workout on {format(new Date(maxStrengthVolume.date), 'MMM d, yyyy')}</span>
                      )}
                    </p>
                 </Link>
               ) : (
                 // Original div if no workoutId
                 <div className="text-sm border-b border-border/50 pb-2 sm:col-span-2">
                  <p className="font-medium truncate flex items-center justify-center">
                    <Weight className="mr-1.5 h-4 w-4 text-muted-foreground" /> Max Strength Volume
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatVolume(maxStrengthVolume.value)}</span>
                    {maxStrengthVolume.date && (
                        <span className="text-xs"> in workout on {format(new Date(maxStrengthVolume.date), 'MMM d, yyyy')}</span>
                    )}
                  </p>
                </div>
               )
            )}
            {/* Separator if both sections exist */} 
            {hasExercisePRs && (
              <div className="sm:col-span-2 border-t border-dashed border-border/30 my-2"></div>
            )}
          </>
        )}

        {/* Exercise PRs Section (if any) */} 
        {hasExercisePRs && exercisePRs.map((pr) => {
          const prContent = (
            <>
              <p className="font-medium truncate">{pr.exerciseName}</p>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{pr.value} {pr.unit}</span>
                {pr.date && (
                    <span className="text-xs"> on {format(new Date(pr.date), 'MMM d, yyyy')}</span>
                )}
              </p>
            </>
          );

          return (
            <div key={pr._id} className="text-sm border-b border-border/50 pb-2 last:border-b-0 sm:last:border-b-0">
              {pr.workoutId ? (
                <Link href={`/workouts/${pr.workoutId}`} className="block group hover:text-primary transition-colors">
                  {prContent}
                  <ChevronRight className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ) : (
                prContent
              )}
            </div>
          );
        })}
        
        {/* Message if no PRs at all */} 
        {!hasOverallPRs && !hasExercisePRs && (
          <p className="text-sm text-muted-foreground sm:col-span-2">No personal records found yet. Keep logging!</p>
        )}
      </CardContent>
    </Card>
  );
}