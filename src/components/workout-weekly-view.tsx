"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, startOfDay, isBefore, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, Route, Weight, Dumbbell, Flame } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData } from '@/types/db';
// NEW: Import Switch and Label for the toggle
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
    let totalVolumeTons = 0; // <-- CHANGED to Tons

    // Loop 1: Calculate daily totals and overall totals
    for (const w of weeklyWorkouts) {
        const duration = w.duration || 0;
        let workoutDistanceMeters = 0;
        if (w.cardioDetails?.distance) {
            workoutDistanceMeters = w.cardioDetails.distance * 1000;
        } else if (typeof w.distance === 'number') {
            workoutDistanceMeters = w.distance < 100 ? w.distance * 1000 : w.distance;
        }
        const volumeKg = w.calculatedVolume || 0; // Volume from DB is in KG
        const volumeTons = volumeKg / 1000; // Convert to Tons
        const typeLower = w.type?.toLowerCase() || 'other';

        // Update overall totals
        totalDuration += duration;
        totalVolumeTons += volumeTons; // Accumulate in Tons
        const distanceKmForDay = workoutDistanceMeters / 1000;
        totalDistanceKm += distanceKmForDay;

        const workoutDate = startOfDay(parseISO(w.date.toString()));
        const dayKey = formatDateKey(workoutDate);
        const dayName = format(workoutDate, 'eee');

        // Add to workoutsByDay
        if (workoutsByDay[dayKey]) {
            workoutsByDay[dayKey].push(w);
        }

        // Update daily totals map (using Tons)
        if (dailyTotalsMap[dayName]) {
            const durationMinutes = Math.round(duration / 60);
            if (CARDIO_TYPES.includes(typeLower)) {
                dailyTotalsMap[dayName].cardioDuration += durationMinutes;
                dailyTotalsMap[dayName].cardioDistance += distanceKmForDay;
            } else if (STRENGTH_TYPES.includes(typeLower)) {
                dailyTotalsMap[dayName].strengthDuration += durationMinutes;
                dailyTotalsMap[dayName].strengthVolume += volumeTons; // Add Tons
            }
        }
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
                                value={`${(weeklyMetrics.totalVolume / 1000).toFixed(1)}t`}
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
                         <ul className="space-y-2">
                             {weeklyMetrics.allWorkoutsInWeek.map(workout => { 
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 const volumeKg = workout.calculatedVolume || 0;
                                 const volumeTons = volumeKg / 1000;
                                 return (
                                     <li key={workout._id} 
                                        onClick={() => handleWorkoutClick(workout._id)}
                                        className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors border border-border/5 cursor-pointer"
                                     >
                                        <Badge variant="outline" className={`row-span-2 flex items-center self-center mt-1 px-2 py-0.5 ${colorClasses} bg-background/50`}>
                                            {icon}
                                            <span className="ml-1.5 text-xs">{workout.type}</span>
                                        </Badge>

                                        <div className="col-start-2 row-start-1 flex justify-between items-center">
                                            <p className="font-semibold text-sm truncate pr-2">{workout.name || 'Unnamed Workout'}</p>
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{format(parseISO(workout.date.toString()), 'EEE, MMM d')}</span>
                                        </div>
                                        
                                        <div className="col-start-2 row-start-2 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1 text-primary" /> {formatDuration(workout.duration || 0)}</span>
                                            {workout.distance != null && workout.distance > 0 && 
                                                <span className="flex items-center">
                                                    <Route className="h-3 w-3 mr-1 text-primary" /> 
                                                    {formatDistance(workout.distance < 100 ? workout.distance : workout.distance / 1000)}
                                                </span>
                                            }
                                            {volumeTons > 0 && 
                                                <span className="flex items-center">
                                                    <Weight className="h-3 w-3 mr-1 text-primary" /> 
                                                    {volumeTons.toLocaleString(undefined, {maximumFractionDigits: 2})} t
                                                </span>
                                            }
                                        </div>
                                     </li>
                                 );
                             })}
                         </ul>
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