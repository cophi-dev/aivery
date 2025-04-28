"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, eachDayOfInterval, isSameDay, subDays, addDays, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2, Activity, Dumbbell, Ruler, Clock, Route, Weight } from 'lucide-react';
import type { WorkoutData } from '@/types/db'; // Assuming WorkoutData type exists
// import { getWorkoutsByDateRange } from '@/lib/workout-actions'; // Assuming an action exists/will exist

// Import helpers from utils and the new MetricCard location
import { formatDuration, formatDistance } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
// Import getWorkoutTypeStyle from its new location (no extension)
import { getWorkoutTypeStyle } from '@/lib/workout-utils';

// Helper to format date for display and API calls
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

interface DailyWorkoutMetrics {
  totalDuration: number;
  totalDistance: number; // Assuming distance might be relevant
  totalVolume: number; // Assuming volume might be relevant
  workoutCount: number;
  workouts: WorkoutData[];
}

// Function to get metrics for date
async function getMetricsForDate(date: Date, allWorkouts: WorkoutData[]): Promise<DailyWorkoutMetrics> {
    const dayStart = startOfDay(date);
    const workoutsOnDate = allWorkouts.filter(w => w.date && isSameDay(parseISO(w.date.toString()), dayStart));

    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;

    workoutsOnDate.forEach(w => {
        totalDuration += w.duration || 0;
        // Add distance/volume calculation if applicable based on workout type
        if (w.distance) totalDistance += w.distance;
        if (w.calculatedVolume) totalVolume += w.calculatedVolume;
    });

    return {
        totalDuration,
        totalDistance,
        totalVolume,
        workoutCount: workoutsOnDate.length,
        workouts: workoutsOnDate, // Return the actual workouts for potential display
    };
}


