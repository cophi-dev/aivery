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
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
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
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#58a3ff]" />
                        <CardTitle className="text-lg font-medium">{workout.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {workout.records && workout.records.length > 0 && (
                            <PRBadge isNew={hasNewDistancePR || hasNewPacePR} />
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-[#58a3ff]/5">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
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
                const isNew = now - recordTime < 24 * 60 * 60 * 1000; // Within 24 hours
                
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
                } else if (prType.includes('max') && record.value) {
                    // Handle other numeric PRs
                    prValue = record.value.toString();
                } else if (record.exerciseName) {
                    // Exercise-specific PR
                    prType = `PR in ${record.exerciseName}`;
                    if (record.value) {
                        prValue = record.value.toString();
                    } else if (record.weight) {
                        prValue = `${record.weight}kg`;
                    }
                }
                
                if (prValue) {
                    showPR(prType, prValue);
                }
            });
        }
    }, [workout.records, showPR]);
    
    // Calculate total volume and stats
    const totalVolume = workout.calculatedVolume || 0;
    const totalSets = workout.workoutExercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;
    const totalReps = workout.workoutExercises?.reduce((acc, ex) => 
        acc + (ex.sets?.reduce((setAcc, set) => setAcc + (set.reps || 0), 0) || 0), 0) || 0;
    const totalExercises = workout.workoutExercises?.length || 0;
    
    // Check for newly set strength PRs (within last 24 hours)
    const hasNewStrengthPRs = workout.records?.some(r => {
        const recordDate = r.createdAt || r.date || new Date();
        const recordTime = new Date(recordDate).getTime();
        const now = Date.now();
        return now - recordTime < 24 * 60 * 60 * 1000; // Within 24 hours
    });

    return (
        <Card className="mb-6 overflow-hidden bg-[#fa9f7b]/[0.02] hover:bg-[#fa9f7b]/[0.04] transition-all duration-300 border-0 shadow-none">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-[#fa9f7b]" />
                        <CardTitle className="text-lg font-medium">{workout.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {workout.records && workout.records.length > 0 && (
                            <PRBadge isNew={hasNewStrengthPRs} />
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-[#fa9f7b]/5">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Clock className="h-5 w-5 mb-2 text-[#fa9f7b]" />
                        <span className="text-base font-medium mb-1">{formatDuration(workout.duration)}</span>
                        <span className="text-xs text-muted-foreground">Duration</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Weight className="h-5 w-5 mb-2 text-[#fa9f7b]" />
                        <span className="text-base font-medium mb-1">{(totalVolume / 1000).toFixed(1)}t</span>
                        <span className="text-xs text-muted-foreground">Volume</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Activity className="h-5 w-5 mb-2 text-[#fa9f7b]" />
                        <span className="text-base font-medium mb-1">{totalReps}</span>
                        <span className="text-xs text-muted-foreground">Total Reps</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                        <Dumbbell className="h-5 w-5 mb-2 text-[#fa9f7b]" />
                        <span className="text-base font-medium mb-1">{totalSets}</span>
                        <span className="text-xs text-muted-foreground">Sets</span>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        <div className="space-y-4 mt-6">
                            {workout.workoutExercises?.map((exercise) => {
                                const exerciseReps = exercise.sets?.reduce((acc, set) => acc + (set.reps || 0), 0) || 0;
                                const exerciseVolume = exercise.sets?.reduce((acc, set) => acc + ((set.weight || 0) * (set.reps || 0)), 0) || 0;
                                
                                // Check if this exercise has a PR
                                const hasPR = workout.records?.some(record => 
                                    record.exerciseId === exercise.exerciseId._id.toString()
                                );
                                
                                return (
                                    <div key={exercise._id} className="p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{exercise.exerciseId.name}</span>
                                                {hasPR && (
                                                    <PRBadge size="sm" isNew={
                                                        // Check if this exercise has a new PR
                                                        workout.records?.some(record => 
                                                            record.exerciseId === exercise.exerciseId._id.toString() && 
                                                            record.createdAt && 
                                                            new Date(record.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
                                                        )
                                                    } />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <span>{exerciseReps} reps</span>
                                                <span>•</span>
                                                <span>{(exerciseVolume / 1000).toFixed(1)}t</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {exercise.sets?.map((set, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">Set {index + 1}</span>
                                                    <span>{set.weight}kg × {set.reps}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {workout.notes && (
                            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-[#fa9f7b]/5 to-[#fa9f7b]/5 border border-[#fa9f7b]/10">
                                <p className="text-sm text-muted-foreground">{workout.notes}</p>
                            </div>
                        )}
                        {workout.aiHighlight && (
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-[#fa9f7b]/5 to-[#fa9f7b]/5 border border-[#fa9f7b]/10">
                                <p className="text-sm text-[#fa9f7b]/90">{workout.aiHighlight}</p>
                            </div>
                        )}
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

export default function WorkoutDailyView() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
    const [dailyMetrics, setDailyMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [previousDayMetrics, setPreviousDayMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
    
    // Track insights loading state separately
    const [insightsLoading, setInsightsLoading] = useState(true);
    const handleInsightsLoad = useCallback(() => {
        setInsightsLoading(false);
    }, []);
    
    const handleInsightsLoadStart = useCallback(() => {
        setInsightsLoading(true);
    }, []);

    // Get today's date for comparison
    const today = startOfDay(new Date());

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

            {/* Workouts List - Should use workoutsForDisplay (derived from dailyMetrics.workouts) */}
            {!metricsLoading && workoutsForDisplay.map(workout => {
                const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                const isExpanded = expandedWorkouts[workout._id];

                return (
                    <div key={workout._id}>
                        {workout.type === 'running' ? (
                            <RunningWorkoutCard workout={workout as WorkoutWithExercises} />
                        ) : workout.type === 'strength' ? (
                            <StrengthWorkoutCard workout={workout as WorkoutWithExercises} />
                        ) : (
                            <Collapsible
                                open={isExpanded}
                                onOpenChange={() => toggleWorkoutExpansion(workout._id)}
                            >
                                <Card className="overflow-hidden border border-border/50 transition-colors hover:bg-muted/5">
                                    <div 
                                        className="cursor-pointer"
                                        onClick={() => handleWorkoutClick(workout._id)}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Badge variant="outline" className={`flex items-center px-2 py-0.5 ${colorClasses}`}>
                                                        {icon}
                                                        <span className="ml-1.5 text-xs capitalize">{workout.type}</span>
                                                    </Badge>
                                                    <h3 className="font-semibold">{workout.name || 'Unnamed Workout'}</h3>
                                                </div>
                                                <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </CollapsibleTrigger>
                                            </div>
                                        </CardHeader>
                                        
                                        <CardContent className="pb-3">
                                            {/* Workout Metrics */}
                                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                                <span className="flex items-center">
                                                    <Clock className="h-4 w-4 mr-1.5" />
                                                    {formatDuration(workout.duration || 0)}
                                                </span>
                                                {workout.distance && (
                                                    <span className="flex items-center">
                                                        <Route className="h-4 w-4 mr-1.5" />
                                                        {formatDistance(workout.distance > 100 ? workout.distance / 1000 : workout.distance)}
                                                    </span>
                                                )}
                                                {workout.calculatedVolume && (
                                                    <span className="flex items-center">
                                                        <Weight className="h-4 w-4 mr-1.5" />
                                                        {(workout.calculatedVolume / 1000).toFixed(1)}t
                                                    </span>
                                                )}
                                                {workout.cardioDetails?.heartRate?.average && (
                                                    <span className="flex items-center">
                                                        <Heart className="h-4 w-4 mr-1.5" />
                                                        {workout.cardioDetails.heartRate.average} bpm
                                                    </span>
                                                )}
                                            </div>

                                            {/* AI Highlight - if available */}
                                            {workout.aiHighlight && (
                                                <div className="mt-3 flex items-start space-x-2 text-sm bg-primary/5 rounded-lg p-3">
                                                    <Zap className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                                    <p className="text-muted-foreground">{workout.aiHighlight}</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </div>

                                    {/* Collapsible Exercise Details */}
                                    <CollapsibleContent>
                                        <div className="border-t">
                                            <div className="p-4 space-y-3">
                                                <h4 className="text-sm font-medium">Exercises</h4>
                                                {workout.workoutExercises?.map((exercise, idx) => (
                                                    <div key={exercise._id} className="pl-4 border-l-2 border-primary/20">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">{exercise.exerciseId.name}</span>
                                                            {exercise.sets && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {exercise.sets && (
                                                            <div className="mt-1 space-y-1">
                                                                {exercise.sets.map((set: SetData, setIdx) => (
                                                                    <div key={setIdx} className="text-xs text-muted-foreground flex items-center space-x-3">
                                                                        <span>{set.weight}kg</span>
                                                                        <span>×</span>
                                                                        <span>{set.reps} reps</span>
                                                                        {set.notes && <span className="text-primary/60">• {set.notes}</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!workout.workoutExercises || workout.workoutExercises.length === 0) && (
                                                    <p className="text-sm text-muted-foreground italic">No exercises recorded for this workout.</p>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        )}
                    </div>
                );
            })}

            {!metricsLoading && workoutsForDisplay.length === 0 && !dailyMetrics?.workoutCount && (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">No workouts recorded for this day.</p>
                    <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => router.push('/workouts/new')}
                    >
                        Log a Workout
                    </Button>
                </div>
            )}
        </div>
    );
} 