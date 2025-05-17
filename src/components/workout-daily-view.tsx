"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, eachDayOfInterval, isSameDay, subDays, addDays, isAfter, isValid } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2, Activity, Dumbbell, Ruler, Clock, Route, Weight, ChevronDown, ChevronUp, Heart, Zap } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData, SetData } from '@/types/db';
import { formatDuration, formatDistance, calculatePercentageChange, estimateBodyweightForExercise } from '@/lib/utils';
import { MetricContent } from '@/components/ui/metric-card';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import AiveryInsights from '@/components/dashboard/AiveryInsights';
import { PRBadge } from "@/components/ui/pr-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { usePRNotification } from '@/components/providers/pr-notification-provider';

// Helper to format date for display and API calls
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

interface DailyWorkoutMetrics {
    totalDuration: number;
    totalDistance: number;
    totalVolume: number;
    workoutCount: number;
    workouts: WorkoutWithExercises[];
}

interface WorkoutWithExercises extends WorkoutData {
    workoutExercises?: WorkoutExerciseData[];
    aiHighlight?: string;
    isExpanded?: boolean;
    totalVolume?: number;
    startTime?: string;
}

// Function to get metrics for date
async function getMetricsForDate(date: Date, allWorkouts: WorkoutWithExercises[]): Promise<DailyWorkoutMetrics> {
    const dayStart = startOfDay(date);
    console.log(`[getMetricsForDate] Called for date: ${date.toISOString()}, dayStart: ${dayStart.toISOString()}`);
    console.log(`[getMetricsForDate] Total workouts received: ${allWorkouts.length}`);

    const workoutsOnDate = allWorkouts.filter(w => {
        if (!w.date) return false;
        const workoutDateString = w.date.toString();
        let parsedWorkoutDate: Date | null = null;
        try {
            parsedWorkoutDate = parseISO(workoutDateString);
        } catch (e) {
            console.error(`[getMetricsForDate] Error parsing date string: "${workoutDateString}"`, e);
            return false;
        }

        if (!isValid(parsedWorkoutDate)) {
            console.warn(`[getMetricsForDate] Parsed date is invalid: "${workoutDateString}" -> ${parsedWorkoutDate}`);
            return false;
        }
        
        const matches = isSameDay(parsedWorkoutDate, dayStart);
        // Log details for a few workouts to see what's happening
        if (allWorkouts.indexOf(w) < 5 || allWorkouts.indexOf(w) > allWorkouts.length - 5) { // Log first 5 and last 5 for brevity
             console.log(`[getMetricsForDate] Comparing: Workout Date: ${workoutDateString}, Parsed: ${parsedWorkoutDate.toISOString()}, Target DayStart: ${dayStart.toISOString()}, Matches: ${matches}`);
        }
        return matches;
    });

    console.log(`[getMetricsForDate] Workouts filtered for ${dayStart.toISOString()}: ${workoutsOnDate.length}`);

    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;

    workoutsOnDate.forEach(w => {
        totalDuration += w.duration || 0;
        // Normalize distance to kilometers
        let distanceInKm = 0;
        if (w.cardioDetails?.distance) {
            // cardioDetails.distance is already in km
            distanceInKm = w.cardioDetails.distance;
        } else if (w.distance) {
            // If distance is large (> 100), assume it's in meters and convert to km
            distanceInKm = w.distance > 100 ? w.distance / 1000 : w.distance;
        }
        totalDistance += distanceInKm;
        if (w.calculatedVolume) totalVolume += w.calculatedVolume;
    });

    return {
        totalDuration,
        totalDistance, // Now consistently in kilometers
        totalVolume,
        workoutCount: workoutsOnDate.length,
        workouts: workoutsOnDate,
    };
}

