"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isBefore, isAfter, startOfDay, getWeekOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { WorkoutData } from '@/types/db';
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// Chart data type
interface WeeklyChartData {
    week: string; // e.g., 'W1', 'W2'
    duration: number; // in minutes
}

// Updated type for aggregated monthly stats
interface MonthlyWorkoutMetrics {
    totalWorkouts: number;
    totalDuration: number;
    totalDistance: number;
    totalVolume: number;
    weeklyChartData: WeeklyChartData[];
    allWorkoutsInMonth: WorkoutData[];
}

// Function to get metrics for a given month
async function getMetricsForMonth(monthStart: Date, monthEnd: Date, allWorkouts: WorkoutData[]): Promise<MonthlyWorkoutMetrics> {
    const monthlyWorkouts = allWorkouts.filter(w => {
        if (!w.date) return false;
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        return !isBefore(workoutDate, monthStart) && !isAfter(workoutDate, monthEnd);
    });

    let totalWorkouts = monthlyWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;
    const weeklyChartDataMap: { [weekNum: number]: { duration: number } } = {};

    monthlyWorkouts.forEach(w => {
        const duration = w.duration || 0;
        totalDuration += duration;
        if (w.distance) totalDistance += w.distance;
        if (w.calculatedVolume) totalVolume += w.calculatedVolume;

        // Group by week number within the month
        const workoutDate = parseISO(w.date.toString());
        // weekStartsOn: 1 for Monday start - adjust if needed
        const weekOfMonth = getWeekOfMonth(workoutDate, { weekStartsOn: 1 }); 
        if (!weeklyChartDataMap[weekOfMonth]) {
            weeklyChartDataMap[weekOfMonth] = { duration: 0 };
        }
        weeklyChartDataMap[weekOfMonth].duration += Math.round(duration / 60); // Add duration in minutes
    });

    // Convert map to array for recharts, sorted by week number
    const weeklyChartData = Object.entries(weeklyChartDataMap)
        .map(([weekNum, data]) => ({ week: `W${weekNum}`, duration: data.duration }))
        .sort((a, b) => parseInt(a.week.substring(1)) - parseInt(b.week.substring(1)));

    return { 
        totalWorkouts, 
        totalDuration, 
        totalDistance, 
        totalVolume, 
        weeklyChartData,
        allWorkoutsInMonth: monthlyWorkouts // Return filtered list
    };
}

