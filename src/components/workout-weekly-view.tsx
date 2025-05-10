"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, startOfDay, isBefore, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, Route, Weight, Dumbbell, Flame, ChevronUp, ChevronDown, Activity, Heart, Zap, Ruler } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData } from '@/types/db';
// NEW: Import Switch and Label for the toggle
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PRBadge } from "@/components/ui/pr-badge";

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, LabelList, Legend, ReferenceLine, Label as RechartsLabel } from 'recharts'; // Renamed Label import
// Import helpers from utils and the new MetricCard location
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
// Import the content component, and Card 
import { MetricContent } from '@/components/ui/metric-card'; // Adjusted import name
// Remove MetricCard import, Add DoubleMetricCard import
// import { MetricCard } from '@/components/ui/metric-card'; 
// Import getWorkoutTypeStyle for the list
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
// Import AiveryInsights component
import AiveryInsights from '@/components/dashboard/AiveryInsights';

const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// Define workout categories (adjust as needed)
const CARDIO_TYPES = ['running', 'run', 'cycling', 'bike', 'ride', 'swimming', 'swim'];
const STRENGTH_TYPES = ['strength', 'workout'];

// Updated Chart data type (Volume in Tons)
interface DailyChartData {
    day: string; // e.g., 'Mon'
    cardioDuration: number; // minutes
    strengthDuration: number; // minutes
    cardioDistance: number; // km
    strengthVolume: number; // tons <--- CHANGED
    cumulativeCardioDistance: number; // km
    cumulativeStrengthVolume: number; // tons <--- CHANGED
}

// Updated type for aggregated weekly stats (Volume in Tons)
interface WeeklyWorkoutMetrics {
    totalWorkouts: number;
    totalDuration: number;
    totalDistance: number;
    totalVolume: number; // tons <--- CHANGED
    workoutsByDay: { [day: string]: WorkoutData[] };
    dailyChartData: DailyChartData[];
    allWorkoutsInWeek: WorkoutData[];
}

