"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, startOfDay, isBefore, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, Route, Weight } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData } from '@/types/db';

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line } from 'recharts';

// Import helpers from utils and the new MetricCard location
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
// Import getWorkoutTypeStyle for the list
import { getWorkoutTypeStyle } from '@/lib/workout-utils';

const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// Define workout categories (adjust as needed)
const CARDIO_TYPES = ['running', 'run', 'cycling', 'bike', 'ride', 'swimming', 'swim'];
const STRENGTH_TYPES = ['strength', 'workout'];

// Updated Chart data type
interface DailyChartData {
    day: string; // e.g., 'Mon'
    cardioDuration: number; // minutes
    strengthDuration: number; // minutes
    cardioDistance: number; // km
    strengthVolume: number; // kg
}

// Updated type for aggregated weekly stats
interface WeeklyWorkoutMetrics {
    totalWorkouts: number;
    totalDuration: number;
    totalDistance: number;
    totalVolume: number;
    workoutsByDay: { [day: string]: WorkoutData[] };
    dailyChartData: DailyChartData[];
    allWorkoutsInWeek: WorkoutData[];
}

// Updated function to get metrics for a given week
async function getMetricsForWeek(weekStart: Date, weekEnd: Date, weeklyWorkouts: WorkoutData[]): Promise<WeeklyWorkoutMetrics> {
    // console.log(`Calculating metrics for week: ${formatDateKey(weekStart)} to ${formatDateKey(weekEnd)}`);
    let totalWorkouts = weeklyWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;
    const workoutsByDay: { [day: string]: WorkoutData[] } = {};
    // Initialize map to hold daily aggregates
    const dailyChartDataMap: { [day: string]: Omit<DailyChartData, 'day'> } = {};

    // Initialize days of the week
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    daysInWeek.forEach(day => {
        const dayKey = formatDateKey(day);
        const dayName = format(day, 'eee');
        workoutsByDay[dayKey] = [];
        // Initialize daily aggregates
        dailyChartDataMap[dayName] = {
            cardioDuration: 0,
            strengthDuration: 0,
            cardioDistance: 0,
            strengthVolume: 0,
        };
    });

    weeklyWorkouts.forEach(w => {
        const duration = w.duration || 0;
        const workoutDistance = w.cardioDetails?.distance ?? w.distance ?? 0;
        const volume = w.calculatedVolume || 0;
        const typeLower = w.type?.toLowerCase() || 'other';

        // DEBUG LOGGING for distance:
        if (CARDIO_TYPES.includes(typeLower)) {
            console.log(`[DEBUG] Cardio Workout (${w._id}, Type: ${w.type}): `,
                        `w.distance = ${w.distance}, `,
                        `w.cardioDetails?.distance = ${w.cardioDetails?.distance}, `,
                        `Calculated distance (m?) = ${workoutDistance}`);
        }

        totalDuration += duration;
        totalDistance += workoutDistance;
        totalVolume += volume;
        
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        const dayKey = formatDateKey(workoutDate);
        const dayName = format(workoutDate, 'eee');
        
        if (workoutsByDay[dayKey]) {
            workoutsByDay[dayKey].push(w);
        }

        // Aggregate metrics based on type for the chart map
        if (dailyChartDataMap[dayName]) {
            const durationMinutes = Math.round(duration / 60);
            if (CARDIO_TYPES.includes(typeLower)) {
                dailyChartDataMap[dayName].cardioDuration += durationMinutes;
                dailyChartDataMap[dayName].cardioDistance += (workoutDistance / 1000); // Convert m to km before summing
            } else if (STRENGTH_TYPES.includes(typeLower)) {
                dailyChartDataMap[dayName].strengthDuration += durationMinutes;
                dailyChartDataMap[dayName].strengthVolume += volume; // Accumulate volume
            } else {
                // Handle 'other' types if needed - maybe add to a general duration?
            }
        }
    });

    // Convert map to array for recharts
    const dailyChartData = Object.entries(dailyChartDataMap).map(([day, data]) => ({
        day,
        ...data,
        // Round the already-KM distance to 2 decimal places
        cardioDistance: Math.round(data.cardioDistance * 100) / 100, 
    }));

    // Log the daily chart data before returning
    console.log(`[DEBUG] dailyChartData before return:`, dailyChartData);

    // Create the result object *before* logging
    const result: WeeklyWorkoutMetrics = { 
        totalWorkouts, 
        totalDuration, 
        // totalDistance should now be correctly summed KM
        totalDistance: weeklyWorkouts.reduce((sum, w) => {
            const dist = w.cardioDetails?.distance ?? w.distance ?? 0;
            return CARDIO_TYPES.includes(w.type?.toLowerCase() || 'other') ? sum + (dist / 1000) : sum;
        }, 0), 
        totalVolume, 
        workoutsByDay, 
        dailyChartData,
        allWorkoutsInWeek: weeklyWorkouts 
    };

    // Log the distance *from the result object*
    console.log(`[DEBUG] Final totalDistance in RETURN OBJECT: ${result.totalDistance}`);

    return result; // Return the pre-constructed object
}

