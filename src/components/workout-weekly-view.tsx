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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, LabelList } from 'recharts';

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
    let totalDistanceKm = 0; // Renamed to clarify unit, initialize to 0
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

    // NEW: Initialize total durations map
    const dailyDurationMap: { [day: string]: { cardio: number, strength: number } } = {};
    daysInWeek.forEach(day => {
        dailyDurationMap[format(day, 'eee')] = { cardio: 0, strength: 0 };
    });
    // END NEW

    weeklyWorkouts.forEach(w => {
        const duration = w.duration || 0;
        // Use w.distance consistently, assuming it's stored in meters
        const workoutDistanceMeters = w.distance ?? 0; 
        const volume = w.calculatedVolume || 0;
        const typeLower = w.type?.toLowerCase() || 'other';

        // Add duration and volume
        totalDuration += duration;
        totalVolume += volume;
        
        // Add distance in KM only if it's a cardio type
        if (CARDIO_TYPES.includes(typeLower)) {
             const distanceKm = workoutDistanceMeters / 1000;
             totalDistanceKm += distanceKm;

             // DEBUG LOGGING for distance:
             console.log(`[DEBUG] Cardio Workout (${w._id}, Type: ${w.type}): ` +
                         `w.distance = ${w.distance}, ` +
                         `w.cardioDetails?.distance = ${w.cardioDetails?.distance}, ` +
                         `Calculated distance (m) = ${workoutDistanceMeters}, Added distance (km) = ${distanceKm}`);
        }
        
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
                dailyChartDataMap[dayName].cardioDistance += (workoutDistanceMeters / 1000); 
                dailyDurationMap[dayName].cardio += durationMinutes; // Add to duration map
            } else if (STRENGTH_TYPES.includes(typeLower)) {
                dailyChartDataMap[dayName].strengthDuration += durationMinutes;
                dailyChartDataMap[dayName].strengthVolume += volume; // Accumulate volume
                dailyDurationMap[dayName].strength += durationMinutes; // Add to duration map
            } else {
                // Handle 'other' types if needed - maybe add to a general duration?
            }
        }
    });

    // Convert map to array for recharts
    const dailyChartData = Object.entries(dailyChartDataMap).map(([day, data]) => ({
        day,
        ...data,
        // Add combined durations from the new map for labeling
        cardioDurationLabel: dailyDurationMap[day].cardio,
        strengthDurationLabel: dailyDurationMap[day].strength,
        // Round the already-KM distance to 2 decimal places
        cardioDistance: Math.round(data.cardioDistance * 100) / 100, 
    }));

    // Log the daily chart data before returning
    console.log(`[DEBUG] dailyChartData before return:`, dailyChartData);

    // Create the result object *before* logging
    const result: WeeklyWorkoutMetrics = { 
        totalWorkouts, 
        totalDuration, 
        // Use the correctly summed distance in KM from the loop
        totalDistance: totalDistanceKm, 
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
            // Access the original data point for durations
            const dataPoint = payload[0].payload; 
            const strengthDuration = dataPoint.strengthDuration; // Use actual duration
            const cardioDuration = dataPoint.cardioDuration; // Use actual duration

            // Find line data (volume and distance)
            const strengthVolumeData = payload.find((p: any) => p.dataKey === 'strengthVolume');
            const cardioDistanceData = payload.find((p: any) => p.dataKey === 'cardioDistance');

            // Find bar data for colors (optional, could use fixed colors too)
            const strengthBarData = payload.find((p: any) => p.dataKey === 'strengthDuration');
            const cardioBarData = payload.find((p: any) => p.dataKey === 'cardioDuration');

            return (
                <div className="bg-background border border-border shadow-lg rounded-md p-3 text-sm">
                    <p className="font-semibold mb-2">{label}</p>
                    {strengthVolumeData && strengthVolumeData.value > 0 && <p style={{ color: strengthVolumeData.stroke }}>{`Volume: ${strengthVolumeData.value.toLocaleString()} kg`}</p>}
                    {cardioDistanceData && cardioDistanceData.value > 0 && <p style={{ color: cardioDistanceData.stroke }}>{`Distance: ${cardioDistanceData.value.toFixed(1)} km`}</p>}
                    {strengthDuration > 0 && <p style={{ color: strengthBarData?.fill ?? 'var(--color-strength)' }}>{`Strength: ${strengthDuration} min`}</p>}
                    {cardioDuration > 0 && <p style={{ color: cardioBarData?.fill ?? 'var(--color-cardio)' }}>{`Cardio: ${cardioDuration} min`}</p>}
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
                            <ComposedChart data={weeklyMetrics.dailyChartData} margin={{ top: 5, right: 5, left: 20, bottom: 5 }}> 
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                                {/* Left Y Axis (Volume - kg) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={false} 
                                    unit="kg" 
                                    width={60} // Adjusted width
                                />
                                {/* Right Y Axis (Distance - km) */}
                                <YAxis 
                                    yAxisId="right" 
                                    orientation="right" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true} 
                                    tickFormatter={(value) => value.toFixed(1)} 
                                    unit="km" 
                                    width={40} 
                                    domain={[0, 'auto']} // Keep domain starting at 0
                                />
                                {/* Hidden Y Axis for Duration Scaling */}
                                <YAxis yAxisId="durationAxis" hide={true} />

                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                
                                {/* Strength Duration Bar - Stacked, tied to hidden duration axis */}
                                <Bar 
                                    dataKey="strengthDuration" 
                                    yAxisId="durationAxis" // Use hidden axis
                                    fill="#58a3ff" // Brand blue for Strength
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                >
                                    {/* Removed LabelList */}
                                </Bar>
                                
                                {/* Cardio Duration Bar - Stacked, tied to hidden duration axis */}
                                <Bar 
                                    dataKey="cardioDuration" 
                                    yAxisId="durationAxis" // Use hidden axis
                                    fill="#fa9f7b" // Brand orange for Cardio
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                >
                                     {/* Removed LabelList */}
                                </Bar>
                                
                                {/* Strength Volume Line (Left Axis) - Revert color */}
                                <Line 
                                    type="monotone" 
                                    dataKey="strengthVolume" 
                                    stroke="#58a3ff" // Brand blue for Volume
                                    strokeWidth={2} 
                                    yAxisId="left" // Tied to left axis (Volume)
                                    dot={false} 
                                    name="Volume" 
                                />
                                {/* Cardio Distance Line (Right Axis) - Revert color */}
                                <Line 
                                    type="monotone" 
                                    dataKey="cardioDistance" 
                                    stroke="#fa9f7b" // Brand orange for Distance
                                    strokeWidth={2} 
                                    yAxisId="right" // Tied to right axis (Distance)
                                    dot={false} 
                                    name="Distance" 
                                />
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