const RunningWorkoutCard = ({ workout }: { workout: WorkoutWithExercises }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const { showPR } = usePRNotification();
    
    // Check for new PRs and show notifications
    useEffect(() => {
        if (workout.records && workout.records.length > 0) {
            // Check if any of these records are new (within last 24 hours)
            const newRecords = workout.records.filter(record => {
                // Check if record has timestamp/date property
                const recordDate = record.createdAt || record.date || new Date();
                const recordTime = new Date(recordDate).getTime();
                const now = Date.now();
                const isNew = now - recordTime < 24 * 60 * 60 * 1000; // Within 24 hours
                
                return isNew;
            });
            
            // Format and display PR notifications for new records
            newRecords.forEach(record => {
                let prValue = '';
                let prType = record.type || 'personalRecord';
                
                // Format values based on PR type
                if (prType === 'longestRun' && record.value) {
                    prValue = `${record.value.toFixed(2)} km`;
                } else if (prType === 'fastest5kPace' && record.value) {
                    const paceMinutes = Math.floor(record.value / 60);
                    const paceSeconds = Math.round(record.value % 60);
                    prValue = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`;
                } else if (record.value) {
                    prValue = record.value.toString();
                }
                
                if (prValue) {
                    showPR(prType, prValue);
                    
                    // Also add a record with the explicit PR format for insights to pick up
                    if (workout.records && !workout.records.some(r => 
                        r.type === 'explicit_pr' && 
                        r.exerciseName === record.exerciseName &&
                        r.value === (record.value || record.reps || 0)
                    )) {
                        workout.records.push({
                            type: 'explicit_pr',
                            exerciseName: record.exerciseName || prType,
                            value: record.value || record.reps || 0,
                            unit: record.unit || (prValue.includes('reps') ? 'reps' : ''),
                            date: new Date(),
                            createdAt: new Date()
                        });
                    }
                }
            });
        }
    }, [workout.records, showPR]);
    
    // Format pace (min/km)
    const formatPace = (duration: number, distance: number) => {
        if (!distance || !duration) return '--:--';
        // Convert distance to kilometers if needed
        const distanceInKm = distance > 100 ? distance / 1000 : distance;
        if (distanceInKm === 0) return '--:--';
        
        const paceInMinutes = duration / 60 / distanceInKm;
        const minutes = Math.floor(paceInMinutes);
        const seconds = Math.round((paceInMinutes - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Normalize distance to kilometers
    let distanceInKm = 0;
    if (workout.cardioDetails?.distance) {
        // cardioDetails.distance is already in km
        distanceInKm = workout.cardioDetails.distance;
    } else if (workout.distance) {
        // If distance is large (> 100), assume it's in meters and convert to km
        distanceInKm = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
    }

    const pace = formatPace(workout.duration || 0, distanceInKm);
    const avgHeartRate = workout.cardioDetails?.heartRate?.average;
    const maxHeartRate = workout.cardioDetails?.heartRate?.max;
    const elevationGain = workout.cardioDetails?.elevationGain;
    const maxSpeed = workout.cardioDetails?.maxSpeed;
    
    // Check for newly set PRs (recent records)
    const hasNewDistancePR = workout.records?.some(r => 
        r.type === 'longestRun' && 
        (r.createdAt && new Date(r.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    );
    
    const hasNewPacePR = workout.records?.some(r => 
        r.type === 'fastest5kPace' && 
        (r.createdAt && new Date(r.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    );

    return (
        <Card className="mb-6 overflow-hidden bg-[#58a3ff]/[0.02] hover:bg-[#58a3ff]/[0.04] transition-all duration-300 border-0 shadow-none">
            <CardHeader 
                className="pb-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#58a3ff]" />
                        <CardTitle className="text-lg font-medium">{workout.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {workout.records && workout.records.length > 0 && (
                            <PRBadge isNew={hasNewDistancePR || hasNewPacePR} />
                        )}
                        <div className="h-8 w-8 rounded-md flex items-center justify-center transition-colors hover:bg-[#58a3ff]/5">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Clock className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <span className="text-base font-medium mb-1">{formatDuration(workout.duration)}</span>
                        <span className="text-xs text-muted-foreground">Duration</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Route className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <div className="flex items-center gap-1">
                            <span className="text-base font-medium mb-1">{distanceInKm.toFixed(1)} km</span>
                            {workout.records?.some(r => r.type === 'longestRun') && (
                                <PRBadge size="sm" className="mb-1" isNew={hasNewDistancePR} />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">Distance</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Activity className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <div className="flex items-center gap-1">
                            <span className="text-base font-medium mb-1">{pace}</span>
                            {workout.records?.some(r => r.type === 'fastest5kPace') && (
                                <PRBadge size="sm" className="mb-1" isNew={hasNewPacePR} />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">Pace (min/km)</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Zap className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <span className="text-base font-medium mb-1">{maxSpeed ? `${maxSpeed.toFixed(1)} km/h` : '--'}</span>
                        <span className="text-xs text-muted-foreground">Max Speed</span>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                            {avgHeartRate && (
                                <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                                    <Heart className="h-5 w-5 mb-2 text-[#58a3ff]" />
                                    <span className="text-base font-medium mb-1">{Math.round(avgHeartRate)} bpm</span>
                                    <span className="text-xs text-muted-foreground">Avg Heart Rate</span>
                                </div>
                            )}
                            {maxHeartRate && (
                                <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                                    <Heart className="h-5 w-5 mb-2 text-[#58a3ff]" />
                                    <span className="text-base font-medium mb-1">{Math.round(maxHeartRate)} bpm</span>
                                    <span className="text-xs text-muted-foreground">Max Heart Rate</span>
                                </div>
                            )}
                            {elevationGain && (
                                <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                                    <Ruler className="h-5 w-5 mb-2 text-[#58a3ff]" />
                                    <span className="text-base font-medium mb-1">{Math.round(elevationGain)}m</span>
                                    <span className="text-xs text-muted-foreground">Elevation Gain</span>
                                </div>
                            )}
                        </div>
                        {workout.notes && (
                            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-[#58a3ff]/5 to-[#58a3ff]/5 border border-[#58a3ff]/10">
                                <p className="text-sm text-muted-foreground">{workout.notes}</p>
                            </div>
                        )}
                        {workout.aiHighlight && (
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-[#58a3ff]/5 to-[#58a3ff]/5 border border-[#58a3ff]/10">
                                <p className="text-sm text-[#58a3ff]/90">{workout.aiHighlight}</p>
                            </div>
                        )}
                        <div className="mt-6 flex justify-end">
                            <Button 
                                variant="outline" 
                                className="border-[#58a3ff]/20 text-[#58a3ff] hover:bg-[#58a3ff]/5"
                                onClick={() => router.push(`/workouts/${workout._id}`)}
                            >
                                View Details
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

const StrengthWorkoutCard = ({ workout }: { workout: WorkoutWithExercises }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const { showPR } = usePRNotification();
    
    // Check for new PRs and show notifications
    useEffect(() => {
        if (workout.records && workout.records.length > 0) {
            // Check if any of these records are new (within last 24 hours)
            const newRecords = workout.records.filter(record => {
                // Check if record has timestamp/date property
                const recordDate = record.createdAt || record.date || new Date();
                const recordTime = new Date(recordDate).getTime();
                const now = Date.now();
                const isNew = now - recordTime < 7 * 24 * 60 * 60 * 1000; // Changed from 24 hours to 7 days
                
                return isNew;
            });
            
            // Format and display PR notifications for new records
            newRecords.forEach(record => {
                let prValue = '';
                let prType = record.type || 'personalRecord';
                
                // Format values based on PR type
                if (prType === 'maxStrengthVolume' && record.value) {
                    const tons = record.value / 1000;
                    prValue = `${tons.toFixed(2)} tons`;
                } else if (prType === 'maxWeight' && record.value) {
                    prValue = `${record.value}kg`;
                } else if (prType === 'maxReps' && record.value) {
                    // Handle max reps PRs for bodyweight exercises
                    prValue = `${record.value} reps`;
                    if (record.exerciseName) {
                        prType = `New PR in ${record.exerciseName}`;
                    }
                } else if (prType.includes('max') && record.value) {
                    // Handle other numeric PRs
                    prValue = record.value.toString();
                } else if (record.exerciseName) {
                    // Exercise-specific PR
                    prType = `New PR in ${record.exerciseName}`;
                    if (record.value && record.unit === 'reps') {
                        // Explicitly handle bodyweight exercises with rep-based PRs
                        prValue = `${record.value} reps`;
                    } else if (record.value) {
                        prValue = `${record.value} ${record.unit || ''}`;
                    } else if (record.weight) {
                        prValue = `${record.weight}kg`;
                    } else if (record.reps) {
                        // Fallback for reps-only records
                        prValue = `${record.reps} reps`;
                    }
                }
                
                if (prValue) {
                    showPR(prType, prValue);
                    
                    // Also add a record with the explicit PR format for insights to pick up
                    if (workout.records && !workout.records.some(r => 
                        r.type === 'explicit_pr' && 
                        r.exerciseName === record.exerciseName &&
                        r.value === (record.value || record.reps || 0)
                    )) {
                        workout.records.push({
                            type: 'explicit_pr',
                            exerciseName: record.exerciseName || prType,
                            value: record.value || record.reps || 0,
                            unit: record.unit || (prValue.includes('reps') ? 'reps' : ''),
                            date: new Date(),
                            createdAt: new Date()
                        });
                    }
                }
            });
        }
    }, [workout.records, showPR]);
    
    // Calculate total volume and stats
    const totalVolume = workout.totalVolume || 0;
    const totalSets = workout.workoutExercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;
    const totalReps = workout.workoutExercises?.reduce((acc, ex) => 
        acc + (ex.sets?.reduce((setAcc, set) => setAcc + (set.reps || 0), 0) || 0), 0) || 0;
    const totalExercises = workout.workoutExercises?.length || 0;
    
    // Check for newly set strength PRs (within last 7 days instead of 24 hours)
    const hasNewStrengthPRs = workout.records?.some(r => {
        const recordDate = r.createdAt || r.date || new Date();
        const recordTime = new Date(recordDate).getTime();
        const now = Date.now();
        return now - recordTime < 7 * 24 * 60 * 60 * 1000; // Changed from 24 hours to 7 days
    });

    // Add a helper to format volume as tons or kg
    const formatVolume = (kg: number | undefined | null): string => {
        if (kg === undefined || kg === null || isNaN(kg)) return '--';
        if (kg >= 1000) return `${(kg / 1000).toFixed(2)}t`;
        return `${kg.toLocaleString()}kg`;
    };

    return (
        <Card className="mb-6 overflow-hidden bg-[#fa9f7b]/[0.02] hover:bg-[#fa9f7b]/[0.04] transition-all duration-300 border-0 shadow-none">
            <CardHeader 
                className="pb-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5 text-[#fa9f7b]" />
                        <CardTitle className="text-base sm:text-lg font-medium">{workout.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {workout.records && workout.records.length > 0 && (
                            <PRBadge />
                        )}
                        <div className="h-8 w-8 rounded-md flex items-center justify-center transition-colors hover:bg-[#fa9f7b]/5">
                            {isExpanded ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div className="flex flex-col items-center p-3 sm:p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 mb-1 sm:mb-2 text-[#fa9f7b]" />
                        <span className="text-sm sm:text-base font-medium mb-0.5 sm:mb-1">{formatDuration(workout.duration)}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Duration</span>
                    </div>
                    <div className="flex flex-col items-center p-3 sm:p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Weight className="h-4 w-4 sm:h-5 sm:w-5 mb-1 sm:mb-2 text-[#fa9f7b]" />
                        <span className="text-sm sm:text-base font-medium mb-0.5 sm:mb-1">{formatVolume(totalVolume)}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Volume</span>
                    </div>
                    <div className="flex flex-col items-center p-3 sm:p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 mb-1 sm:mb-2 text-[#fa9f7b]" />
                        <span className="text-sm sm:text-base font-medium mb-0.5 sm:mb-1">{totalReps}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Total Reps</span>
                    </div>
                    <div className="flex flex-col items-center p-3 sm:p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5 mb-1 sm:mb-2 text-[#fa9f7b]" />
                        <span className="text-sm sm:text-base font-medium mb-0.5 sm:mb-1">{totalSets}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Sets</span>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                            {workout.workoutExercises?.map((exercise) => {
                                const exerciseReps = exercise.sets?.reduce((acc, set) => acc + (set.reps || 0), 0) || 0;
                                // Calculate volume for bodyweight and weighted exercises
                                const isBodyweight = estimateBodyweightForExercise(exercise.exerciseId.name) > 0;
                                const exerciseVolume = exercise.sets?.reduce((acc, set) => {
                                    if (isBodyweight) {
                                        const bw = estimateBodyweightForExercise(exercise.exerciseId.name);
                                        return acc + (bw * (set.reps || 0));
                                    } else {
                                        return acc + ((set.weight || 0) * (set.reps || 0));
                                    }
                                }, 0) || 0;
                                
                                // Check if this exercise has a PR
                                const hasPR = workout.records?.some(record => 
                                    record.exerciseId === exercise.exerciseId._id.toString()
                                );
                                
                                return (
                                    <div key={exercise._id} className="p-3 sm:p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm sm:text-base font-medium">{exercise.exerciseId.name}</span>
                                                {hasPR && <PRBadge size="sm" />}
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                                                <span>{exerciseReps} reps</span>
                                                <span>•</span>
                                                <span>{formatVolume(exerciseVolume)}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 sm:space-y-2">
                                            {exercise.sets?.map((set: SetData, index) => {
                                                const isBodyweight = estimateBodyweightForExercise(exercise.exerciseId.name) > 0;
                                                return (
                                                    <div key={index} className="text-xs text-muted-foreground flex items-center space-x-3">
                                                        {isBodyweight ? (
                                                            <span>{set.reps} reps</span>
                                                        ) : (
                                                            <>
                                                                <span>{set.weight}kg</span>
                                                                <span>×</span>
                                                                <span>{set.reps} reps</span>
                                                            </>
                                                        )}
                                                        {set.notes && <span className="text-primary/60">• {set.notes}</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button 
                                variant="outline" 
                                className="border-[#fa9f7b]/20 text-[#fa9f7b] hover:bg-[#fa9f7b]/5"
                                onClick={() => router.push(`/workouts/${workout._id}`)}
                            >
                                View Details
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

// Add this new component before the WorkoutDailyView component
const WorkoutGroup = ({ type, workouts }: { type: string, workouts: WorkoutWithExercises[] }) => {
    const { colorClasses } = getWorkoutTypeStyle(type);
    const baseColor = colorClasses.includes('text-[#58a3ff]') ? '#58a3ff' : 
                     colorClasses.includes('text-[#fa9f7b]') ? '#fa9f7b' : 
                     '#94a3b8';

    return (
        <div className="relative mb-8 last:mb-0">
            {/* Group Header */}
            <div className="sticky top-[7.5rem] z-[5] mb-4 flex items-center gap-2 bg-background/80 backdrop-blur-lg py-2">
                <div className={cn(
                    "text-sm font-medium capitalize flex items-center gap-2",
                    colorClasses
                )}>
                    <div className={cn(
                        "h-2 w-2 rounded-full",
                        colorClasses.replace('text-', 'bg-')
                    )} />
                    {type}
                    <span className="text-muted-foreground font-normal">
                        ({workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'})
                    </span>
                </div>
            </div>

            {/* Workouts Grid */}
            <div className="space-y-4">
                {workouts.map((workout, index) => (
                    <div 
                        key={workout._id} 
                        className={cn(
                            "relative rounded-xl overflow-hidden",
                            "before:absolute before:inset-0 before:pointer-events-none",
                            `before:border-l-[4px] before:border-[${baseColor}]`,
                            "transition-all duration-300"
                        )}
                    >
                        {workout.type === 'running' ? (
                            <RunningWorkoutCard workout={workout} />
                        ) : workout.type === 'strength' ? (
                            <StrengthWorkoutCard workout={workout} />
                        ) : (
                            <DefaultWorkoutCard workout={workout} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Update the DefaultWorkoutCard component to match the new style
const DefaultWorkoutCard = ({ workout }: { workout: WorkoutWithExercises }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const { colorClasses } = getWorkoutTypeStyle(workout.type);
    const baseColor = colorClasses.includes('text-[#58a3ff]') ? '#58a3ff' : 
                     colorClasses.includes('text-[#fa9f7b]') ? '#fa9f7b' : 
                     '#94a3b8';

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300",
            "border-0 shadow-none",
            `bg-[${baseColor}]/[0.02]`,
            `hover:bg-[${baseColor}]/[0.04]`,
            "relative"
        )}>
            <CardHeader 
                className="pb-2 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className={cn("h-5 w-5", colorClasses)} />
                        <CardTitle className="text-lg font-medium">{workout.name}</CardTitle>
                    </div>
                    <div className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                        `hover:bg-[${baseColor}]/5`
                    )}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={cn(
                        "flex flex-col items-center p-6 rounded-2xl",
                        "bg-white dark:bg-black border",
                        `border-[${baseColor}]/[0.08]`
                    )}>
                        <Clock className={cn("h-5 w-5 mb-2", colorClasses)} />
                        <span className="text-base font-medium mb-1">{formatDuration(workout.duration)}</span>
                        <span className="text-xs text-muted-foreground">Duration</span>
                    </div>
                    {workout.distance && (
                        <div className={cn(
                            "flex flex-col items-center p-6 rounded-2xl",
                            "bg-white dark:bg-black border",
                            `border-[${baseColor}]/[0.08]`
                        )}>
                            <Route className={cn("h-5 w-5 mb-2", colorClasses)} />
                            <span className="text-base font-medium mb-1">
                                {formatDistance(workout.distance > 100 ? workout.distance / 1000 : workout.distance)}
                            </span>
                            <span className="text-xs text-muted-foreground">Distance</span>
                        </div>
                    )}
                </div>

                {isExpanded && workout.notes && (
                    <div className={cn(
                        "mt-6 p-4 rounded-xl border",
                        `bg-[${baseColor}]/[0.05]`,
                        `border-[${baseColor}]/[0.1]`
                    )}>
                        <p className="text-sm text-muted-foreground">{workout.notes}</p>
                    </div>
                )}

                {isExpanded && (
                    <div className="mt-6 flex justify-end">
                        <Button 
                            variant="outline" 
                            className={cn(
                                "border-opacity-20 hover:bg-opacity-5",
                                colorClasses,
                                `border-[${baseColor}]`,
                                `hover:bg-[${baseColor}]`
                            )}
                            onClick={() => router.push(`/workouts/${workout._id}`)}
                        >
                            View Details
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function WorkoutDailyView() {
    const router = useRouter();
    const [workouts, setWorkouts] = useState<WorkoutWithExercises[]>([]);
    const [loading, setLoading] = useState(true);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    const today = useMemo(() => startOfDay(new Date()), []);
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [dailyMetrics, setDailyMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [previousDayMetrics, setPreviousDayMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(true);

    // Memoize dateRange for AiveryInsights with stable reference
    const aiveryDateRange = useMemo(() => {
        if (!selectedDate) return undefined;
        
        const baseDate = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
        
        // Create a proper date range for the selected day (full 24-hour period)
        const startDate = new Date(baseDate);
        startDate.setHours(0, 0, 0, 0); 
        
        const endDate = new Date(baseDate);
        endDate.setHours(23, 59, 59, 999);
        
        return {
            start: startDate,
            end: endDate
        };
    }, [selectedDate]);

    // Parse date from URL on initial load
    useEffect(() => {
        // Check if there's a date parameter in the URL
        const searchParams = new URLSearchParams(window.location.search);
        const dateParam = searchParams.get('date');
        
        if (dateParam) {
            try {
                // Parse the date parameter
                const parsedDate = parseISO(dateParam);
                if (isValid(parsedDate)) {
                    setSelectedDate(startOfDay(parsedDate));
                }
            } catch (e) {
                console.error('Invalid date parameter:', dateParam);
            }
        }
    }, []);

    // Update URL when selected date changes
    useEffect(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const searchParams = new URLSearchParams(window.location.search);
        
        // Only update if the date is not today
        if (!isSameDay(selectedDate, today)) {
            searchParams.set('date', dateStr);
            const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
            window.history.replaceState({}, '', newUrl);
        } else {
            // If date is today, remove the date parameter
            searchParams.delete('date');
            const newUrl = searchParams.toString() 
                ? `${window.location.pathname}?${searchParams.toString()}`
                : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [selectedDate, today]);
    
    // Track insights loading state separately
    const handleInsightsLoad = useCallback(() => {
        setInsightsLoading(false);
    }, []);
    
    const handleInsightsLoadStart = useCallback(() => {
        setInsightsLoading(true);
    }, []);

    // Fetch all workouts on initial load
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            setMetricsLoading(true);
            try {
                // Create a wider date range for initial data load to ensure we get all workouts
                const endDate = addDays(new Date(), 7);
                const startDate = subDays(endDate, 90);
                
                console.log('[WorkoutDailyView] Fetching initial workouts with date range:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });
                
                // Fetch workouts with exercises and AI insights
                const response = await fetch(`/api/workouts?includeExercises=true&_=${Date.now()}`, { 
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                    }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: WorkoutWithExercises[] = await response.json();
                console.log(`[WorkoutDailyView] Received ${data.length} workouts from API`);
                
                // Debug output for workouts data
                if (data.length > 0) {
                    console.log('[WorkoutDailyView] First workout:', {
                        _id: data[0]._id,
                        date: data[0].date,
                        name: data[0].name,
                        type: data[0].type
                    });
                    
                    // Group workouts by date to see distribution
                    const workoutsByDate = data.reduce((acc, workout) => {
                        const dateStr = new Date(workout.date).toISOString().split('T')[0];
                        acc[dateStr] = (acc[dateStr] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    
                    console.log('[WorkoutDailyView] Workouts distribution by date:', workoutsByDate);
                }
                
                setWorkouts(data);
                setLoading(false);
            } catch (err: any) {
                console.error("[WorkoutDailyView] Error fetching initial workouts:", err);
                setLoading(false);
                setMetricsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Update the metrics effect to also fetch previous day metrics
    useEffect(() => {
        if (!loading && workouts.length > 0) {
            const loadMetricsForDay = async () => {
                setMetricsLoading(true);
                try {
                    const [metrics, prevMetrics] = await Promise.all([
                        getMetricsForDate(selectedDate, workouts as WorkoutWithExercises[]),
                        getMetricsForDate(subDays(selectedDate, 1), workouts as WorkoutWithExercises[])
                    ]);
                    setDailyMetrics(metrics);
                    setPreviousDayMetrics(prevMetrics);
                } catch (err) {
                    console.error(`Error getting metrics for ${formatDateKey(selectedDate)}:`, err);
                    setDailyMetrics({ totalDuration: 0, totalDistance: 0, totalVolume: 0, workoutCount: 0, workouts: [] });
                    setPreviousDayMetrics({ totalDuration: 0, totalDistance: 0, totalVolume: 0, workoutCount: 0, workouts: [] });
                } finally {
                    setMetricsLoading(false);
                }
            };
            loadMetricsForDay();
        } else if (!loading && workouts.length === 0) {
            setDailyMetrics({ totalDuration: 0, totalDistance: 0, totalVolume: 0, workoutCount: 0, workouts: [] });
            setPreviousDayMetrics({ totalDuration: 0, totalDistance: 0, totalVolume: 0, workoutCount: 0, workouts: [] });
            setMetricsLoading(false);
        }
    }, [selectedDate, workouts, loading]);

    // Generate dates for the horizontal scroller based on the viewCenterDate
    const dateRange = useMemo(() => {
        const start = subDays(selectedDate, 7);
        const end = addDays(selectedDate, 7);
        return eachDayOfInterval({ start, end });
    }, [selectedDate]);

    const handleDateSelect = (date: Date) => {
        setSelectedDate(startOfDay(date));
        setInsightsLoading(true); // Reset insights loading state
    };

    const shiftView = (days: number) => {
        setSelectedDate(prev => addDays(prev, days));
        setInsightsLoading(true); // Reset insights loading state
    };

    const toggleWorkoutExpansion = (workoutId: string) => {
        setExpandedWorkouts(prev => ({
            ...prev,
            [workoutId]: !prev[workoutId]
        }));
    };

    const handleWorkoutClick = (workoutId: string) => {
        router.push(`/workouts/${workoutId}`);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    // Individual workouts for the selected day are now in dailyMetrics.workouts
    const workoutsForDisplay = dailyMetrics?.workouts || [];

    return (
        <div className="space-y-6">
            {/* Date Scroller - Now with frosted glass effect and session indicators */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b pb-4">
                <div className="flex items-center space-x-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shiftView(-7)} 
                        aria-label="Previous week"
                        className="hover:bg-primary/5"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>

                    <ScrollArea className="flex-grow w-full whitespace-nowrap rounded-md">
                        <div className="flex justify-center space-x-2 p-2">
                            {dateRange.map(date => {
                                const dateStr = formatDateKey(date);
                                const isSelected = isSameDay(date, selectedDate);
                                const isFuture = isAfter(date, today);
                                const workoutsOnDate = workouts.filter(w => w.date && isSameDay(parseISO(w.date.toString()), date));
                                const hasWorkout = workoutsOnDate.length > 0;
                                const workoutTypes = Array.from(new Set(workoutsOnDate.map(w => w.type)));

                                return (
                                    <Button
                                        key={dateStr}
                                        variant={isSelected ? "default" : "ghost"}
                                        className={cn(
                                            "flex flex-col items-center justify-center h-[4.5rem] w-16 rounded-xl p-2 transition-all relative",
                                            isSelected && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg scale-110",
                                            !isSelected && hasWorkout && "border-2 border-primary/20 bg-primary/5",
                                            !isSelected && !hasWorkout && "hover:bg-muted/10",
                                            isFuture && "opacity-50"
                                        )}
                                        onClick={() => handleDateSelect(date)}
                                    >
                                        <span className={cn(
                                            "text-xs font-medium",
                                            isSelected ? "text-primary-foreground" : "text-muted-foreground"
                                        )}>{format(date, 'eee')}</span>
                                        <span className={cn(
                                            "text-2xl font-bold",
                                            isSelected ? "text-primary-foreground" : ""
                                        )}>{format(date, 'd')}</span>
                                        <span className={cn(
                                            "text-xs",
                                            isSelected ? "text-primary-foreground" : "text-muted-foreground"
                                        )}>{format(date, 'MMM')}</span>
                                        
                                        {/* Workout Type Indicators */}
                                        {hasWorkout && (
                                            <div className="absolute -bottom-1 flex gap-0.5 justify-center">
                                                {workoutTypes.map((type, idx) => {
                                                    const { colorClasses } = getWorkoutTypeStyle(type);
                                                    return (
                                                        <div 
                                                            key={`${dateStr}-${type}`}
                                                            className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                type.toLowerCase().includes('run') || type.toLowerCase().includes('cardio') 
                                                                    ? "bg-blue-500" 
                                                                    : type.toLowerCase().includes('strength') 
                                                                        ? "bg-purple-500"
                                                                        : colorClasses.replace('text-', 'bg-')
                                                            )}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shiftView(7)} 
                        aria-label="Next week"
                        className="hover:bg-primary/5"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Daily Summary Card - Updated to match weekly view exactly */}
            {!metricsLoading && dailyMetrics && (
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Daily Totals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Workouts" 
                                    value={dailyMetrics.workoutCount.toString()}
                                    change={calculatePercentageChange(dailyMetrics.workoutCount, previousDayMetrics?.workoutCount)}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Duration" 
                                    value={formatDuration(dailyMetrics.totalDuration)}
                                    change={calculatePercentageChange(dailyMetrics.totalDuration, previousDayMetrics?.totalDuration)}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Distance" 
                                    value={formatDistance(dailyMetrics.totalDistance)}
                                    change={dailyMetrics.totalDistance > 0 ? calculatePercentageChange(dailyMetrics.totalDistance, previousDayMetrics?.totalDistance) : null}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Volume" 
                                    value={`${(dailyMetrics.totalVolume / 1000).toFixed(1)}t`}
                                    change={dailyMetrics.totalVolume > 0 ? calculatePercentageChange(dailyMetrics.totalVolume, previousDayMetrics?.totalVolume) : null}
                                />
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            )}
            {/* Show a loading spinner for metrics if they are loading */}
            {metricsLoading && (
                 <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> 
                    <span className="ml-2 text-muted-foreground">Loading daily summary...</span>
                </div>
            )}

            {/* Aivery Insights Section */}
            <section className="mb-6">
                {!loading && (
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            {insightsLoading && (
                                <div className="flex justify-center items-center p-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> 
                                    <span className="ml-2 text-muted-foreground">Loading insights...</span>
                                </div>
                            )}
                            <div className={insightsLoading ? "opacity-0 h-0 overflow-hidden" : "opacity-100 transition-opacity duration-300"}>
                                <AiveryInsights 
                                    dateRange={aiveryDateRange}
                                    onLoad={handleInsightsLoad}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {loading && (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> 
                        <span className="ml-2 text-muted-foreground">Loading workouts...</span>
                    </div>
                )}
            </section>

            {/* Workouts List - Grouped by type */}
            {!metricsLoading && (() => {
                // Group workouts by type
                const workoutsByType = workoutsForDisplay.reduce((acc, workout) => {
                    const type = workout.type || 'other';
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(workout as WorkoutWithExercises);
                    return acc;
                }, {} as Record<string, WorkoutWithExercises[]>);

                // Sort workouts within each group by startTime
                Object.values(workoutsByType).forEach(workouts => {
                    workouts.sort((a, b) => {
                        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
                        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
                        return timeA - timeB;
                    });
                });

                return Object.entries(workoutsByType).map(([type, workouts]) => (
                    <WorkoutGroup key={type} type={type} workouts={workouts} />
                ));
            })()}

            {!metricsLoading && workoutsForDisplay.length === 0 && !dailyMetrics?.workoutCount && (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">
                        {isSameDay(selectedDate, today) 
                            ? "No workouts logged yet today. Ready to get started?" 
                            : "No workouts recorded for this day."}
                    </p>
                    <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => router.push('/workouts/new')}
                    >
                        {isSameDay(selectedDate, today) ? "Log Today's Workout" : "Log a Workout"}
                    </Button>
                </div>
            )}
        </div>
    );
} 