"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isBefore, isAfter, startOfDay, getWeekOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Clock, Route, Weight, Dumbbell, Flame } from 'lucide-react';
import type { WorkoutData, WorkoutExerciseData } from '@/types/db';
import { formatDuration, formatDistance, calculatePercentageChange } from '@/lib/utils';
import { MetricContent } from '@/components/ui/metric-card';
import { getWorkoutTypeStyle } from '@/lib/workout-utils';
// Import AiveryInsights
import AiveryInsights from '@/components/dashboard/AiveryInsights';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Import recharts components
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line, LabelList, Legend, Label as RechartsLabel } from 'recharts';

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
    strengthVolume: number; // tons
}

// Updated type for aggregated monthly stats
interface MonthlyWorkoutMetrics {
    totalWorkouts: number;
    totalDuration: number;
    totalDistance: number;
    totalVolume: number; // tons
    weeklyChartData: WeeklyChartData[];
    allWorkoutsInMonth: WorkoutData[];
}

// Updated Function to get metrics for a given month
async function getMetricsForMonth(monthStart: Date, monthEnd: Date, allWorkoutsInput: WorkoutData[]): Promise<MonthlyWorkoutMetrics> {
    // console.log(`Calculating metrics for month: ${format(monthStart, 'yyyy-MM')}`);
    const workoutsInDateRange = allWorkoutsInput.filter(w => {
        if (!w.date) return false;
        const workoutDate = startOfDay(parseISO(w.date.toString()));
        return !isBefore(workoutDate, monthStart) && !isAfter(workoutDate, monthEnd);
    });

    // Process workouts to normalize distance to KM
    const processedWorkouts = workoutsInDateRange.map(originalWorkout => {
        const workout = { ...originalWorkout }; // Shallow copy to allow modification

        // Prioritize cardioDetails.distance, then workout.distance. Default to 0.
        // This will be our canonical distance in KM.
        let canonicalDistanceKm = workout.cardioDetails?.distance ?? workout.distance ?? 0;

        // Heuristic: If cardioDetails.distance is not present, workout.distance might be in meters
        // for types like 'run' or 'running'.
        if (workout.cardioDetails?.distance == null && // Check if cardioDetails.distance is null or undefined
            workout.distance != null && // Check if workout.distance is not null or undefined
            (workout.type?.toLowerCase() === 'run' || workout.type?.toLowerCase() === 'running') &&
            workout.distance > 200 // Threshold suggesting meters (e.g., value 5000 for 5km)
        ) {
            canonicalDistanceKm = workout.distance / 1000;
        }
        
        // Update the workout object's distance to the canonical KM value.
        // This ensures that rendering logic later uses the corrected KM distance.
        workout.distance = canonicalDistanceKm;

        return workout;
    });

    let totalWorkouts = processedWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0; // This will be in KM
    let totalVolume = 0;
    // Initialize map to hold weekly aggregates
    const weeklyChartDataMap: { [weekNum: number]: Omit<WeeklyChartData, 'week'> } = {};

    processedWorkouts.forEach(w => { // Iterate over PROCESSED workouts
        const duration = w.duration || 0;
        // w.distance is now consistently in KM (or what we assume is KM after processing)
        const distanceKm = w.distance || 0; 
        const volumeKg = w.calculatedVolume || 0;
        const volumeTons = volumeKg / 1000; // Convert kg to tons
        const typeLower = w.type?.toLowerCase() || 'other';

        totalDuration += duration;
        totalDistance += distanceKm; // Accumulate distance in KM
        totalVolume += volumeTons; // Accumulate volume in Tons

        const workoutDate = parseISO(w.date.toString());
        const weekOfMonth = getWeekOfMonth(workoutDate, { weekStartsOn: 1 });

        // Initialize week if it doesn't exist
        if (!weeklyChartDataMap[weekOfMonth]) {
            weeklyChartDataMap[weekOfMonth] = {
                cardioDuration: 0,
                strengthDuration: 0,
                cardioDistance: 0,
                strengthVolume: 0, // Initialize as tons
            };
        }

        // Aggregate metrics based on type for the specific week
        const durationMinutes = Math.round(duration / 60);
        if (CARDIO_TYPES.includes(typeLower)) {
            weeklyChartDataMap[weekOfMonth].cardioDuration += durationMinutes;
            weeklyChartDataMap[weekOfMonth].cardioDistance += distanceKm;
        } else if (STRENGTH_TYPES.includes(typeLower)) {
            weeklyChartDataMap[weekOfMonth].strengthDuration += durationMinutes;
            weeklyChartDataMap[weekOfMonth].strengthVolume += volumeTons; // Add tons
        }
    });

    // Convert map to array for recharts, sorted by week number
    const weeklyChartData = Object.entries(weeklyChartDataMap)
        .map(([weekNum, data]) => ({
            week: `W${weekNum}`,
            ...data,
            // Round distance and volume (tons)
            cardioDistance: Math.round(data.cardioDistance * 10) / 10, 
            strengthVolume: Math.round(data.strengthVolume * 100) / 100, // Round tons
        }))
        .sort((a, b) => parseInt(a.week.substring(1)) - parseInt(b.week.substring(1)));

    // console.log("Calculated Monthly Metrics:", { totalWorkouts, totalDuration, totalDistance, totalVolume, weeklyChartData });
    return { 
        totalWorkouts, 
        totalDuration, 
        totalDistance, // This is now correctly summed KM
        totalVolume, 
        weeklyChartData,
        allWorkoutsInMonth: processedWorkouts // Return the processed workouts with corrected .distance
    };
}

