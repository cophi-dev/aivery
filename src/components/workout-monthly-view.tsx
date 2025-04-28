"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isBefore, isAfter, startOfDay, getWeekOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, Route, Weight } from 'lucide-react';
import type { WorkoutData } from '@/types/db';
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricCard } from '@/components/ui/metric-card';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line } from 'recharts';

const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// Use same workout type constants
const CARDIO_TYPES = ['running', 'run', 'cycling', 'bike', 'ride', 'swimming', 'swim'];
const STRENGTH_TYPES = ['strength', 'workout'];

// Updated Chart data type (per week)
interface WeeklyChartData {
    week: string; // e.g., 'W1', 'W2'
    cardioDuration: number; // minutes
    strengthDuration: number; // minutes
    cardioDistance: number; // km
    strengthVolume: number; // kg
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

// Updated Function to get metrics for a given month
async function getMetricsForMonth(monthStart: Date, monthEnd: Date, allWorkouts: WorkoutData[]): Promise<MonthlyWorkoutMetrics> {
    // console.log(`Calculating metrics for month: ${format(monthStart, 'yyyy-MM')}`);
    const monthlyWorkouts = allWorkouts.filter(w => {
        if (!w.date) return false;
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        return !isBefore(workoutDate, monthStart) && !isAfter(workoutDate, monthEnd);
    });

    let totalWorkouts = monthlyWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    let totalVolume = 0;
    // Initialize map to hold weekly aggregates
    const weeklyChartDataMap: { [weekNum: number]: Omit<WeeklyChartData, 'week'> } = {};

    monthlyWorkouts.forEach(w => {
        const duration = w.duration || 0;
        // Prioritize cardioDetails.distance, fallback to top-level distance. Assume meters.
        const distance = w.cardioDetails?.distance ?? w.distance ?? 0;
        const volume = w.calculatedVolume || 0;
        const typeLower = w.type?.toLowerCase() || 'other';

        totalDuration += duration;
        totalDistance += distance;
        totalVolume += volume;

        const workoutDate = parseISO(w.date.toString());
        const weekOfMonth = getWeekOfMonth(workoutDate, { weekStartsOn: 1 });

        // Initialize week if it doesn't exist
        if (!weeklyChartDataMap[weekOfMonth]) {
            weeklyChartDataMap[weekOfMonth] = {
                cardioDuration: 0,
                strengthDuration: 0,
                cardioDistance: 0,
                strengthVolume: 0,
            };
        }

        // Aggregate metrics based on type for the specific week
        const durationMinutes = Math.round(duration / 60);
        if (CARDIO_TYPES.includes(typeLower)) {
            weeklyChartDataMap[weekOfMonth].cardioDuration += durationMinutes;
            weeklyChartDataMap[weekOfMonth].cardioDistance += distance;
        } else if (STRENGTH_TYPES.includes(typeLower)) {
            weeklyChartDataMap[weekOfMonth].strengthDuration += durationMinutes;
            weeklyChartDataMap[weekOfMonth].strengthVolume += volume;
        }
    });

    // Convert map to array for recharts, sorted by week number
    const weeklyChartData = Object.entries(weeklyChartDataMap)
        .map(([weekNum, data]) => ({
            week: `W${weekNum}`,
            ...data,
            // Distance is already in KM from source, just round
            cardioDistance: Math.round(data.cardioDistance * 10) / 10, // Round km to 1 decimal
        }))
        .sort((a, b) => parseInt(a.week.substring(1)) - parseInt(b.week.substring(1)));

    // console.log("Calculated Monthly Metrics:", { totalWorkouts, totalDuration, totalDistance, totalVolume, weeklyChartData });
    return { 
        totalWorkouts, 
        totalDuration, 
        totalDistance, 
        totalVolume, 
        weeklyChartData,
        allWorkoutsInMonth: monthlyWorkouts 
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

    // Updated Custom Tooltip for Chart - Copied & adjusted from Weekly View
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
                    <p className="font-semibold mb-2">{label}</p> {/* Will show W1, W2 etc. */}
                    {strengthVolumeData && strengthVolumeData.value > 0 && <p style={{ color: strengthVolumeData.stroke }}>{`Volume: ${strengthVolumeData.value.toLocaleString()} kg`}</p>}
                    {cardioDistanceData && cardioDistanceData.value > 0 && <p style={{ color: cardioDistanceData.stroke }}>{`Distance: ${cardioDistanceData.value.toFixed(1)} km`}</p>}
                    {strengthDuration > 0 && <p style={{ color: strengthBarData?.fill ?? '#58a3ff' }}>{`Strength: ${strengthDuration} min`}</p>}
                    {cardioDuration > 0 && <p style={{ color: cardioBarData?.fill ?? '#fa9f7b' }}>{`Cardio: ${cardioDuration} min`}</p>}
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
            
            {/* Updated Monthly Chart - Composed */}
             {monthlyMetrics && monthlyMetrics.totalWorkouts > 0 && (
                 <Card>
                    <CardHeader>
                         {/* Updated Title */}
                        <CardTitle className="text-base font-semibold">Weekly Activity Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250} minHeight={200}> 
                            {/* Apply same margin as weekly view */}
                            <ComposedChart data={monthlyMetrics.weeklyChartData} margin={{ top: 5, right: 5, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="week" fontSize={12} tickLine={false} axisLine={false} />
                                {/* Left Y Axis (Volume - kg) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={false} 
                                    unit="kg"
                                    width={60} // Match weekly view
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
                                    width={40} // Match weekly view
                                    domain={[0, 'auto']} // Match weekly view
                                />
                                {/* Hidden Y Axis for Duration Scaling */}
                                <YAxis yAxisId="durationAxis" hide={true} />
                                
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                                
                                {/* Strength Duration Bar - Stacked, tied to hidden duration axis */}
                                <Bar 
                                    dataKey="strengthDuration" 
                                    yAxisId="durationAxis" 
                                    fill="#58a3ff" // Brand blue
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                >
                                    {/* No LabelList */}
                                </Bar>
                                
                                {/* Cardio Duration Bar - Stacked, tied to hidden duration axis */}
                                <Bar 
                                    dataKey="cardioDuration" 
                                    yAxisId="durationAxis" 
                                    fill="#fa9f7b" // Brand orange
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                >
                                     {/* No LabelList */}
                                </Bar>
                                
                                {/* Strength Volume Line (Left Axis) */}
                                <Line 
                                    type="monotone" 
                                    dataKey="strengthVolume" 
                                    stroke="#58a3ff" // Brand blue
                                    strokeWidth={2} 
                                    yAxisId="left" 
                                    dot={false} 
                                    name="Volume" 
                                />
                                {/* Cardio Distance Line (Right Axis) */}
                                <Line 
                                    type="monotone" 
                                    dataKey="cardioDistance" 
                                    stroke="#fa9f7b" // Brand orange
                                    strokeWidth={2} 
                                    yAxisId="right" 
                                    dot={false} 
                                    name="Distance" 
                                />
                            </ComposedChart>
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
                         <ul className="space-y-2">
                             {monthlyMetrics.allWorkoutsInMonth.map(workout => {
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
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
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{format(parseISO(workout.date.toString()), 'MMM d')}</span>
                                        </div>
                                        
                                        {/* Metrics (Column 2, Row 2) */}
                                        <div className="col-start-2 row-start-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {formatDuration(workout.duration || 0)}</span>
                                            {workout.distance != null && workout.distance > 0 && <span className="flex items-center"><Route className="h-3 w-3 mr-1" /> {formatDistance(workout.distance)}</span>}
                                            {workout.calculatedVolume != null && workout.calculatedVolume > 0 && <span className="flex items-center"><Weight className="h-3 w-3 mr-1" /> {workout.calculatedVolume.toLocaleString()} kg</span>}
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