export default function WorkoutDailyView() {
    const [allWorkouts, setAllWorkouts] = useState<WorkoutData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [viewCenterDate, setViewCenterDate] = useState<Date>(startOfDay(new Date())); // For controlling the date scroller view
    const [dailyMetrics, setDailyMetrics] = useState<DailyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);

    // Get today's date for comparison
    const today = startOfDay(new Date()); 

    // Fetch all workouts on initial load (adjust range as needed)
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch workouts for a reasonable initial range, e.g., last 90 days
                // This might need adjustment based on performance and typical usage
                 const endDate = addDays(new Date(), 7); // Fetch slightly into future
                 const startDate = subDays(endDate, 90); // Fetch last 90 days
                
                 console.log(`[WorkoutDailyView] Fetching initial workouts from ${formatDateKey(startDate)} to ${formatDateKey(endDate)}`);

                // TODO: Replace with actual API call if needed, or use existing fetch logic if possible
                 // For now, simulate fetching from `/api/workouts`
                 const response = await fetch(`/api/workouts?_=${Date.now()}`, { cache: 'no-store' });
                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }
                 const data: WorkoutData[] = await response.json();
                 console.log(`[WorkoutDailyView] Fetched ${data.length} workouts.`);
                 setAllWorkouts(data);

                // TODO: Implement actual fetchWorkoutsByDateRange if needed, or adjust API call
                // const fetchedWorkouts = await getWorkoutsByDateRange(startDate, endDate); // Use correct function name
                // setAllWorkouts(fetchedWorkouts);

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
        const start = subDays(viewCenterDate, 7); // Show 15 days (7 before)
        const end = addDays(viewCenterDate, 7);   // (7 after)
        return eachDayOfInterval({ start, end });
    }, [viewCenterDate]);

    const handleDateSelect = (date: Date) => {
        setSelectedDate(startOfDay(date));
    };

    const shiftView = (days: number) => {
        setViewCenterDate(prev => addDays(prev, days));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    return (
        <div className="space-y-6">
            {/* Simplified Horizontal Date Scroller - Removed Card Wrapper */}
            <div className="flex items-center space-x-2">
                {/* Previous Week Button */}
                <Button variant="ghost" size="icon" onClick={() => shiftView(-7)} aria-label="Previous week">
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* Scrollable Date Area */}
                <ScrollArea className="flex-grow w-full whitespace-nowrap rounded-md border">
                    {/* Centered date buttons */}
                    <div className="flex justify-center space-x-2 p-2">
                        {dateRange.map(date => {
                            const dateStr = formatDateKey(date);
                            const isSelected = isSameDay(date, selectedDate);
                            const isFuture = isAfter(date, today);
                            const hasWorkout = allWorkouts.some(w => w.date && isSameDay(parseISO(w.date.toString()), date));

                            // DEBUG LOG:
                            // console.log(`Date: ${format(date, 'yyyy-MM-dd')}, Today: ${format(today, 'yyyy-MM-dd')}, isFuture: ${isFuture}`);

                            return (
                                <Button
                                    key={dateStr}
                                    variant={isSelected ? "default" : "outline"}
                                    className={`flex flex-col items-center justify-center h-18 w-18 rounded-full p-2 transition-colors ${isSelected ? '' : 'border-transparent hover:bg-accent hover:text-accent-foreground'} ${hasWorkout && !isSelected ? 'border border-green-500' : ''} ${isFuture ? 'text-muted-foreground/70' : ''}`}
                                    onClick={() => handleDateSelect(date)}
                                >
                                    <span className="text-xs font-semibold">{format(date, 'eee')}</span>
                                    <span className="text-lg font-bold">{format(date, 'd')}</span>
                                    <span className="text-xs">{format(date, 'MMM')}</span>
                                    {hasWorkout && !isFuture && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500"></div>}
                                </Button>
                            );
                        })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Next Week Button */}
                 <Button variant="ghost" size="icon" onClick={() => shiftView(7)} aria-label="Next week">
                     <ChevronRight className="h-5 w-5" />
                 </Button>
            </div>

            {/* Daily Metrics Display */}
            <Card>
                 <CardHeader>
                    <CardTitle className="text-lg font-semibold">Metrics for {format(selectedDate, 'PPP')} {/* 'PPP' format: Oct 26, 2023 */}</CardTitle>
                </CardHeader>
                <CardContent>
                    {isMetricsLoading ? (
                         <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : dailyMetrics ? (
                        // DEBUG LOG:
                        // (() => { console.log("Daily Metrics:", dailyMetrics); return null; })(), 
                        <div className="space-y-4"> {/* Changed grid to space-y */}
                             {/* Aggregate Metrics Row */}
                             <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                                 <MetricCard title="Workouts" value={dailyMetrics.workoutCount.toString()} />
                                 <MetricCard title="Total Duration" value={formatDuration(dailyMetrics.totalDuration)} />
                                 {dailyMetrics.totalDistance > 0 && <MetricCard title="Total Distance" value={formatDistance(dailyMetrics.totalDistance / 1000)} />}
                                 {dailyMetrics.totalVolume > 0 && <MetricCard title="Total Volume" value={`${dailyMetrics.totalVolume.toLocaleString()} kg`} />}
                             </div>

                             {/* List of Workouts for the Day */}
                             {dailyMetrics.workouts.length > 0 && (
                                 <div className="mt-4 border-t pt-4">
                                     <h3 className="text-lg font-semibold mb-3">Workouts on this day:</h3>
                                     <ul className="space-y-2"> {/* Reduced space slightly */} 
                                         {dailyMetrics.workouts.map(workout => {
                                             const { icon, colorClasses } = getWorkoutTypeStyle(workout.type); // Uses imported helper
                                             return (
                                                 // Updated styling: Subtle background, padding, grid layout, icons
                                                 <li key={workout._id} 
                                                     className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/30"
                                                 >
                                                     {/* Badge (Column 1, Row 1 & 2) */}
                                                     <Badge variant="outline" className={`row-span-2 flex items-center self-center mt-1 px-2 py-0.5 ${colorClasses}`}>
                                                         {icon}
                                                         <span className="ml-1.5 text-xs">{workout.type}</span>
                                                     </Badge>
                                                     
                                                     {/* Workout Name & Date (Column 2, Row 1) */}
                                                     <div className="col-start-2 row-start-1 flex justify-between items-center">
                                                         <p className="font-semibold text-sm truncate pr-2">{workout.name || 'Unnamed Workout'}</p>
                                                         {/* Date is already implied by the view, so no need to show it here */}
                                                     </div>
                                                     
                                                     {/* Metrics (Column 2, Row 2) */}
                                                     <div className="col-start-2 row-start-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                                         <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {formatDuration(workout.duration || 0)}</span>
                                                         {workout.distance != null && workout.distance > 0 && <span className="flex items-center"><Route className="h-3 w-3 mr-1" /> {formatDistance(workout.distance / 1000)}</span>}
                                                         {workout.calculatedVolume != null && workout.calculatedVolume > 0 && <span className="flex items-center"><Weight className="h-3 w-3 mr-1" /> {workout.calculatedVolume.toLocaleString()} kg</span>}
                                                     </div>
                                                 </li>
                                             );
                                         })}
                                     </ul>
                                 </div>
                             )}
                             {dailyMetrics.workoutCount === 0 && (
                                  <p className="text-muted-foreground mt-4 text-center py-4">No workouts recorded for this day.</p>
                             )}
                        </div>
                    ) : (
                        // This case might not be hit if we initialize metrics for empty days
                        <p className="text-muted-foreground">No workout data available for this date.</p> 
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 