export default function WorkoutMonthlyView() {
    const router = useRouter();
    const [allWorkouts, setAllWorkouts] = useState<WorkoutData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMonthStart, setSelectedMonthStart] = useState<Date>(startOfMonth(new Date()));
    const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyWorkoutMetrics | null>(null);
    const [previousMonthMetrics, setPreviousMonthMetrics] = useState<MonthlyWorkoutMetrics | null>(null);
    const [isMetricsLoading, setIsMetricsLoading] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    const [showLastMonth, setShowLastMonth] = useState(false);
    const [chartDisplayData, setChartDisplayData] = useState<any[]>([]);

    // Effect to check screen size
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 640); // Tailwind's sm breakpoint
        };
        checkScreenSize(); // Initial check
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize); // Cleanup
    }, []);

    // Define margins based on screen size (moved before early returns)
    const chartMargins = useMemo(() => {
        return isSmallScreen 
            ? { top: 5, right: 5, left: 5, bottom: 0 } 
            : { top: 5, right: 15, left: 25, bottom: 0 }; 
    }, [isSmallScreen]);

    // Define conditional label configs (moved before early returns)
    const leftAxisLabelConfig = useMemo(() => !isSmallScreen ? { 
        value: 'Volume (t)', 
        angle: -90, 
        position: 'insideLeft',
        offset: -15, 
        style: { fontSize: '12px', fill: 'hsl(var(--primary))', fontWeight: 500, textAnchor: 'middle' }
    } : undefined, [isSmallScreen]);

    const rightAxisLabelConfig = useMemo(() => !isSmallScreen ? { 
        value: 'Distance (km)',
        angle: 90, 
        position: 'insideRight',
        offset: -15, 
        style: { fontSize: '12px', fill: 'var(--chart-orange, #fb923c)', fontWeight: 500, textAnchor: 'middle' } 
    } : undefined, [isSmallScreen]);

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

    // NEW useEffect to combine data for chart rendering (similar to weekly)
    useEffect(() => {
        if (!monthlyMetrics) {
            setChartDisplayData([]); // Clear if no current data
            return;
        }

        // Create a map of previous month data by week name for quick lookup
        const prevDataMap = new Map<string, WeeklyChartData>();
        if (previousMonthMetrics?.weeklyChartData) {
            previousMonthMetrics.weeklyChartData.forEach(weekData => {
                prevDataMap.set(weekData.week, weekData);
            });
        }

        // Map current month data and merge previous month data
        const combinedData = monthlyMetrics.weeklyChartData.map(currentWeekData => {
            const prevWeekData = prevDataMap.get(currentWeekData.week);
            return {
                ...currentWeekData, // Include all current week data
                // Add previous month values, defaulting to null if not found
                prevStrengthVolume: prevWeekData?.strengthVolume ?? null, 
                prevCardioDistance: prevWeekData?.cardioDistance ?? null, 
                // Add prev durations if needed, though not directly plotted as lines
                // prevStrengthDuration: prevWeekData?.strengthDuration ?? null,
                // prevCardioDuration: prevWeekData?.cardioDuration ?? null,
            };
        });

        setChartDisplayData(combinedData);

    }, [monthlyMetrics, previousMonthMetrics]); // Re-run when metric data changes

    const shiftMonth = (months: number) => {
        setSelectedMonthStart(prev => addMonths(prev, months));
    };

    // Define handleWorkoutClick
    const handleWorkoutClick = useCallback((workoutId: string) => {
        router.push(`/workouts/${workoutId}`);
    }, [router]);

    // Early returns are now safe as all hooks are called before them
    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> <span className="ml-2">Loading workouts...</span></div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    const monthDisplay = format(selectedMonthStart, 'MMMM yyyy');

    // Updated Custom Tooltip for Chart (Copied & refined from Weekly View)
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0]?.payload; 
            if (!dataPoint) return null; // Check if datapoint exists

            const strengthVolume = dataPoint.strengthVolume; // Now in Tons
            const cardioDistance = dataPoint.cardioDistance;
            const strengthDuration = dataPoint.strengthDuration;
            const cardioDuration = dataPoint.cardioDuration;

            const strengthColor = 'hsl(var(--primary))'; 
            const cardioColor = 'var(--chart-orange, #fb923c)';

            return (
                <div className="bg-popover text-popover-foreground border border-border/50 shadow-lg rounded-lg p-3.5 text-sm space-y-1">
                    <p className="font-semibold mb-1 text-center">{label}</p> {/* Week Label */} 
                    {/* Strength Volume (Tons) */}
                    {strengthVolume > 0 && (
                        <div className="flex items-center">
                            <Dumbbell className="h-3.5 w-3.5 mr-1.5" style={{ color: strengthColor }}/> 
                            <p style={{ color: strengthColor }}>
                                {`${strengthVolume.toLocaleString(undefined, {maximumFractionDigits: 2})} t`}
                            </p>
                        </div>
                    )}
                    {/* Cardio Distance (KM) */}
                    {cardioDistance > 0 && (
                         <div className="flex items-center">
                            <Flame className="h-3.5 w-3.5 mr-1.5" style={{ color: cardioColor }}/>
                            <p style={{ color: cardioColor }}>
                                {`${cardioDistance.toFixed(1)} km`}
                            </p>
                        </div>
                    )}
                    {/* Optional: Separator if both metrics and durations exist */}
                    {(strengthVolume > 0 || cardioDistance > 0) && (strengthDuration > 0 || cardioDuration > 0) && (
                        <hr className="my-1 border-border/30" />
                    )}
                    {/* Strength Duration (Min) */}
                    {strengthDuration > 0 && (
                         <div className="flex items-center text-xs opacity-80">
                             <Clock className="h-3 w-3 mr-1.5" style={{ color: strengthColor }}/> 
                             <p style={{ color: strengthColor }}>{`${strengthDuration} min`}</p>
                         </div>
                    )}
                    {/* Cardio Duration (Min) */}
                    {cardioDuration > 0 && (
                         <div className="flex items-center text-xs opacity-80">
                             <Clock className="h-3 w-3 mr-1.5" style={{ color: cardioColor }}/> 
                             <p style={{ color: cardioColor }}>{`${cardioDuration} min`}</p>
                         </div>
                    )}
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
                        <div className="flex justify-center items-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : monthlyMetrics ? (
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Workouts" 
                                    value={monthlyMetrics.totalWorkouts.toString()} 
                                    change={calculatePercentageChange(monthlyMetrics.totalWorkouts, previousMonthMetrics?.totalWorkouts)}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Duration" 
                                    value={formatDuration(monthlyMetrics.totalDuration)} 
                                    change={calculatePercentageChange(monthlyMetrics.totalDuration, previousMonthMetrics?.totalDuration)}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Distance" 
                                    value={formatDistance(monthlyMetrics.totalDistance)} 
                                    change={monthlyMetrics.totalDistance > 0 ? calculatePercentageChange(monthlyMetrics.totalDistance, previousMonthMetrics?.totalDistance) : null}
                                />
                            </Card>
                            <Card className="p-4 bg-background border border-border/10 hover:bg-muted/5 transition-colors">
                                <MetricContent 
                                    title="Total Volume" 
                                    value={`${(monthlyMetrics.totalVolume / 1000).toFixed(1)}t`}
                                    change={monthlyMetrics.totalVolume > 0 ? calculatePercentageChange(monthlyMetrics.totalVolume, previousMonthMetrics?.totalVolume) : null}
                                />
                            </Card>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">No data available for this month.</p>
                    )}
                </CardContent>
            </Card>

            {/* NEW: Aivery Insights Section (Moved Above Chart) */}
            <section className="mb-6"> {/* Added margin-bottom */}
                <AiveryInsights dateRange={{ start: selectedMonthStart, end: selectedMonthEnd }} />
            </section>
            
            {/* Updated Monthly Chart - Composed */}
             {monthlyMetrics && monthlyMetrics.totalWorkouts > 0 && (
                 <Card>
                    {/* Add Last Month Toggle to Header */}
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-x-2 sm:space-x-4"> 
                        <CardTitle className="text-sm sm:text-base font-semibold whitespace-nowrap">Weekly Activity Breakdown</CardTitle>
                         {/* Last Month Toggle */} 
                        <div className="flex items-center space-x-2 ml-auto">
                            <Switch
                                id="show-last-month-switch"
                                checked={showLastMonth}
                                onCheckedChange={setShowLastMonth}
                            />
                            <Label htmlFor="show-last-month-switch" className="text-xs font-medium whitespace-nowrap">Last Month</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ResponsiveContainer width="100%" height={250} minHeight={200} className="h-[200px] sm:h-[250px]">
                            {/* Use combined chartDisplayData */}
                            <ComposedChart data={chartDisplayData} margin={chartMargins}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.1} />
                                <XAxis 
                                    dataKey="week" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tick={{ fontWeight: 500, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted color, lighter weight
                                />
                                {/* Left Y Axis (Volume - Tons) */}
                                <YAxis 
                                    yAxisId="left"
                                    orientation="left" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true} // Allow decimals for tons
                                    // Format tons 
                                    tickFormatter={(value) => `${value.toFixed(1)} t`}
                                    // unit=" t" // REMOVED
                                    width={isSmallScreen ? 40 : 60} // Responsive width
                                    label={leftAxisLabelConfig} // Conditional label
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted ticks
                                    // Add domain if needed, e.g., based on max volume
                                    // domain={[0, 'auto']} 
                                />
                                {/* Right Y Axis (Distance - km) */}
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    allowDecimals={true} 
                                    // Format km
                                    tickFormatter={(value) => `${value.toFixed(1)} km`}
                                    // unit=" km" // REMOVED
                                    width={isSmallScreen ? 40 : 60} // Responsive width
                                    label={rightAxisLabelConfig} // Conditional label
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} // Muted ticks
                                    // Add domain if needed
                                    // domain={[0, 'auto']}
                                />
                                {/* Hidden axis for duration bars (keep?) */}
                                <YAxis 
                                    yAxisId="durationAxis" 
                                    orientation="right" 
                                    hide={true} 
                                    domain={[0, 'auto']} 
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{
                                        paddingBottom: '5px',
                                        borderBottom: '1px solid var(--border)',
                                        marginBottom: '5px' 
                                    }}
                                    // Use formatter for responsive text size
                                    formatter={(value, entry) => (
                                        <span className="text-xs sm:text-sm text-muted-foreground ml-1" style={{ color: entry?.color }}>
                                            {value}
                                        </span>
                                    )}
                                    payload={[
                                        { value: 'Strength', type: 'circle', color: 'hsl(var(--primary))' },
                                        { value: 'Cardio', type: 'circle', color: 'var(--chart-orange, #fb923c)' } // Use CSS Var
                                    ]}
                                />
                                <Tooltip 
                                    content={CustomTooltip} 
                                    cursor={{ 
                                        fill: 'hsl(var(--accent))', // Use accent color
                                        opacity: 0.1 
                                    }} 
                                />
                                
                                {/* Strength Duration Bar */}
                                <Bar 
                                    dataKey="strengthDuration" 
                                    yAxisId="durationAxis" 
                                    fill="hsl(var(--primary))" // Use CSS Var
                                    fillOpacity={0.2} // Slightly lower opacity for bars
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                />
                                {/* Cardio Duration Bar */}
                                <Bar 
                                    dataKey="cardioDuration" 
                                    yAxisId="durationAxis" 
                                    fill="var(--chart-orange, #fb923c)" // Use CSS Var
                                    fillOpacity={0.2} // Slightly lower opacity for bars
                                    stackId="a" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={30}
                                />
                                
                                {/* Strength Volume Line (Left Axis) */}
                                <Line 
                                    type="monotone" 
                                    dataKey="strengthVolume" 
                                    stroke="hsl(var(--primary))" // Use CSS Var
                                    strokeWidth={2.5} 
                                    yAxisId="left" 
                                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }} // Style like weekly
                                    activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2, fill: 'hsl(var(--primary))' }} // Style like weekly
                                />
                                {/* Cardio Distance Line (Right Axis) */}
                                <Line 
                                    type="monotone" 
                                    dataKey="cardioDistance" 
                                    stroke="var(--chart-orange, #fb923c)" // Use CSS Var
                                    strokeWidth={2.5} 
                                    yAxisId="right" 
                                    dot={{ r: 4, fill: 'var(--chart-orange, #fb923c)', strokeWidth: 0 }} // Style like weekly
                                    activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2, fill: 'var(--chart-orange, #fb923c)' }} // Style like weekly
                                />

                                {/* Previous Month Lines (Conditional) */}
                                {showLastMonth && (
                                    <>
                                        <Line 
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="prevStrengthVolume" // Data key for previous volume
                                            stroke="hsl(var(--primary))" 
                                            strokeWidth={1.5} 
                                            strokeOpacity={0.4} 
                                            strokeDasharray="3 3" 
                                            dot={false} 
                                            activeDot={false} 
                                            connectNulls={true} 
                                            name="_prevStrength" 
                                        />
                                        <Line 
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="prevCardioDistance" // Data key for previous distance
                                            stroke="var(--chart-orange, #fb923c)" 
                                            strokeWidth={1.5} 
                                            strokeOpacity={0.4} 
                                            strokeDasharray="3 3" 
                                            dot={false} 
                                            activeDot={false} 
                                            connectNulls={true} 
                                            name="_prevCardio" 
                                        />
                                    </>
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                 </Card>
             )}

             {/* Monthly Workout List */}
              {monthlyMetrics && monthlyMetrics.allWorkoutsInMonth.length > 0 && (
                 <Card className="mt-6 border border-border/10">
                     <CardHeader>
                         <CardTitle className="text-base font-semibold">Workouts This Month</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <ul className="space-y-2">
                             {monthlyMetrics.allWorkoutsInMonth.map(workout => {
                                 const { icon, colorClasses } = getWorkoutTypeStyle(workout.type);
                                 return (
                                     <li key={workout._id}
                                        onClick={() => handleWorkoutClick(workout._id)}
                                        className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors border border-border/5 cursor-pointer"
                                     >
                                        {/* Badge (Column 1, Row 1 & 2) */}
                                        <Badge variant="outline" className={`row-span-2 flex items-center self-center mt-1 px-2 py-0.5 ${colorClasses} bg-background/50`}>
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
                                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1 text-primary" /> {formatDuration(workout.duration || 0)}</span>
                                            {workout.distance != null && workout.distance > 0 && 
                                                <span className="flex items-center">
                                                    <Route className="h-3 w-3 mr-1 text-primary" /> 
                                                    {formatDistance(workout.distance)}
                                                </span>
                                            }
                                            {workout.calculatedVolume != null && workout.calculatedVolume > 0 && 
                                                <span className="flex items-center">
                                                    <Weight className="h-3 w-3 mr-1 text-primary" /> 
                                                    {(workout.calculatedVolume / 1000).toLocaleString(undefined, {maximumFractionDigits: 2})} t
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
              {monthlyMetrics && monthlyMetrics.totalWorkouts === 0 && (
                  <p className="text-muted-foreground text-center py-4">No workouts recorded for this month.</p>
              )}

        </div>
    );
} 