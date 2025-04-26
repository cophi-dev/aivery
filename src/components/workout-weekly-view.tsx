"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, startOfDay, isBefore, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { WorkoutData } from '@/types/db';

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Import helpers from utils and the new MetricCard location
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
// Import getWorkoutTypeStyle for the list
import { getWorkoutTypeStyle } from '@/lib/workout-utils';

const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// Chart data type
interface DailyChartData {
    day: string; // e.g., 'Mon', 'Tue'
    duration: number; // in minutes for easier scale
}

// Updated type for aggregated weekly stats
interface WeeklyWorkoutMetrics {
    totalWorkouts: number;
    totalDuration: number;
    totalDistance: number;
    totalVolume: number;
    workoutsByDay: { [day: string]: WorkoutData[] };
    dailyChartData: DailyChartData[];
    allWorkoutsInWeek: WorkoutData[]; // Added list of all workouts
}

// Updated function to get metrics for a given week
async function getMetricsForWeek(weekStart: Date, weekEnd: Date, allWorkouts: WorkoutData[]): Promise<WeeklyWorkoutMetrics> {
    const weeklyWorkouts = allWorkouts.filter(w => {
        if (!w.date) return false;
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        return !isBefore(workoutDate, weekStart) && !isAfter(workoutDate, weekEnd);
    });

    let totalWorkouts = weeklyWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;
    const workoutsByDay: { [day: string]: WorkoutData[] } = {};
    const dailyChartDataMap: { [day: string]: { duration: number } } = {};

    // Initialize days of the week
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    daysInWeek.forEach(day => {
        const dayKey = formatDateKey(day);
        const dayName = format(day, 'eee');
        workoutsByDay[dayKey] = [];
        dailyChartDataMap[dayName] = { duration: 0 };
    });

    weeklyWorkouts.forEach(w => {
        const duration = w.duration || 0;
        totalDuration += duration;
        if (w.distance) totalDistance += w.distance;
        if (w.calculatedVolume) totalVolume += w.calculatedVolume;
        
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        const dayKey = formatDateKey(workoutDate);
        const dayName = format(workoutDate, 'eee');
        
        if (workoutsByDay[dayKey]) {
            workoutsByDay[dayKey].push(w);
        }
        if (dailyChartDataMap[dayName]) {
            dailyChartDataMap[dayName].duration += Math.round(duration / 60); // Add duration in minutes
        }
    });

    // Convert map to array for recharts
    const dailyChartData = Object.entries(dailyChartDataMap).map(([day, data]) => ({ day, duration: data.duration }));

    return { 
        totalWorkouts, 
        totalDuration, 
        totalDistance, 
        totalVolume, 
        workoutsByDay, 
        dailyChartData,
        allWorkoutsInWeek: weeklyWorkouts // Return the filtered list
    };
}