// Updated function to get metrics for a given week (Refactored Logic)
async function getMetricsForWeek(weekStart: Date, weekEnd: Date, weeklyWorkouts: WorkoutData[]): Promise<WeeklyWorkoutMetrics> {
    
    // --- Step 1: Aggregate DAILY totals --- 
    const dailyTotalsMap: { 
        [dayName: string]: { 
            cardioDuration: number;
            strengthDuration: number;
            cardioDistance: number; // km
            strengthVolume: number; // tons <--- CHANGED
        } 
    } = {};
    const workoutsByDay: { [day: string]: WorkoutData[] } = {};

    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const dayNamesInOrder = daysInWeek.map(day => format(day, 'eee'));

    // Initialize daily totals and workoutsByDay
    dayNamesInOrder.forEach(dayName => {
        dailyTotalsMap[dayName] = {
            cardioDuration: 0,
            strengthDuration: 0,
            cardioDistance: 0,
            strengthVolume: 0, // Initialize as tons
        };
    });
    daysInWeek.forEach(day => {
        workoutsByDay[formatDateKey(day)] = [];
    });

    // Initialize overall totals
    let totalWorkouts = weeklyWorkouts.length;
    let totalDuration = 0;
    let totalDistanceKm = 0;
    let totalVolumeTons = 0;

    // Loop 1: Calculate daily totals and overall totals
    for (const w of weeklyWorkouts) {
        const workoutDate = parseISO(w.date.toString());
        const dayName = format(workoutDate, 'eee');
        const duration = w.duration || 0;
        const volumeKg = w.calculatedVolume || 0;
        const volumeTons = volumeKg / 1000;
        
        // Normalize distance to kilometers
        let distanceInKm = 0;
        if (w.cardioDetails?.distance) {
            // cardioDetails.distance is already in km
            distanceInKm = w.cardioDetails.distance;
        } else if (w.distance) {
            // If distance is large (> 100), assume it's in meters and convert to km
            distanceInKm = w.distance > 100 ? w.distance / 1000 : w.distance;
        }

        // Update totals
        totalDuration += duration;
        totalDistanceKm += distanceInKm;
        totalVolumeTons += volumeTons;

        // Update daily totals based on workout type
        if (CARDIO_TYPES.includes(w.type?.toLowerCase() || '')) {
            dailyTotalsMap[dayName].cardioDuration += Math.round(duration / 60); // Convert to minutes
            dailyTotalsMap[dayName].cardioDistance += distanceInKm;
        } else if (STRENGTH_TYPES.includes(w.type?.toLowerCase() || '')) {
            dailyTotalsMap[dayName].strengthDuration += Math.round(duration / 60);
            dailyTotalsMap[dayName].strengthVolume += volumeTons;
        }

        // Store workout in workoutsByDay
        const dateKey = formatDateKey(workoutDate);
        workoutsByDay[dateKey] = workoutsByDay[dateKey] || [];
        workoutsByDay[dateKey].push(w);
    }

    // --- Step 2: Build final chart data array and calculate cumulative (using Tons) --- 
    const dailyChartData: DailyChartData[] = [];
    let runningCumulativeDistance = 0;
    let runningCumulativeVolumeTons = 0; // <-- CHANGED to Tons

    for (const dayName of dayNamesInOrder) {
        const dailyTotals = dailyTotalsMap[dayName] || { cardioDuration: 0, strengthDuration: 0, cardioDistance: 0, strengthVolume: 0 };
        
        runningCumulativeDistance += dailyTotals.cardioDistance;
        runningCumulativeVolumeTons += dailyTotals.strengthVolume; // Accumulate Tons

        dailyChartData.push({
            day: dayName,
            // Daily values from map
            cardioDuration: dailyTotals.cardioDuration,
            strengthDuration: dailyTotals.strengthDuration,
            cardioDistance: Math.round(dailyTotals.cardioDistance * 100) / 100, // Round daily distance
            strengthVolume: Math.round(dailyTotals.strengthVolume * 100) / 100, // Round daily tons <-- CHANGED
            // Cumulative values
            cumulativeCardioDistance: Math.round(runningCumulativeDistance * 100) / 100,
            cumulativeStrengthVolume: Math.round(runningCumulativeVolumeTons * 100) / 100, // Cumulative tons <-- CHANGED
        });
    }

    const result: WeeklyWorkoutMetrics = { 
        totalWorkouts, 
        totalDuration, 
        totalDistance: totalDistanceKm, 
        totalVolume: totalVolumeTons, // Return total Tons <-- CHANGED
        workoutsByDay, 
        dailyChartData,
        allWorkoutsInWeek: weeklyWorkouts 
    };

    return result;
}