export default function WorkoutWeeklyView() {
    const router = useRouter();
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
                    
                    // Pass pre-filtered arrays to getMetricsForWeek
                    const [currentMetrics, prevMetrics] = await Promise.all([
                        getMetricsForWeek(selectedWeekStart, currentWeekEnd, currentWorkoutsInWeek),
                        getMetricsForWeek(prevWeekStart, prevWeekEnd, previousWorkoutsInWeek) 
                    ]);

                    if (isMounted) {
                        const currentMetricsClone = { ...currentMetrics };
                        const prevMetricsClone = { ...prevMetrics };
                        setWeeklyMetrics(currentMetricsClone);
                        setPreviousWeekMetrics(prevMetricsClone);
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
    }, [selectedWeekStart, allWorkouts, isLoading]); // Keep simplified dependencies

    const shiftWeek = (weeks: number) => {
        setSelectedWeekStart(prev => addWeeks(prev, weeks));
    };

    const handleWorkoutClick = useCallback((workoutId: string) => {
        router.push(`/workouts/${workoutId}`);
    }, [router]);

    if (isLoading || isMetricsLoading) { // Check both loading states
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    // ---> RE-ADD LOG <--- 
    console.log("[DEBUG] weeklyMetrics state just before render return:", weeklyMetrics);
    if (weeklyMetrics) {
      console.log("[DEBUG] dailyChartData in state just before render return:", weeklyMetrics.dailyChartData);
    }

    const weekDisplay = `${format(selectedWeekStart, 'MMM d')} - ${format(selectedWeekEnd, 'MMM d, yyyy')}`;

    // Updated Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload; // The data point for the hovered item
            return (
            <div className="bg-background/90 backdrop-blur-sm border p-3 rounded shadow-lg text-xs">
                <p className="label font-semibold mb-1">{`${label}`}</p>
                {data.cardioDuration > 0 && <p style={{ color: '#8884d8' }}>Cardio Time: {data.cardioDuration} min</p>}
                {data.strengthDuration > 0 && <p style={{ color: '#82ca9d' }}>Strength Time: {data.strengthDuration} min</p>}
                {data.cardioDistance > 0 && <p style={{ color: '#ff7300' }}>Cardio Dist: {data.cardioDistance.toFixed(1)} km</p>}
                {data.strengthVolume > 0 && <p style={{ color: '#ffc658' }}>Strength Vol: {data.strengthVolume.toLocaleString()} kg</p>}
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
                    {!weeklyMetrics ? ( 
                        <p className="text-muted-foreground">No data available for this week.</p>
                    ) : (
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
                                value={weeklyMetrics 
                                        ? (weeklyMetrics.totalDistance > 0 && weeklyMetrics.totalDistance < 0.1 
                                            ? `${weeklyMetrics.totalDistance.toFixed(2)} km` 
                                            : formatDistance(weeklyMetrics.totalDistance))
                                        : "-- km"}
                                change={weeklyMetrics && weeklyMetrics.totalDistance > 0 ? calculatePercentageChange(weeklyMetrics.totalDistance, previousWeekMetrics?.totalDistance) : null}
                            />

                            <MetricCard 
                                title="Total Volume" 
                                value={`${weeklyMetrics.totalVolume.toLocaleString()} kg`} 
                                change={weeklyMetrics.totalVolume > 0 ? calculatePercentageChange(weeklyMetrics.totalVolume, previousWeekMetrics?.totalVolume) : null} 
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {/* Updated Weekly Chart - Composed */}
             {weeklyMetrics && weeklyMetrics.totalWorkouts > 0 && ( 
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Daily Activity Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250} minHeight={200}>
                            <ComposedChart data={weeklyMetrics.dailyChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> 
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                                {/* Left Y Axis (Time - minutes) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={false} 
                                    unit="m" 
                                />
                                {/* Right Y Axis (Distance/Volume) */}
                                <YAxis 
                                    yAxisId="right" 
                                    orientation="right" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={false} 
                                    width={40} // Give it some space
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                
                                {/* Stacked Bars for Duration (Left Axis) */}
                                <Bar dataKey="cardioDuration" stackId="a" fill="#8884d8" radius={[4, 4, 0, 0]} yAxisId="left" name="Cardio Time" />
                                <Bar dataKey="strengthDuration" stackId="a" fill="#82ca9d" radius={[4, 4, 0, 0]} yAxisId="left" name="Strength Time" />
                                
                                {/* Lines for Distance/Volume (Right Axis) */}
                                <Line type="monotone" dataKey="cardioDistance" stroke="#ff7300" strokeWidth={2} yAxisId="right" name="Cardio Distance (km)" dot={false} />
                                <Line type="monotone" dataKey="strengthVolume" stroke="#ffc658" strokeWidth={2} yAxisId="right" name="Strength Volume (kg)" dot={false} />
                            </ComposedChart>
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
                         <ul className="space-y-2">
                             {weeklyMetrics.allWorkoutsInWeek.map(workout => { 
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
                                     <li key={workout._id} 
                                        onClick={() => handleWorkoutClick(workout._id)}
                                        className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/30 cursor-pointer"
                                     >
                                        {/* Badge (Column 1, Row 1 & 2) */}
                                        <Badge variant="outline" className={`row-span-2 flex items-center self-center mt-1 px-2 py-0.5 ${colorClasses}`}>
                                            {icon}
                                            <span className="ml-1.5 text-xs">{workout.type}</span>
                                        </Badge>

                                        {/* Workout Name & Date (Column 2, Row 1) */}
                                        <div className="col-start-2 row-start-1 flex justify-between items-center">
                                            <p className="font-semibold text-sm truncate pr-2">{workout.name || 'Unnamed Workout'}</p>
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{format(parseISO(workout.date.toString()), 'EEE, MMM d')}</span>
                                        </div>
                                        
                                        {/* Metrics (Column 2, Row 2) */}
                                        <div className="col-start-2 row-start-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {formatDuration(workout.duration || 0)}</span>
                                            {/* Conditionally format distance based on likely unit (KM for old data < 100, METERS for new data >= 100) */}
                                            {workout.distance != null && workout.distance > 0 && 
                                              <span className="flex items-center">
                                                <Route className="h-3 w-3 mr-1" /> 
                                                {formatDistance(workout.distance < 100 ? workout.distance : workout.distance / 1000)}
                                              </span>
                                            }
                                            {workout.calculatedVolume != null && workout.calculatedVolume > 0 && <span className="flex items-center"><Weight className="h-3 w-3 mr-1" /> {workout.calculatedVolume.toLocaleString()} kg</span>}
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