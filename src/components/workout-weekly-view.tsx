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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, LabelList, Legend } from 'recharts';

// Import helpers from utils and the new MetricCard location
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
// Import getWorkoutTypeStyle for the list
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
// Import AiveryInsights component
import AiveryInsights from '@/components/dashboard/AiveryInsights';

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
    cumulativeCardioDistance: number; // km
    cumulativeStrengthVolume: number; // kg
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

// Updated function to get metrics for a given week (Refactored Logic)
async function getMetricsForWeek(weekStart: Date, weekEnd: Date, weeklyWorkouts: WorkoutData[]): Promise<WeeklyWorkoutMetrics> {
    
    // --- Step 1: Aggregate DAILY totals --- 
    const dailyTotalsMap: { 
        [dayName: string]: { 
            cardioDuration: number;
            strengthDuration: number;
            cardioDistance: number; // km
            strengthVolume: number; // kg
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
            strengthVolume: 0,
        };
    });
    daysInWeek.forEach(day => {
        workoutsByDay[formatDateKey(day)] = [];
    });

    // Initialize overall totals
    let totalWorkouts = weeklyWorkouts.length;
    let totalDuration = 0;
    let totalDistanceKm = 0;
    let totalVolume = 0;

    // Loop 1: Calculate daily totals and overall totals
    for (const w of weeklyWorkouts) {
        const duration = w.duration || 0;
        let workoutDistanceMeters = 0;
        if (w.cardioDetails?.distance) {
            workoutDistanceMeters = w.cardioDetails.distance * 1000;
        } else if (typeof w.distance === 'number') {
            workoutDistanceMeters = w.distance < 100 ? w.distance * 1000 : w.distance;
        }
        const volume = w.calculatedVolume || 0;
        const typeLower = w.type?.toLowerCase() || 'other';

        // Update overall totals
        totalDuration += duration;
        totalVolume += volume;
        const distanceKmForDay = workoutDistanceMeters / 1000;
        totalDistanceKm += distanceKmForDay;

        const workoutDate = startOfDay(parseISO(w.date.toString()));
        const dayKey = formatDateKey(workoutDate);
        const dayName = format(workoutDate, 'eee');

        // Add to workoutsByDay
        if (workoutsByDay[dayKey]) {
            workoutsByDay[dayKey].push(w);
        }

        // Update daily totals map
        if (dailyTotalsMap[dayName]) {
            const durationMinutes = Math.round(duration / 60);
            if (CARDIO_TYPES.includes(typeLower)) {
                dailyTotalsMap[dayName].cardioDuration += durationMinutes;
                dailyTotalsMap[dayName].cardioDistance += distanceKmForDay;
            } else if (STRENGTH_TYPES.includes(typeLower)) {
                dailyTotalsMap[dayName].strengthDuration += durationMinutes;
                dailyTotalsMap[dayName].strengthVolume += volume;
            }
        }
    }

    // --- Step 2: Build final chart data array and calculate cumulative --- 
    const dailyChartData: DailyChartData[] = [];
    let runningCumulativeDistance = 0;
    let runningCumulativeVolume = 0;

    for (const dayName of dayNamesInOrder) {
        const dailyTotals = dailyTotalsMap[dayName] || { cardioDuration: 0, strengthDuration: 0, cardioDistance: 0, strengthVolume: 0 };
        
        runningCumulativeDistance += dailyTotals.cardioDistance;
        runningCumulativeVolume += dailyTotals.strengthVolume;

        dailyChartData.push({
            day: dayName,
            // Daily values from map
            cardioDuration: dailyTotals.cardioDuration,
            strengthDuration: dailyTotals.strengthDuration,
            cardioDistance: Math.round(dailyTotals.cardioDistance * 100) / 100, // Round daily distance
            strengthVolume: Math.round(dailyTotals.strengthVolume), // Round daily volume
            // Cumulative values
            cumulativeCardioDistance: Math.round(runningCumulativeDistance * 100) / 100,
            cumulativeStrengthVolume: Math.round(runningCumulativeVolume),
            // Include duration labels (placeholder, needs logic if required)
            // cardioDurationLabel: dailyTotals.cardioDuration, 
            // strengthDurationLabel: dailyTotals.strengthDuration,
        });
    }

    // Log the final chart data for verification
    // console.log(`[DEBUG Refactored ${format(weekStart, 'MMM d')}] Final dailyChartData:`, JSON.parse(JSON.stringify(dailyChartData)));

    const result: WeeklyWorkoutMetrics = { 
        totalWorkouts, 
        totalDuration, 
        totalDistance: totalDistanceKm, // Use the correctly summed distance
        totalVolume, 
        workoutsByDay, 
        dailyChartData,
        allWorkoutsInWeek: weeklyWorkouts 
    };

    // Log the distance *from the result object*
    // console.log(`[DEBUG Refactored ${format(weekStart, 'MMM d')}] Final totalDistance in RETURN OBJECT: ${result.totalDistance}`);

    return result;
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
                    
                    // <<< Log input data for current week AGAIN - Check for duplicates >>>
                    // console.log("[DEBUG useEffect Pre-Call] Workouts for Current Week:", JSON.parse(JSON.stringify(currentWorkoutsInWeek.map(w => ({id: w._id, date: w.date, type: w.type})))));
                    // console.log("[DEBUG useEffect Pre-Call] Workouts for Previous Week:", JSON.parse(JSON.stringify(previousWorkoutsInWeek.map(w => ({id: w._id, date: w.date, type: w.type})))));

                    // Pass pre-filtered arrays to getMetricsForWeek SEQUENTIALLY
                    const prevMetrics = await getMetricsForWeek(prevWeekStart, prevWeekEnd, previousWorkoutsInWeek);
                    const currentMetrics = await getMetricsForWeek(selectedWeekStart, currentWeekEnd, currentWorkoutsInWeek);
                    
                    // <<< Log the returned metrics object BEFORE setting state (ensure deep copy for logging) >>>
                    // console.log("[DEBUG useEffect] currentMetrics object received from getMetricsForWeek:", JSON.parse(JSON.stringify(currentMetrics)));
                    // console.log("[DEBUG useEffect] prevMetrics object received from getMetricsForWeek:", JSON.parse(JSON.stringify(prevMetrics))); // Log prevMetrics too

                    if (isMounted) {
                        // <<< Log right before setting state >>>
                        // console.log("[DEBUG useEffect] Data JUST BEFORE setState:", JSON.parse(JSON.stringify(currentMetrics)));

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
    // console.log("[DEBUG] weeklyMetrics state just before render return:", weeklyMetrics);
    if (weeklyMetrics) {
      // console.log("[DEBUG] dailyChartData in state just before render return:", weeklyMetrics.dailyChartData);
    }

    // <<< Log data specifically for Thursday being passed to the chart >>>
    // if (weeklyMetrics?.dailyChartData) {
    //     const thuData = weeklyMetrics.dailyChartData.find(d => d.day === 'Thu');
    //     console.log("[DEBUG Chart Data] Thursday data passed to chart:", thuData);
    // }

    const weekDisplay = `${format(selectedWeekStart, 'MMM d')} - ${format(selectedWeekEnd, 'MMM d, yyyy')}`;

    // Updated Custom Tooltip for Chart to show cumulative values
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Access the original data point for cumulative values
            const dataPoint = payload[0].payload; 
            const cumulativeVolume = dataPoint.cumulativeStrengthVolume;
            const cumulativeDistance = dataPoint.cumulativeCardioDistance;
            // Access daily values for optional display
            const dailyVolume = dataPoint.strengthVolume;
            const dailyDistance = dataPoint.cardioDistance;

            // Find line data for colors
            const strengthLineData = payload.find((p: any) => p.dataKey === 'cumulativeStrengthVolume');
            const cardioLineData = payload.find((p: any) => p.dataKey === 'cumulativeCardioDistance');

            return (
                <div className="bg-background border border-border shadow-lg rounded-md p-3 text-sm">
                    <p className="font-semibold mb-2">{label}</p>
                    {/* Display Cumulative values */}                    
                    {cumulativeVolume > 0 && <p style={{ color: strengthLineData?.stroke }}>{`Total Vol: ${cumulativeVolume.toLocaleString()} kg`}</p>}
                    {cumulativeDistance > 0 && <p style={{ color: cardioLineData?.stroke }}>{`Total Dist: ${cumulativeDistance.toFixed(1)} km`}</p>}
                    {/* Optionally display daily contribution */} 
                    {(dailyVolume > 0 || dailyDistance > 0) && <hr className="my-1 border-border/50"/>}
                    {dailyVolume > 0 && <p className="text-xs text-muted-foreground" style={{ color: strengthLineData?.stroke }}>{`(Daily Vol: ${dailyVolume.toLocaleString()} kg)`}</p>}
                    {dailyDistance > 0 && <p className="text-xs text-muted-foreground" style={{ color: cardioLineData?.stroke }}>{`(Daily Dist: ${dailyDistance.toFixed(1)} km)`}</p>}
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
                        <CardTitle className="text-base font-semibold">Weekly Cumulative Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250} minHeight={200}>
                            <ComposedChart data={weeklyMetrics.dailyChartData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}> 
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                                <XAxis 
                                    dataKey="day" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tick={{ fontWeight: 600 }}
                                />
                                {/* Left Y Axis (Cumulative Volume - kg) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={false} 
                                    unit=" kg" 
                                    width={60}
                                    label={{ 
                                        value: 'Cum. Volume (kg)', 
                                        angle: -90, 
                                        position: 'insideLeft',
                                        offset: -5,
                                        style: { 
                                            fontSize: '12px', 
                                            fill: '#58a3ff', 
                                            fontWeight: 500,
                                            textAnchor: 'middle'
                                        }
                                    }}
                                />
                                {/* Right Y Axis (Cumulative Distance - km) */}
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true}
                                    tickFormatter={(value) => value.toFixed(1)} 
                                    unit=" km" 
                                    width={60}
                                    label={{ 
                                        value: 'Cum. Distance (km)', 
                                        angle: 90, 
                                        position: 'insideRight',
                                        offset: -5,
                                        style: { 
                                            fontSize: '12px', 
                                            fill: '#fa9f7b', 
                                            fontWeight: 500,
                                            textAnchor: 'middle'
                                        }
                                    }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{
                                        paddingBottom: '10px',
                                        borderBottom: '1px solid var(--border)',
                                        marginBottom: '10px'
                                    }}
                                    payload={[
                                        { value: 'Cum. Strength Vol.', type: 'circle', color: '#58a3ff' },
                                        { value: 'Cum. Cardio Dist.', type: 'circle', color: '#fa9f7b' }
                                    ]}
                                />
                                <Tooltip 
                                    content={CustomTooltip} 
                                    cursor={{ 
                                        fill: 'var(--muted)', 
                                        opacity: 0.1 
                                    }} 
                                />
                                {/* Cumulative Strength Volume Line */}
                                <Line 
                                    type="monotone" 
                                    dataKey="cumulativeStrengthVolume" 
                                    name="Cum. Strength Vol."
                                    stroke="#58a3ff" 
                                    strokeWidth={2.5}
                                    yAxisId="left" 
                                    dot={{ fill: '#58a3ff', r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                                {/* Cumulative Cardio Distance Line */}
                                <Line 
                                    type="monotone" 
                                    dataKey="cumulativeCardioDistance" 
                                    name="Cum. Cardio Dist."
                                    stroke="#fa9f7b" 
                                    strokeWidth={2.5}
                                    yAxisId="right" 
                                    dot={{ fill: '#fa9f7b', r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
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

            {/* --- NEW SECTION --- */}
            <section className="mb-8">
                <AiveryInsights dateRange={{ start: selectedWeekStart, end: selectedWeekEnd }} />
            </section>
            {/* --- END NEW SECTION --- */}

        </div>
    );
}

// Ensure no duplicate function definitions or extraneous tags exist below this line. 