export default function WorkoutMonthlyView() {
    const [allWorkouts, setAllWorkouts] = useState<WorkoutData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonthStart, setSelectedMonthStart] = useState<Date>(startOfMonth(new Date()));
    const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyWorkoutMetrics | null>(null);
    const [previousMonthMetrics, setPreviousMonthMetrics] = useState<MonthlyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);

    const selectedMonthEnd = useMemo(() => endOfMonth(selectedMonthStart), [selectedMonthStart]);
    const previousMonthStart = useMemo(() => subMonths(selectedMonthStart, 1), [selectedMonthStart]);
    const previousMonthEnd = useMemo(() => endOfMonth(previousMonthStart), [previousMonthStart]);

    // Fetch initial workouts (fetch a wider range, filter by month later)
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                 // Fetch a very broad range, e.g., a year back and some months forward
                 const endDate = addMonths(new Date(), 3);
                 const startDate = subMonths(endDate, 15);
                
                 const response = await fetch(`/api/workouts?_=${Date.now()}`, { cache: 'no-store' });
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 const data: WorkoutData[] = await response.json();
                 setAllWorkouts(data);
            } catch (err: any) {
                 console.error("[WorkoutMonthlyView] Error fetching initial workouts:", err);
                 setError(err.message || "Failed to load initial workout data.");
            } finally {
                 setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Update metrics calculation effect
    useEffect(() => {
        if (!isLoading && allWorkouts.length >= 0) {
            const loadMetrics = async () => {
                setIsMetricsLoading(true);
                try {
                     // Calculate metrics for current and previous month in parallel
                    const [currentMetrics, prevMetrics] = await Promise.all([
                        getMetricsForMonth(selectedMonthStart, selectedMonthEnd, allWorkouts),
                        getMetricsForMonth(previousMonthStart, previousMonthEnd, allWorkouts)
                    ]);
                    setMonthlyMetrics(currentMetrics);
                    setPreviousMonthMetrics(prevMetrics);
                } catch (err) {
                    setMonthlyMetrics(null);
                    setPreviousMonthMetrics(null);
                } finally {
                    setIsMetricsLoading(false);
                }
            };
            loadMetrics();
        }
        // Add previous month dates to dependency array
    }, [selectedMonthStart, selectedMonthEnd, previousMonthStart, previousMonthEnd, allWorkouts, isLoading]);

    const shiftMonth = (months: number) => {
        setSelectedMonthStart(prev => addMonths(prev, months));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    const monthDisplay = format(selectedMonthStart, 'MMMM yyyy');

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
            {/* Month Navigation */}
            <div className="flex justify-between items-center mb-4">
                <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">{monthDisplay}</h2>
                <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Monthly Summary Stats - Pass change prop */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Monthly Totals</CardTitle>
                </CardHeader>
                <CardContent>
                    {isMetricsLoading ? (
                        <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : monthlyMetrics ? (
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                            <MetricCard 
                                title="Workouts" 
                                value={monthlyMetrics.totalWorkouts.toString()} 
                                change={calculatePercentageChange(monthlyMetrics.totalWorkouts, previousMonthMetrics?.totalWorkouts)}
                            />
                            <MetricCard 
                                title="Total Duration" 
                                value={formatDuration(monthlyMetrics.totalDuration)} 
                                change={calculatePercentageChange(monthlyMetrics.totalDuration, previousMonthMetrics?.totalDuration)}
                            />
                            <MetricCard 
                                title="Total Distance" 
                                value={formatDistance(monthlyMetrics.totalDistance)} 
                                change={monthlyMetrics.totalDistance > 0 ? calculatePercentageChange(monthlyMetrics.totalDistance, previousMonthMetrics?.totalDistance) : null}
                            />
                            <MetricCard 
                                title="Total Volume" 
                                value={`${monthlyMetrics.totalVolume.toLocaleString()} kg`} 
                                change={monthlyMetrics.totalVolume > 0 ? calculatePercentageChange(monthlyMetrics.totalVolume, previousMonthMetrics?.totalVolume) : null}
                            />
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No data available for this month.</p>
                    )}
                </CardContent>
            </Card>
            
            {/* Monthly Chart */}
             {monthlyMetrics && monthlyMetrics.totalWorkouts > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Weekly Duration (Minutes)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200} minHeight={150}>
                            <BarChart data={monthlyMetrics.weeklyChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="week" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} unit="m"/>
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                <Bar dataKey="duration" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                 </Card>
             )}

             {/* Monthly Workout List */}
              {monthlyMetrics && monthlyMetrics.allWorkoutsInMonth.length > 0 && (
                 <Card>
                     <CardHeader>
                         <CardTitle className="text-base font-semibold">Workouts This Month</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <ul className="space-y-3">
                             {monthlyMetrics.allWorkoutsInMonth.map(workout => {
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
                                     <li key={workout._id} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-3 border rounded-md hover:bg-muted/50 transition-colors">
                                         <Badge variant="outline" className={`row-span-2 flex items-center self-start mt-1 px-2 py-0.5 ${colorClasses}`}>
                                             {icon}
                                             <span className="ml-1.5">{workout.type}</span>
                                         </Badge>
                                         <p className="font-semibold text-sm col-start-2">{workout.name || 'Unnamed Workout'} <span className="text-xs text-muted-foreground ml-1">({format(parseISO(workout.date.toString()), 'MMM d')})</span></p>
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
              {monthlyMetrics && monthlyMetrics.totalWorkouts === 0 && (
                  <p className="text-muted-foreground text-center py-4">No workouts recorded for this month.</p>
              )}

        </div>
    );
} 