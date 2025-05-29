"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, eachDayOfInterval, isSameDay, subDays, addDays, isAfter, isValid } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2, Activity, Dumbbell, Ruler, Clock, Route, Weight, ChevronDown, ChevronUp, Heart, Zap, LucidePlus } from 'lucide-react';
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
import { motion } from 'framer-motion';
import Link from 'next/link';

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
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{ scale: 1.01 }}
        >
            <Card className="overflow-hidden bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader 
                    className="pb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm"
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Activity className="h-5 w-5 text-white" />
                            </motion.div>
                            <div>
                                <CardTitle className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                    {workout.name}
                                </CardTitle>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                    {format(new Date(workout.date), 'h:mm a')}
                                </p>
                    </div>
                        </div>
                        <div className="flex items-center gap-3">
                        {workout.records && workout.records.length > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                >
                            <PRBadge isNew={hasNewDistancePR || hasNewPacePR} />
                                </motion.div>
                        )}
                            <motion.div 
                                className="w-8 h-8 rounded-full bg-white/50 dark:bg-neutral-800/50 flex items-center justify-center transition-colors hover:bg-white/80 dark:hover:bg-neutral-700/50"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </motion.div>
                    </div>
                </div>
            </CardHeader>
                <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Clock className="h-5 w-5 mb-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {formatDuration(workout.duration)}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Duration
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Route className="h-5 w-5 mb-3 text-blue-600 dark:text-blue-400" />
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                    {distanceInKm.toFixed(1)} km
                                </span>
                            {workout.records?.some(r => r.type === 'longestRun') && (
                                <PRBadge size="sm" className="mb-1" isNew={hasNewDistancePR} />
                            )}
                        </div>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Distance
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Activity className="h-5 w-5 mb-3 text-blue-600 dark:text-blue-400" />
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                    {pace}
                                </span>
                            {workout.records?.some(r => r.type === 'fastest5kPace') && (
                                <PRBadge size="sm" className="mb-1" isNew={hasNewPacePR} />
                            )}
                        </div>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Pace
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Zap className="h-5 w-5 mb-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {maxSpeed ? `${maxSpeed.toFixed(1)}` : '--'}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Max Speed (km/h)
                            </span>
                        </motion.div>
                </div>

                {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="space-y-6"
                        >
                            {(avgHeartRate || maxHeartRate || elevationGain) && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {avgHeartRate && (
                                        <motion.div 
                                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 }}
                                        >
                                            <Heart className="h-5 w-5 mb-3 text-red-500" />
                                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                                {Math.round(avgHeartRate)}
                                            </span>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                                Avg HR
                                            </span>
                                        </motion.div>
                            )}
                            {maxHeartRate && (
                                        <motion.div 
                                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            <Heart className="h-5 w-5 mb-3 text-red-600" />
                                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                                {Math.round(maxHeartRate)}
                                            </span>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                                Max HR
                                            </span>
                                        </motion.div>
                            )}
                            {elevationGain && (
                                        <motion.div 
                                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                        >
                                            <Ruler className="h-5 w-5 mb-3 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                                {Math.round(elevationGain)}m
                                            </span>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                                Elevation
                                            </span>
                                        </motion.div>
                            )}
                        </div>
                            )}
                            
                        {workout.notes && (
                                <motion.div 
                                    className="p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/50 dark:border-blue-800/30"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 italic leading-relaxed">
                                        "{workout.notes}"
                                    </p>
                                </motion.div>
                        )}
                            
                        {workout.aiHighlight && (
                                <motion.div 
                                    className="p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/50 dark:border-blue-800/30"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-xl">{getHighlightIcon(workout.aiHighlight)}</span>
                                        <div>
                                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 leading-relaxed italic">
                                                "{workout.aiHighlight}"
                                            </p>
                                            <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 font-medium">
                                                — Aivery
                                </p>
                            </div>
                                    </div>
                                </motion.div>
                        )}
                            
                            <motion.div 
                                className="flex justify-end"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                            <Button 
                                variant="outline" 
                                    className="bg-white/50 dark:bg-neutral-800/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 font-medium tracking-tight transition-all duration-300"
                                onClick={() => router.push(`/workouts/${workout._id}`)}
                            >
                                View Details
                            </Button>
                            </motion.div>
                        </motion.div>
                )}
            </CardContent>
        </Card>
        </motion.div>
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
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{ scale: 1.01 }}
        >
            <Card className="overflow-hidden bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200/50 dark:border-orange-800/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader 
                    className="pb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm"
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Dumbbell className="h-5 w-5 text-white" />
                            </motion.div>
                            <div>
                                <CardTitle className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                    {workout.name}
                                </CardTitle>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                    {format(new Date(workout.date), 'h:mm a')}
                                </p>
                    </div>
                        </div>
                        <div className="flex items-center gap-3">
                        {workout.records && workout.records.length > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                >
                            <PRBadge />
                                </motion.div>
                        )}
                            <motion.div 
                                className="w-8 h-8 rounded-full bg-white/50 dark:bg-neutral-800/50 flex items-center justify-center transition-colors hover:bg-white/80 dark:hover:bg-neutral-700/50"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </motion.div>
                    </div>
                </div>
            </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Clock className="h-5 w-5 mb-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {formatDuration(workout.duration)}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Duration
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Weight className="h-5 w-5 mb-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {formatVolume(totalVolume)}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Volume
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Activity className="h-5 w-5 mb-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {totalReps}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Total Reps
                            </span>
                        </motion.div>
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Dumbbell className="h-5 w-5 mb-3 text-orange-600 dark:text-orange-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {totalSets}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Sets
                            </span>
                        </motion.div>
                </div>

                {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="space-y-4"
                        >
                            {workout.workoutExercises?.map((exercise, index) => {
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
                                    <motion.div 
                                        key={exercise._id} 
                                        className="p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + (index * 0.1) }}
                                        whileHover={{ y: -2 }}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center">
                                                    <Dumbbell className="w-4 h-4 text-white" />
                                            </div>
                                                <div>
                                                    <span className="text-base font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                                        {exercise.exerciseId.name}
                                                    </span>
                                                    {hasPR && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                                            className="inline-block ml-2"
                                                        >
                                                            <PRBadge size="sm" />
                                                        </motion.div>
                                                    )}
                                            </div>
                                        </div>
                                            <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                                                <span className="font-medium">{exerciseReps} reps</span>
                                                <span className="font-medium">{formatVolume(exerciseVolume)}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {exercise.sets?.map((set: SetData, setIndex) => {
                                                const isBodyweight = estimateBodyweightForExercise(exercise.exerciseId.name) > 0;
                                                return (
                                                    <div key={setIndex} className="flex items-center justify-between py-2 px-4 rounded-lg bg-gradient-to-r from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20">
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-medium text-orange-700 dark:text-orange-300">
                                                                {setIndex + 1}
                                                            </span>
                                                        {isBodyweight ? (
                                                                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                                                    {set.reps} reps
                                                                </span>
                                                        ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                                                        {set.weight}kg
                                                                    </span>
                                                                    <span className="text-neutral-500 dark:text-neutral-400">×</span>
                                                                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                                                                        {set.reps}
                                                                    </span>
                                                                </div>
                                                        )}
                                                        </div>
                                                        {set.notes && (
                                                            <span className="text-xs text-orange-600 dark:text-orange-400 italic">
                                                                {set.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            <motion.div 
                                className="flex justify-end"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                            >
                            <Button 
                                variant="outline" 
                                    className="bg-white/50 dark:bg-neutral-800/50 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/50 font-medium tracking-tight transition-all duration-300"
                                onClick={() => router.push(`/workouts/${workout._id}`)}
                            >
                                View Details
                            </Button>
                            </motion.div>
                        </motion.div>
                )}
            </CardContent>
        </Card>
        </motion.div>
    );
};

// Enhanced WorkoutGroup component with sophisticated design
const WorkoutGroup = ({ type, workouts }: { type: string, workouts: WorkoutWithExercises[] }) => {
    const { colorClasses } = getWorkoutTypeStyle(type);
    const baseColor = colorClasses.includes('text-[#58a3ff]') ? '#58a3ff' : 
                     colorClasses.includes('text-[#fa9f7b]') ? '#fa9f7b' : 
                     '#94a3b8';

    return (
        <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            {/* Enhanced Group Header */}
            <motion.div 
                className="sticky top-[7.5rem] z-[5] bg-background/95 backdrop-blur-xl py-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <motion.div 
                            className={cn(
                                "w-3 h-3 rounded-full",
                        colorClasses.replace('text-', 'bg-')
                            )}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, duration: 0.3, type: "spring", stiffness: 200 }}
                        />
                        <div>
                            <h3 className={cn(
                                "text-lg font-serif tracking-tight capitalize",
                                "text-neutral-900 dark:text-neutral-100"
                            )}>
                    {type}
                            </h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                {workouts.length} {workouts.length === 1 ? 'session' : 'sessions'}
                            </p>
                </div>
            </div>
                </div>
            </motion.div>

            {/* Enhanced Workouts Grid */}
            <div className="space-y-6">
                {workouts.map((workout, index) => (
                    <motion.div 
                        key={workout._id} 
                        className="relative"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                            delay: 0.4 + (index * 0.1), 
                            duration: 0.5, 
                            ease: "easeOut" 
                        }}
                        whileHover={{ 
                            y: -2,
                            transition: { duration: 0.2 }
                        }}
                    >
                        {/* Subtle left border accent */}
                        <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 rounded-full",
                            colorClasses.replace('text-', 'bg-'),
                            "opacity-30"
                        )} />
                        
                        <div className="pl-6">
                        {workout.type === 'running' ? (
                            <RunningWorkoutCard workout={workout} />
                        ) : workout.type === 'strength' ? (
                            <StrengthWorkoutCard workout={workout} />
                        ) : (
                            <DefaultWorkoutCard workout={workout} />
                        )}
                    </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

// Enhanced DefaultWorkoutCard component to match the sophisticated style
const DefaultWorkoutCard = ({ workout }: { workout: WorkoutWithExercises }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const { colorClasses } = getWorkoutTypeStyle(workout.type);
    const baseColor = colorClasses.includes('text-[#58a3ff]') ? '#58a3ff' : 
                     colorClasses.includes('text-[#fa9f7b]') ? '#fa9f7b' : 
                     '#94a3b8';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            whileHover={{ scale: 1.01 }}
        >
            <Card className="overflow-hidden bg-gradient-to-br from-neutral-50/50 to-slate-50/50 dark:from-neutral-950/30 dark:to-slate-950/30 border border-neutral-200/50 dark:border-neutral-800/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader 
                    className="pb-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-500 to-slate-600 flex items-center justify-center shadow-sm"
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Activity className="h-5 w-5 text-white" />
                            </motion.div>
                            <div>
                                <CardTitle className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                    {workout.name}
                                </CardTitle>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                    {format(new Date(workout.date), 'h:mm a')}
                                </p>
                    </div>
                        </div>
                        <motion.div 
                            className="w-8 h-8 rounded-full bg-white/50 dark:bg-neutral-800/50 flex items-center justify-center transition-colors hover:bg-white/80 dark:hover:bg-neutral-700/50"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                        >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </motion.div>
                </div>
            </CardHeader>
                <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <motion.div 
                            className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Clock className="h-5 w-5 mb-3 text-neutral-600 dark:text-neutral-400" />
                            <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {formatDuration(workout.duration)}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                Duration
                            </span>
                        </motion.div>
                    {workout.distance && (
                            <motion.div 
                                className="flex flex-col items-center p-6 rounded-2xl bg-white/70 dark:bg-neutral-800/50 backdrop-blur-sm border border-white/50 dark:border-neutral-700/50 shadow-sm"
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Route className="h-5 w-5 mb-3 text-neutral-600 dark:text-neutral-400" />
                                <span className="text-lg font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-1">
                                {formatDistance(workout.distance > 100 ? workout.distance / 1000 : workout.distance)}
                            </span>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">
                                    Distance
                                </span>
                            </motion.div>
                    )}
                </div>

                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="space-y-6"
                        >
                            {workout.notes && (
                                <motion.div 
                                    className="p-6 rounded-2xl bg-gradient-to-br from-neutral-50/80 to-slate-50/80 dark:from-neutral-950/40 dark:to-slate-950/40 border border-neutral-200/50 dark:border-neutral-800/30"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <p className="text-sm text-neutral-700 dark:text-neutral-300 italic leading-relaxed">
                                        "{workout.notes}"
                                    </p>
                                </motion.div>
                )}

                            <motion.div 
                                className="flex justify-end"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                        <Button 
                            variant="outline" 
                                    className="bg-white/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-950/50 font-medium tracking-tight transition-all duration-300"
                            onClick={() => router.push(`/workouts/${workout._id}`)}
                        >
                            View Details
                        </Button>
                            </motion.div>
                        </motion.div>
                )}
            </CardContent>
        </Card>
        </motion.div>
    );
};

// Add this helper if not present
const getHighlightIcon = (text: string): string => {
  if (!text) return '💬';
  if (/record|PR|fastest|longest|personal/i.test(text)) return '🎉';
  if (/consistency|routine|streak|momentum/i.test(text)) return '📈';
  if (/rest|recovery|ease|light/i.test(text)) return '😌';
  if (/hard|tough|challenging|pushed/i.test(text)) return '🔥';
  return '💬';
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
        <motion.div 
            className="space-y-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            {/* Enhanced Date Scroller with sophisticated design */}
            <motion.div 
                className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/50 pb-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <div className="flex items-center justify-between gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => shiftView(-7)} 
                        aria-label="Previous week"
                        className="w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-300"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <ScrollArea className="flex-grow w-full">
                        <div className="flex justify-center gap-3 px-4">
                            {dateRange.map(date => {
                                const dateStr = formatDateKey(date);
                                const isSelected = isSameDay(date, selectedDate);
                                const isFuture = isAfter(date, today);
                                const workoutsOnDate = workouts.filter(w => w.date && isSameDay(parseISO(w.date.toString()), date));
                                const hasWorkout = workoutsOnDate.length > 0;
                                const workoutTypes = Array.from(new Set(workoutsOnDate.map(w => w.type)));

                                return (
                                    <motion.div
                                        key={dateStr}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Button
                                            variant="ghost"
                                        className={cn(
                                                "flex flex-col items-center justify-center h-20 w-16 rounded-2xl p-3 transition-all duration-300 relative backdrop-blur-sm",
                                                isSelected && "bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-neutral-100 dark:to-neutral-200 text-white dark:text-neutral-900 shadow-lg scale-105",
                                                !isSelected && hasWorkout && "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200/50 dark:border-blue-800/50",
                                                !isSelected && !hasWorkout && "hover:bg-neutral-50 dark:hover:bg-neutral-900/50",
                                                isFuture && "opacity-40"
                                        )}
                                        onClick={() => handleDateSelect(date)}
                                    >
                                        <span className={cn(
                                                "text-xs font-medium tracking-wider uppercase",
                                                isSelected ? "text-white dark:text-neutral-900" : "text-neutral-500 dark:text-neutral-400"
                                        )}>{format(date, 'eee')}</span>
                                        <span className={cn(
                                                "text-xl font-serif tracking-tight mt-1",
                                                isSelected ? "text-white dark:text-neutral-900" : "text-neutral-900 dark:text-neutral-100"
                                        )}>{format(date, 'd')}</span>
                                        <span className={cn(
                                                "text-xs font-medium tracking-wide",
                                                isSelected ? "text-white/80 dark:text-neutral-900/80" : "text-neutral-500 dark:text-neutral-400"
                                        )}>{format(date, 'MMM')}</span>
                                        
                                            {/* Enhanced Workout Indicators */}
                                        {hasWorkout && (
                                                <motion.div 
                                                    className="absolute -bottom-1 flex gap-1 justify-center"
                                                    initial={{ opacity: 0, scale: 0 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.2, duration: 0.3 }}
                                                >
                                                    {workoutTypes.slice(0, 3).map((type, idx) => (
                                                        <div 
                                                            key={`${dateStr}-${type}`}
                                                            className={cn(
                                                                "w-2 h-2 rounded-full backdrop-blur-sm",
                                                                type.toLowerCase().includes('run') || type.toLowerCase().includes('cardio') 
                                                                    ? "bg-blue-500 shadow-sm" 
                                                                    : type.toLowerCase().includes('strength') 
                                                                        ? "bg-purple-500 shadow-sm"
                                                                        : "bg-emerald-500 shadow-sm"
                                                            )}
                                                        />
                                                    ))}
                                                </motion.div>
                                        )}
                                    </Button>
                                    </motion.div>
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
                        className="w-10 h-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-300"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>

            {/* Enhanced Daily Summary Card */}
            {!metricsLoading && dailyMetrics && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                >
                    <div className="p-8 bg-white/80 dark:bg-neutral-900/50 rounded-2xl backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-800/50 shadow-sm">
                        <div className="mb-6">
                            <h3 className="text-xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
                                Daily Summary
                            </h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                            </p>
                        </div>
                        
                        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
                            <motion.div
                                className="space-y-3"
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                            {dailyMetrics.workoutCount}
                                        </p>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Workouts</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                className="space-y-3"
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                            {formatDuration(dailyMetrics.totalDuration)}
                                        </p>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Duration</p>
                                    </div>
                                </div>
                            </motion.div>

                            {dailyMetrics.totalDistance > 0 && (
                                <motion.div
                                    className="space-y-3"
                                    whileHover={{ y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                            <Route className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                                {formatDistance(dailyMetrics.totalDistance)}
                                            </p>
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Distance</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {dailyMetrics.totalVolume > 0 && (
                                <motion.div
                                    className="space-y-3"
                                    whileHover={{ y: -2 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                            <Weight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-serif tracking-tight text-neutral-900 dark:text-neutral-100">
                                                {`${(dailyMetrics.totalVolume / 1000).toFixed(1)}t`}
                                            </p>
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Volume</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Loading state for metrics */}
            {metricsLoading && (
                <motion.div 
                    className="flex justify-center items-center p-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" /> 
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading daily summary...</span>
                </div>
                </motion.div>
            )}

            {/* Enhanced AI Insights Section */}
            <motion.section 
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
            >
                {!loading && (
                    <div className="p-8 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-xl shadow-sm">
                            {insightsLoading && (
                                <div className="flex justify-center items-center p-8">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" /> 
                                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Generating insights...</span>
                                </div>
                                </div>
                            )}
                        <motion.div 
                            className={insightsLoading ? "opacity-0 h-0 overflow-hidden" : "opacity-100 transition-opacity duration-500"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: insightsLoading ? 0 : 1 }}
                            transition={{ duration: 0.5 }}
                        >
                                <AiveryInsights 
                                    dateRange={aiveryDateRange}
                                    onLoad={handleInsightsLoad}
                                />
                        </motion.div>
                            </div>
                )}
                {loading && (
                    <div className="flex justify-center items-center p-12">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" /> 
                            <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading workouts...</span>
                        </div>
                    </div>
                )}
            </motion.section>

            {/* Enhanced Workouts List */}
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

                return (
                    <motion.div
                        className="space-y-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                    >
                        {Object.entries(workoutsByType).map(([type, workouts], index) => (
                            <motion.div
                                key={type}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + (index * 0.1), duration: 0.5, ease: "easeOut" }}
                            >
                                <WorkoutGroup type={type} workouts={workouts} />
                            </motion.div>
                        ))}
                    </motion.div>
                );
            })()}

            {/* Enhanced Empty State */}
            {!metricsLoading && workoutsForDisplay.length === 0 && !dailyMetrics?.workoutCount && (
                <motion.div 
                    className="text-center py-16"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                >
                    <div className="space-y-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center">
                            <Activity className="w-8 h-8 text-neutral-400" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-lg font-serif text-neutral-600 dark:text-neutral-300">
                        {isSameDay(selectedDate, today) 
                                    ? "Ready to start today's journey?" 
                                    : "A quiet day in your training log"}
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {isSameDay(selectedDate, today) 
                                    ? "Log your first workout and let's begin tracking your progress." 
                                    : "No workouts were recorded for this day."}
                    </p>
                        </div>
                        {isSameDay(selectedDate, today) && (
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Link href="/workouts/new">
                    <Button 
                                        size="lg" 
                                        className="bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 dark:from-neutral-100 dark:to-neutral-200 dark:hover:from-neutral-200 dark:hover:to-neutral-300 text-white dark:text-neutral-900 font-medium tracking-tight transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                                        <LucidePlus className="h-4 w-4 mr-2" />
                                        Log Your First Workout
                    </Button>
                                </Link>
                            </motion.div>
            )}
        </div>
                </motion.div>
            )}
        </motion.div>
    );
} 