export default function WorkoutWeeklyView() {
    const [allWorkouts, setAllWorkouts] = useState<WorkoutData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyWorkoutMetrics | null>(null);
    const [previousWeekMetrics, setPreviousWeekMetrics] = useState<WeeklyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);

    const selectedWeekEnd = useMemo(() => endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), [selectedWeekStart]);
    const previousWeekStart = useMemo(() => subWeeks(selectedWeekStart, 1), [selectedWeekStart]);
    const previousWeekEnd = useMemo(() => endOfWeek(previousWeekStart, { weekStartsOn: 1 }), [previousWeekStart]);

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
            const loadMetrics = async () => {
                setIsMetricsLoading(true);
                try {
                    const [currentMetrics, prevMetrics] = await Promise.all([
                        getMetricsForWeek(selectedWeekStart, selectedWeekEnd, allWorkouts),
                        getMetricsForWeek(previousWeekStart, previousWeekEnd, allWorkouts) 
                    ]);
                    setWeeklyMetrics(currentMetrics);
                    setPreviousWeekMetrics(prevMetrics);
                } catch (err) {
                    setWeeklyMetrics(null);
                    setPreviousWeekMetrics(null);
                } finally {
                    setIsMetricsLoading(false);
                }
            };
            loadMetrics();
        }
    }, [selectedWeekStart, selectedWeekEnd, previousWeekStart, previousWeekEnd, allWorkouts, isLoading]);

    const shiftWeek = (weeks: number) => {
        setSelectedWeekStart(prev => addWeeks(prev, weeks));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    const weekDisplay = `${format(selectedWeekStart, 'MMM d')} - ${format(selectedWeekEnd, 'MMM d, yyyy')}`;

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
            <div className="bg-background border p-2 rounded shadow-lg">
                <p className="label font-semibold">{`${label}`}</p>
                <p className="intro text-sm">{`Duration: ${payload[0].value} min`}</p>
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

            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Weekly Totals</CardTitle>
                </CardHeader>
                <CardContent>
                    {isMetricsLoading ? (
                        <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : weeklyMetrics ? (
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                            <MetricCard 
                                title="Workouts" 
                                value={weeklyMetrics.totalWorkouts.toString()} 
                                change={calculatePercentageChange(weeklyMetrics.totalWorkouts, previousWeekMetrics?.totalWorkouts)} 
                            />
                            <MetricCard 
                                title="Total Duration" 
                                value={formatDuration(weeklyMetrics.totalDuration)} 
                                change={calculatePercentageChange(weeklyMetrics.totalDuration, previousWeekMetrics?.totalDuration)}
                            />
                            <MetricCard 
                                title="Total Distance" 
                                value={formatDistance(weeklyMetrics.totalDistance)} 
                                change={weeklyMetrics.totalDistance > 0 ? calculatePercentageChange(weeklyMetrics.totalDistance, previousWeekMetrics?.totalDistance) : null} 
                            />
                            <MetricCard 
                                title="Total Volume" 
                                value={`${weeklyMetrics.totalVolume.toLocaleString()} kg`} 
                                change={weeklyMetrics.totalVolume > 0 ? calculatePercentageChange(weeklyMetrics.totalVolume, previousWeekMetrics?.totalVolume) : null} 
                            />
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No data available for this week.</p>
                    )}
                </CardContent>
            </Card>
            
            {/* Weekly Chart */}
             {weeklyMetrics && weeklyMetrics.totalWorkouts > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Daily Duration (Minutes)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200} minHeight={150}>
                            <BarChart data={weeklyMetrics.dailyChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} unit="m"/>
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                <Bar dataKey="duration" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                 </Card>
             )}

             {/* Weekly Workout List */}
              {weeklyMetrics && weeklyMetrics.allWorkoutsInWeek.length > 0 && (
                 <Card>
                     <CardHeader>
                         <CardTitle className="text-base font-semibold">Workouts This Week</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <ul className="space-y-3">
                             {weeklyMetrics.allWorkoutsInWeek.map(workout => {
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
                                     <li key={workout._id} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-3 border rounded-md hover:bg-muted/50 transition-colors">
                                         <Badge variant="outline" className={`row-span-2 flex items-center self-start mt-1 px-2 py-0.5 ${colorClasses}`}>
                                             {icon}
                                             <span className="ml-1.5">{workout.type}</span>
                                         </Badge>
                                         <p className="font-semibold text-sm col-start-2">{workout.name || 'Unnamed Workout'} <span className="text-xs text-muted-foreground ml-1">({format(parseISO(workout.date.toString()), 'EEE, MMM d')})</span></p>
                                         <div className="col-start-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                             <span>Duration: {formatDuration(workout.duration || 0)}</span>
                                             {workout.distance != null && workout.distance > 0 && <span>Distance: {formatDistance(workout.distance)}</span>}
                                             {workout.calculatedVolume != null && workout.calculatedVolume > 0 && <span>Volume: {workout.calculatedVolume.toLocaleString()} kg</span>}
                                         </div>
                                     </li>
                                 );
                             })}
                         </ul>
                     </CardContent>
                 </Card>
              )}
              {weeklyMetrics && weeklyMetrics.totalWorkouts === 0 && (
                  <p className="text-muted-foreground text-center py-4">No workouts recorded for this week.</p>
              )}

        </div>
    );
}

// Ensure no duplicate function definitions or extraneous tags exist below this line. 