const RunningWorkoutCard = ({ workout }: { workout: WorkoutData }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    
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
                            <PRBadge />
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
                                <PRBadge size="sm" className="mb-1" />
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">Distance</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Activity className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <div className="flex items-center gap-1">
                            <span className="text-base font-medium mb-1">{pace}</span>
                            {workout.records?.some(r => r.type === 'fastest5kPace') && (
                                <PRBadge size="sm" className="mb-1" />
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

const StrengthWorkoutCard = ({ workout }: { workout: WorkoutData }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Calculate total volume and stats
    const totalVolume = workout.calculatedVolume || 0;
    const totalSets = workout.workoutExercises?.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0) || 0;
    const totalReps = workout.workoutExercises?.reduce((acc, ex) => 
        acc + (ex.sets?.reduce((setAcc, set) => setAcc + (set.reps || 0), 0) || 0), 0) || 0;
    const totalExercises = workout.workoutExercises?.length || 0;

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
                            <PRBadge />
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
                                                {hasPR && <PRBadge size="sm" />}
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

export default function WorkoutWeeklyView() {
    const router = useRouter();
    const [allWorkouts, setAllWorkouts] = useState<WorkoutData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyWorkoutMetrics | null>(null);
    const [previousWeekMetrics, setPreviousWeekMetrics] = useState<WeeklyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);
    const [showGoals, setShowGoals] = useState(true);
    const [showLastWeek, setShowLastWeek] = useState(false); // <-- NEW State for last week visibility
    // NEW State for combined chart data
    const [chartDisplayData, setChartDisplayData] = useState<any[]>([]); 
    // State to track screen size for responsiveness
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const selectedWeekEnd = useMemo(() => endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), [selectedWeekStart]);
    const previousWeekStart = useMemo(() => subWeeks(selectedWeekStart, 1), [selectedWeekStart]);
    const previousWeekEnd = useMemo(() => endOfWeek(previousWeekStart, { weekStartsOn: 1 }), [previousWeekStart]);

    // Pre-calculate max values from data for domain logic
    const { maxVolume, maxDistance } = useMemo(() => {
        if (!weeklyMetrics?.dailyChartData?.length) {
            return { maxVolume: 0, maxDistance: 0 };
        }
        let currentMaxVolume = 0;
        let currentMaxDistance = 0;
        for (const dayData of weeklyMetrics.dailyChartData) {
            if (dayData.cumulativeStrengthVolume > currentMaxVolume) {
                currentMaxVolume = dayData.cumulativeStrengthVolume;
            }
            if (dayData.cumulativeCardioDistance > currentMaxDistance) {
                currentMaxDistance = dayData.cumulativeCardioDistance;
            }
        }
        return { maxVolume: currentMaxVolume, maxDistance: currentMaxDistance };
    }, [weeklyMetrics?.dailyChartData]);

    // Calculate dynamic domains based on showGoals state and pre-calculated max values
    const leftYAxisDomain = useMemo(() => {
        const goal = 10; // 10 tons
        const buffer = 2; // Buffer in tons
        const calculatedMax = maxVolume || 0;
        if (showGoals) {
            return [0, Math.max(calculatedMax, goal) + buffer];
        }
        // Always return [number, number] when goals hidden
        return [0, calculatedMax + buffer]; 
    }, [showGoals, maxVolume]);

    const rightYAxisDomain = useMemo(() => {
        const goal = 10; // 10 km
        const buffer = 2; // Buffer in km
        const calculatedMax = maxDistance || 0;
        if (showGoals) {
            return [0, Math.max(calculatedMax, goal) + buffer];
        }
        // Always return [number, number] when goals hidden
        return [0, calculatedMax + buffer]; 
    }, [showGoals, maxDistance]);

    // Effect to check screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 640); // Tailwind's sm breakpoint
        };
        checkScreenSize(); // Initial check
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize); // Cleanup
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const endDate = addWeeks(new Date(), 4);
                const startDate = subWeeks(endDate, 12);
                const response = await fetch(`/api/workouts?_=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data: WorkoutData[] = await response.json();
                setAllWorkouts(data);
            } catch (err: any) {
                console.error("[WorkoutWeeklyView] Error fetching initial workouts:", err);
                setError(err.message || "Failed to load initial workout data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!isLoading && allWorkouts.length >= 0) {
            let isMounted = true; // Flag to check if component is still mounted
            
            // Set loading and clear state SYNCHRONOUSLY when effect runs
            setIsMetricsLoading(true); 
            setWeeklyMetrics(null);
            setPreviousWeekMetrics(null);

            const loadMetrics = async () => {
                try {
                    // Derive dates and FILTER workouts here
                    const currentWeekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
                    const prevWeekStart = subWeeks(selectedWeekStart, 1);
                    const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });

                    const currentWorkoutsInWeek = allWorkouts.filter(w => {
                        if (!w.date) return false;
                        const workoutDate = startOfDay(parseISO(w.date.toString()));
                        return !isBefore(workoutDate, selectedWeekStart) && !isAfter(workoutDate, currentWeekEnd);
                    });

                    const previousWorkoutsInWeek = allWorkouts.filter(w => {
                        if (!w.date) return false;
                        const workoutDate = startOfDay(parseISO(w.date.toString()));
                        return !isBefore(workoutDate, prevWeekStart) && !isAfter(workoutDate, prevWeekEnd);
                    });
                    
                    // Pass pre-filtered arrays to getMetricsForWeek SEQUENTIALLY
                    const prevMetrics = await getMetricsForWeek(prevWeekStart, prevWeekEnd, previousWorkoutsInWeek);
                    const currentMetrics = await getMetricsForWeek(selectedWeekStart, currentWeekEnd, currentWorkoutsInWeek);
                    
                    if (isMounted) {
                        const currentMetricsClone = { ...currentMetrics };
                        const prevMetricsClone = { ...prevMetrics };
                        setWeeklyMetrics(currentMetricsClone);
                        setPreviousWeekMetrics(prevMetricsClone); // Use the sequentially fetched prevMetrics
                    }
                } catch (err) {
                    if (isMounted) {
                        setWeeklyMetrics(null);
                        setPreviousWeekMetrics(null);
                    }
                } finally {
                    if (isMounted) {
                        setIsMetricsLoading(false); // Still set loading false in finally
                    }
                }
            };
            
            loadMetrics();
            
            // Cleanup function
            return () => { 
                isMounted = false; 
            }; 
        }
    }, [selectedWeekStart, isLoading]); // Removed allWorkouts dependency

    // NEW useEffect to combine data for chart rendering
    useEffect(() => {
        if (!weeklyMetrics) {
            setChartDisplayData([]); // Clear if no current data
            return;
        }

        // Create a map of previous week data by day name for quick lookup
        const prevDataMap = new Map<string, DailyChartData>();
        if (previousWeekMetrics?.dailyChartData) {
            previousWeekMetrics.dailyChartData.forEach(dayData => {
                prevDataMap.set(dayData.day, dayData);
            });
        }

        // Map current week data and merge previous week data
        const combinedData = weeklyMetrics.dailyChartData.map(currentDayData => {
            const prevDayData = prevDataMap.get(currentDayData.day);
            return {
                ...currentDayData, // Include all current day data
                // Add previous week values, defaulting to 0 or null if not found
                prevCumulativeStrengthVolume: prevDayData?.cumulativeStrengthVolume ?? null, 
                prevCumulativeCardioDistance: prevDayData?.cumulativeCardioDistance ?? null, 
            };
        });

        setChartDisplayData(combinedData);

    }, [weeklyMetrics, previousWeekMetrics]); // Re-run when metric data changes

    const shiftWeek = (weeks: number) => {
        setSelectedWeekStart(prev => addWeeks(prev, weeks));
    };

    const handleWorkoutClick = useCallback((workoutId: string) => {
        router.push(`/workouts/${workoutId}`);
    }, [router]);

    // Define margins based on screen size
    const chartMargins = useMemo(() => {
        return isSmallScreen 
            ? { top: 5, right: 5, left: 5, bottom: 0 } // Smaller margins for mobile
            : { top: 5, right: 15, left: 25, bottom: 0 }; // Original-like margins for larger screens
    }, [isSmallScreen]);

    // Define conditional label configs
    const leftAxisLabelConfig = useMemo(() => !isSmallScreen ? { 
        value: 'Strength (t)', 
        angle: -90, 
        position: 'insideLeft',
        offset: -15, // Adjusted offset for potentially larger margin
        style: { fontSize: '12px', fill: '#58a3ff', fontWeight: 500, textAnchor: 'middle' }
    } : undefined, [isSmallScreen]);

    const rightAxisLabelConfig = useMemo(() => !isSmallScreen ? { 
        value: 'Cardio (km)',
        angle: 90, 
        position: 'insideRight',
        offset: -15, // Adjusted offset for potentially larger margin
        style: { fontSize: '12px', fill: '#fa9f7b', fontWeight: 500, textAnchor: 'middle' }
    } : undefined, [isSmallScreen]);

    if (isLoading || isMetricsLoading) { // Check both loading states
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    const weekDisplay = `${format(selectedWeekStart, 'MMM d')} - ${format(selectedWeekEnd, 'MMM d, yyyy')}`;

    // Updated Custom Tooltip for Chart (Volume in Tons)
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Access the original data point for cumulative values
            const dataPoint = payload[0].payload; 
            const cumulativeVolume = dataPoint.cumulativeStrengthVolume; // Already in Tons
            const cumulativeDistance = dataPoint.cumulativeCardioDistance;
            // Access daily values for optional display
            const dailyVolume = dataPoint.strengthVolume; // Already in Tons
            const dailyDistance = dataPoint.cardioDistance;

            // Find line data for colors (or use predefined colors)
            const strengthColor = 'hsl(var(--primary))'; // Use primary color for strength
            // Use CSS var, provide fallback orange
            const cardioColor = 'var(--chart-orange, #fb923c)'; 

            return (
                // Use popover styles for theme consistency
                <div className="bg-popover text-popover-foreground border border-border/50 shadow-lg rounded-lg p-3.5 text-sm space-y-1">
                    <p className="font-semibold mb-1 text-center">{label}</p>
                    {cumulativeVolume > 0 && (
                        <div className="flex items-center">
                             {/* Use Dumbbell icon */}
                            <Dumbbell className="h-3.5 w-3.5 mr-1.5" style={{ color: strengthColor }}/> 
                            <p style={{ color: strengthColor }}>
                                {`${cumulativeVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} t`}
                                {dailyVolume > 0 && <span className="text-xs opacity-70 ml-1">{`(+${dailyVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} t)`}</span>}
                            </p>
                        </div>
                    )}
                    {cumulativeDistance > 0 && (
                         <div className="flex items-center">
                            <Flame className="h-3.5 w-3.5 mr-1.5" style={{ color: cardioColor }}/>
                            <p style={{ color: cardioColor }}>
                                {`${cumulativeDistance.toFixed(1)} km`}
                                {dailyDistance > 0 && <span className="text-xs opacity-70 ml-1">{`(+${dailyDistance.toFixed(1)} km)`}</span>}
                            </p>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">{weekDisplay}</h2>
                <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Next week">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Weekly Totals Section - Changed from Card to Heading + Grid */}
            <div className="mb-4">
                <h3 className="text-base font-semibold mb-3">Weekly Totals</h3>
                {!weeklyMetrics ? ( 
                    <p className="text-muted-foreground text-sm">No data available for this week.</p>
                ) : (
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4"> 
                        <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors"> 
                            <MetricContent 
                                title="Workouts"
                                value={weeklyMetrics.totalWorkouts.toString()}
                                change={calculatePercentageChange(weeklyMetrics.totalWorkouts, previousWeekMetrics?.totalWorkouts)}
                            />
                        </Card>
                        <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                            <MetricContent
                                title="Total Duration"
                                value={formatDuration(weeklyMetrics.totalDuration)}
                                change={calculatePercentageChange(weeklyMetrics.totalDuration, previousWeekMetrics?.totalDuration)}
                            />
                        </Card>
                        <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                            <MetricContent
                                title="Total Distance"
                                value={formatDistance(weeklyMetrics.totalDistance)}
                                change={calculatePercentageChange(weeklyMetrics.totalDistance, previousWeekMetrics?.totalDistance)}
                            />
                        </Card>
                        <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                            <MetricContent
                                title="Total Volume"
                                value={`${(weeklyMetrics.totalVolume).toFixed(1)}t`}
                                change={calculatePercentageChange(weeklyMetrics.totalVolume, previousWeekMetrics?.totalVolume)}
                            />
                        </Card>
                    </div>
                )}
            </div>
            
            {/* MOVED: Aivery Insights Section (Now Above Chart) */}
            <section className="mb-6"> {/* Added margin-bottom */} 
                <AiveryInsights dateRange={{ start: selectedWeekStart, end: selectedWeekEnd }} />
            </section>
            
            {/* Weekly Chart Card */}
             {weeklyMetrics && weeklyMetrics.totalWorkouts > 0 && ( 
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-x-4"> 
                        <CardTitle className="text-sm sm:text-base font-semibold whitespace-nowrap">Weekly Activity</CardTitle> 
                        {/* Combined Toggles */} 
                        <div className="flex items-center space-x-2 sm:space-x-4 ml-auto"> {/* Adjusted spacing for toggles on mobile */} 
                             {/* Show Last Week Toggle */}
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="show-last-week-switch"
                                    checked={showLastWeek}
                                    onCheckedChange={setShowLastWeek}
                                />
                                <Label htmlFor="show-last-week-switch" className="text-xs font-medium whitespace-nowrap">Last Week</Label>
                            </div>
                             {/* Show Goals Toggle */}
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="show-goals-switch"
                                    checked={showGoals}
                                    onCheckedChange={setShowGoals}
                                />
                                <Label htmlFor="show-goals-switch" className="text-xs font-medium">Goals</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ResponsiveContainer width="100%" height={250} minHeight={200} className="h-[200px] sm:h-[250px]">
                            {/* Use dynamic margins */}
                            <ComposedChart data={chartDisplayData} margin={chartMargins} > 
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.1} />
                                <XAxis 
                                    dataKey="day" 
                                    fontSize={10}
                                    tickLine={false} 
                                    axisLine={false}
                                    tick={{ fontWeight: 500, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted color, lighter weight
                                />
                                {/* Left Y Axis (Cumulative Volume - Tons) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={10}
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true}
                                    tickFormatter={(value) => `${value.toFixed(1)} t`}
                                    width={isSmallScreen ? 40 : 60} 
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted color
                                    label={leftAxisLabelConfig} 
                                    domain={leftYAxisDomain} 
                                />
                                {/* Right Y Axis (Cumulative Distance - km) */}
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right" 
                                    fontSize={10}
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true}
                                    tickFormatter={(value) => `${value.toFixed(1)} km`}
                                    width={isSmallScreen ? 40 : 60} 
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted color
                                    label={rightAxisLabelConfig} 
                                    domain={rightYAxisDomain} 
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ // Adjusted spacing
                                        paddingBottom: '10px', 
                                        marginBottom: '5px' 
                                    }}
                                    // Use formatter for responsive text size
                                    formatter={(value, entry) => (
                                        <span className="text-xs sm:text-sm text-muted-foreground ml-1" style={{ color: entry?.color }}>
                                            {value}
                                        </span>
                                    )}
                                    // Payload might not be needed if formatter is used, but keep for color info
                                    payload={[
                                        { value: 'Strength', type: 'circle', color: 'hsl(var(--primary))' }, 
                                        { value: 'Cardio', type: 'circle', color: 'var(--chart-orange, #fb923c)' } 
                                    ]}
                                />
                                <Tooltip 
                                    content={CustomTooltip} 
                                    cursor={{ 
                                        fill: 'hsl(var(--accent))', // Use accent for cursor fill
                                        opacity: 0.1 
                                    }} 
                                />

                                {/* Conditional Goal Reference Lines */}
                                {showGoals && (
                                    <>
                                        <ReferenceLine 
                                            yAxisId="left" 
                                            y={10} // Goal is 10 Tons
                                            stroke="hsl(var(--primary) / 0.5)" 
                                            strokeDasharray="3 3" 
                                            strokeWidth={1.5}
                                        >
                                            {/* Slightly larger goal label, adjusted positioning */}
                                            <RechartsLabel value="Goal" position="insideTopRight" fill="hsl(var(--primary) / 0.8)" fontSize={10} dy={-4} dx={-4} /> 
                                        </ReferenceLine>
                                        <ReferenceLine 
                                            yAxisId="right" 
                                            y={10} // Goal is 10 km
                                            stroke="hsl(var(--primary) / 0.5)" 
                                            strokeDasharray="3 3" 
                                            strokeWidth={1.5}
                                        >
                                             {/* Slightly larger goal label, adjusted positioning */}
                                             <RechartsLabel value="Goal" position="insideTopLeft" fill="hsl(var(--primary) / 0.8)" fontSize={10} dy={-4} dx={10} /> 
                                        </ReferenceLine>
                                    </>
                                )}

                                {/* Current Week Lines (remain the same) */}
                                <Line 
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="cumulativeStrengthVolume" 
                                    name="Strength" 
                                    stroke="hsl(var(--primary))" // Use primary color variable
                                    strokeWidth={2.5} // Slightly thinner
                                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }} // Smaller dot, no stroke
                                    activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2, fill: 'hsl(var(--primary))' }} // Refined active dot
                                />
                                <Line 
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="cumulativeCardioDistance"
                                    name="Cardio"
                                    stroke="var(--chart-orange, #fb923c)" // Use CSS var with fallback
                                    strokeWidth={2.5} // Slightly thinner
                                    dot={{ r: 4, fill: 'var(--chart-orange, #fb923c)', strokeWidth: 0 }} // Smaller dot, no stroke
                                    activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2, fill: 'var(--chart-orange, #fb923c)' }} // Refined active dot
                                />

                                {/* Previous Week Lines (Conditional) */}
                                {showLastWeek && (
                                    <>
                                        <Line 
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="prevCumulativeStrengthVolume" 
                                            stroke="hsl(var(--primary))" // Use primary color variable
                                            strokeWidth={1.5} // Thinner for previous week
                                            strokeOpacity={0.4} 
                                            strokeDasharray="3 3" // Dashed line
                                            dot={false} // No dots
                                            activeDot={false} // No active dot
                                            connectNulls={true} // Connect across null data points
                                            name="_prevStrength" // Hidden from default tooltip/legend
                                        />
                                        <Line 
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="prevCumulativeCardioDistance"
                                            stroke="var(--chart-orange, #fb923c)" // Use CSS var with fallback
                                            strokeWidth={1.5} // Thinner for previous week
                                            strokeOpacity={0.4} 
                                            strokeDasharray="3 3" // Dashed line
                                            dot={false} // No dots
                                            activeDot={false} // No active dot
                                            connectNulls={true} // Connect across null data points
                                            name="_prevCardio" // Hidden from default tooltip/legend
                                        />
                                    </>
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                 </Card>
             )}

             {/* Weekly Workout List Card (Volume display adjusted) */} 
              {weeklyMetrics && weeklyMetrics.allWorkoutsInWeek.length > 0 && ( 
                 <Card className="mt-6 border border-border/10">
                     <CardHeader>
                         <CardTitle className="text-base font-semibold">Workouts This Week</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <div className="space-y-6">
                             {weeklyMetrics.allWorkoutsInWeek.map(workout => {
                                 if (workout.type === 'running') {
                                     return <RunningWorkoutCard key={workout._id} workout={workout} />;
                                 } else if (workout.type === 'strength') {
                                     return <StrengthWorkoutCard key={workout._id} workout={workout} />;
                                 }
                                 
                                 // For other workout types, use the default card style
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
                                     <Card key={workout._id} 
                                         className="overflow-hidden bg-muted/5 hover:bg-muted/10 transition-all duration-300 border-0 shadow-none"
                                         onClick={() => handleWorkoutClick(workout._id)}
                                     >
                                         <CardHeader className="pb-2">
                                             <div className="flex items-center justify-between">
                                                 <div className="flex items-center gap-2">
                                                     {icon}
                                                     <CardTitle className="text-lg font-medium">{workout.name || 'Unnamed Workout'}</CardTitle>
                                                 </div>
                                                 <span className="text-sm text-muted-foreground">
                                                     {format(parseISO(workout.date.toString()), 'MMM d')}
                                                 </span>
                                             </div>
                                         </CardHeader>
                                         <CardContent className="pb-3">
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
                                             </div>
                                         </CardContent>
                                     </Card>
                                 );
                             })}
                         </div>
                     </CardContent>
                 </Card>
              )}
              {/* No Workouts Message */}
              {weeklyMetrics && weeklyMetrics.totalWorkouts === 0 && ( 
                  <p className="text-muted-foreground text-center py-8 text-sm">No workouts recorded for this week.</p>
              )}

        </div>
    );
}

// Ensure no duplicate function definitions or extraneous tags exist below this line. 