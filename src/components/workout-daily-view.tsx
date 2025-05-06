"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, eachDayOfInterval, isSameDay, subDays, addDays, isAfter } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2, Activity, Dumbbell, Ruler, Clock, Route, Weight, ChevronDown, ChevronUp, Heart, Zap } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData, SetData } from '@/types/db';
import { formatDuration, formatDistance } from '@/lib/utils';
import { MetricContent } from '@/components/ui/metric-card';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
    const workoutsOnDate = allWorkouts.filter(w => w.date && isSameDay(parseISO(w.date.toString()), dayStart));

    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;

    workoutsOnDate.forEach(w => {
        totalDuration += w.duration || 0;
        // Check both direct distance and cardioDetails.distance, convert to kilometers
        const workoutDistance = (w.distance || (w.cardioDetails?.distance) || 0) / 1000;
        totalDistance += workoutDistance;
        if (w.calculatedVolume) totalVolume += w.calculatedVolume;
    });

    return {
        totalDuration,
        totalDistance,
        totalVolume,
        workoutCount: workoutsOnDate.length,
        workouts: workoutsOnDate,
    };
}

const RunningWorkoutCard = ({ workout }: { workout: WorkoutWithExercises }) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Format pace (min/km)
    const formatPace = (duration: number, distance: number) => {
        if (!distance || !duration) return '--:--';
        // Convert distance to kilometers
        const distanceInKm = distance / 1000;
        if (distanceInKm === 0) return '--:--';
        
        const paceInMinutes = duration / 60 / distanceInKm;
        const minutes = Math.floor(paceInMinutes);
        const seconds = Math.round((paceInMinutes - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const distance = (workout.distance || workout.cardioDetails?.distance || 0) / 1000; // Convert to km
    const pace = formatPace(workout.duration || 0, workout.distance || workout.cardioDetails?.distance || 0);
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
                    <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-[#58a3ff]/5">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
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
                        <span className="text-base font-medium mb-1">{distance.toFixed(1)} km</span>
                        <span className="text-xs text-muted-foreground">Distance</span>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-2xl bg-white dark:bg-black border border-[#58a3ff]/[0.08]">
                        <Activity className="h-5 w-5 mb-2 text-[#58a3ff]" />
                        <span className="text-base font-medium mb-1">{pace}</span>
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
                    <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="hover:bg-[#fa9f7b]/5">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
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
                                
                                return (
                                    <div key={exercise._id} className="p-6 rounded-2xl bg-white dark:bg-black border border-[#fa9f7b]/[0.08]">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">{exercise.exerciseId.name}</span>
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
    const [allWorkouts, setAllWorkouts] = useState<WorkoutWithExercises[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [viewCenterDate, setViewCenterDate] = useState<Date>(startOfDay(new Date()));
    const [dailyMetrics, setDailyMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);
    const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());

    // Get today's date for comparison
    const today = startOfDay(new Date());

    // Fetch all workouts on initial load
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const endDate = addDays(new Date(), 7);
                const startDate = subDays(endDate, 90);
                
                // Fetch workouts with exercises and AI insights
                const response = await fetch(`/api/workouts?includeExercises=true&_=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: WorkoutWithExercises[] = await response.json();
                setAllWorkouts(data);
            } catch (err: any) {
                console.error("[WorkoutDailyView] Error fetching initial workouts:", err);
                setError(err.message || "Failed to load initial workout data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Fetch metrics when selectedDate or allWorkouts changes
    useEffect(() => {
        if (!isLoading && allWorkouts.length > 0) {
            const loadMetrics = async () => {
                setIsMetricsLoading(true);
                try {
                    // Calculate metrics from the already fetched 'allWorkouts'
                    const metrics = await getMetricsForDate(selectedDate, allWorkouts);
                    setDailyMetrics(metrics);
                } catch (err) {
                    console.error(`Error getting metrics for ${formatDateKey(selectedDate)}:`, err);
                    // Handle error appropriately, maybe show a message
                    setDailyMetrics(null);
                } finally {
                    setIsMetricsLoading(false);
                }
            };
            loadMetrics();
        } else if (!isLoading && allWorkouts.length === 0) {
             // Handle case where there are no workouts at all after initial load
             setDailyMetrics({ totalDuration: 0, totalDistance: 0, totalVolume: 0, workoutCount: 0, workouts: [] });
             setIsMetricsLoading(false);
        }
    }, [selectedDate, allWorkouts, isLoading]);

    // Generate dates for the horizontal scroller based on the viewCenterDate
    const dateRange = useMemo(() => {
        const start = subDays(viewCenterDate, 7);
        const end = addDays(viewCenterDate, 7);
        return eachDayOfInterval({ start, end });
    }, [viewCenterDate]);

    const handleDateSelect = (date: Date) => {
        setSelectedDate(startOfDay(date));
    };

    const shiftView = (days: number) => {
        setViewCenterDate(prev => addDays(prev, days));
    };

    const toggleWorkoutExpansion = (workoutId: string) => {
        setExpandedWorkouts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(workoutId)) {
                newSet.delete(workoutId);
            } else {
                newSet.add(workoutId);
            }
            return newSet;
        });
    };

    const handleWorkoutClick = (workoutId: string) => {
        router.push(`/workouts/${workoutId}`);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

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
                                const workoutsOnDate = allWorkouts.filter(w => w.date && isSameDay(parseISO(w.date.toString()), date));
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

            {/* Daily Summary Card */}
            {dailyMetrics && dailyMetrics.workoutCount > 0 && (
                <Card className="overflow-hidden border border-border/50 bg-gradient-to-br from-background to-muted/20">
                    <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent pb-4">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
                            {format(selectedDate, 'EEEE, MMMM d')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                                <MetricContent 
                                    title="Workouts" 
                                    value={dailyMetrics.workoutCount.toString()} 
                                    icon={<Activity className="h-4 w-4 text-primary" />}
                                />
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                                <MetricContent 
                                    title="Duration" 
                                    value={formatDuration(dailyMetrics.totalDuration)}
                                    icon={<Clock className="h-4 w-4 text-primary" />}
                                />
                            </div>
                            {dailyMetrics.totalDistance > 0 && (
                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/10">
                                    <MetricContent 
                                        title="Distance" 
                                        value={formatDistance(dailyMetrics.totalDistance)}
                                        icon={<Route className="h-4 w-4 text-blue-500" />}
                                    />
                                </div>
                            )}
                            {dailyMetrics.totalVolume > 0 && (
                                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/10">
                                    <MetricContent 
                                        title="Volume" 
                                        value={`${(dailyMetrics.totalVolume / 1000).toFixed(1)}t`}
                                        icon={<Weight className="h-4 w-4 text-purple-500" />}
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Workouts List */}
            {dailyMetrics?.workouts.map(workout => {
                const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                const isExpanded = expandedWorkouts.has(workout._id);

                return (
                    <div key={workout._id}>
                        {workout.type === 'running' ? (
                            <RunningWorkoutCard workout={workout} />
                        ) : workout.type === 'strength' ? (
                            <StrengthWorkoutCard workout={workout} />
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
                                                        {formatDistance(workout.distance / 1000)}
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

            {dailyMetrics && dailyMetrics.workoutCount === 0 && (
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