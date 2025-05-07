'use client'

import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot, Legend } from 'recharts';
import { format, subDays, subMonths, startOfWeek, endOfWeek, isWithinInterval, eachWeekOfInterval, isValid } from 'date-fns';
import { WorkoutData } from '@/types/db'; // Import WorkoutData type
import { Button } from "@/components/ui/button"; // Import Button for filters
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // Import ToggleGroup for metric selection

// Define the props for the component - Now accepting raw data
interface WorkoutProgressGraphProps {
  currentWorkout: WorkoutData;
  historyData: WorkoutData[]; 
}

// Helper type for data BEFORE filtering (value can be null)
interface MappedDataItem {
  date: Date;
  dateLabel: string;
  value: number | null;
  isCurrent?: boolean; 
}

// Helper type for processed chart data AFTER filtering (value is number)
interface ChartDataItem {
  date: Date; 
  dateLabel: string; 
  value: number;
  isCurrent?: boolean; // Keep optional flag for dot renderer
}

// Type for detailed run records graph data
interface RunRecordItem {
  time: number; // Elapsed seconds from start
  pace: number | null; // Pace in min/km
  heartRate: number | null; // HR in bpm
}

// Helper utility functions
const calculatePaceFromSpeed = (speed: number | undefined | null): number | null => {
  if (speed === undefined || speed === null || speed <= 0) return null;
  // 1 / (m/s * 60 / 1000) = 1 / (m/s * 0.06)
  return 1 / (speed * 0.06);
};

const formatTimeTick = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  
  if (hours > 0) {
      return `${hours.toString()}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Custom Tooltip Formatter (updated to show week range if applicable)
const CustomTooltip = ({ active, payload, label, metricLabel, granularity }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(payload[0].payload.date); // Get date from payload
    const value = payload[0].value;
    
    let displayDate = format(date, 'MMM d, yyyy');
    if (granularity === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Assuming Monday start
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      displayDate = `Week of ${format(weekStart, 'MMM d')}`;
    }

    const formattedValue = metricLabel.toLowerCase().includes('pace') 
      ? `${Math.floor(value)}:${Math.round((value % 1) * 60).toString().padStart(2, '0')}`
      : value.toLocaleString();

    return (
      <div className="bg-background p-2 border rounded shadow-sm text-sm">
        <p className="font-medium">{displayDate}</p>
        <p>{`${metricLabel}: ${formattedValue}`}</p>
      </div>
    );
  }
  return null;
};

// Custom Y-Axis Tick Formatter for Pace
const formatPaceTick = (tickValue: number): string => {
  if (isNaN(tickValue) || tickValue <= 0) return "-";
  const minutes = Math.floor(tickValue);
  const seconds = Math.round((tickValue % 1) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Formatter for HR Y-Axis (bpm)
const formatHrTick = (tickValue: number): string => {
  if (isNaN(tickValue) || tickValue < 0) return "-";
  return `${Math.round(tickValue)}`;
};

// Custom Dot Renderer to highlight the current workout
const renderCustomDot = (props: any) => {
  const { cx, cy, stroke, payload } = props;

  if (payload.isCurrent) {
    return (
      <Dot 
        cx={cx} 
        cy={cy} 
        r={5} // Larger radius
        fill="hsl(var(--primary))" 
        stroke="hsl(var(--background))" // Contrast outline
        strokeWidth={2}
      />
    );
  }

  // Default dot
  return <Dot cx={cx} cy={cy} r={3} fill={stroke} />;
};

// Custom Tooltip for Detailed Run Graph (Moved outside main component)
const CustomRunTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const time = payload[0].payload.time;
    const pace = payload.find((p: any) => p.dataKey === 'pace')?.value;
    const heartRate = payload.find((p: any) => p.dataKey === 'heartRate')?.value;

    return (
      <div className="bg-background p-2 border rounded shadow-sm text-sm">
        <p className="font-medium">Time: {formatTimeTick(time)}</p>
        {pace !== null && pace !== undefined && (
          <p style={{ color: 'hsl(var(--chart-1))' }}>Pace: {formatPaceTick(pace)} min/km</p>
        )}
        {heartRate !== null && heartRate !== undefined && (
           <p style={{ color: 'hsl(var(--chart-2))' }}>HR: {formatHrTick(heartRate)} bpm</p>
        )}
      </div>
    );
  }
  return null;
};

const WorkoutProgressGraph: React.FC<WorkoutProgressGraphProps> = ({ currentWorkout, historyData }) => {
  // --- State --- 
  const [timeFilter, setTimeFilter] = useState<'2w' | '1m' | '3m' | 'all'>('3m');
  
  // Default metric based on workout type
  const initialMetric = currentWorkout.type === 'strength' ? 'volume' : 'pace';
  const [selectedMetric, setSelectedMetric] = useState<'pace' | 'distance' | 'volume'>(initialMetric);
  const [granularity, setGranularity] = useState<'workout' | 'week'>('workout'); // New state for granularity

  // --- Determine which graph to show --- 
  const showDetailedRunGraph = useMemo(() => {
    return currentWorkout.type === 'running' && 
           Array.isArray(currentWorkout.records) && 
           currentWorkout.records.length > 1; // Need at least 2 points for a line
  }, [currentWorkout]);

  // --- Data Processing for Detailed Run Graph --- 
  const runRecordsData: RunRecordItem[] = useMemo(() => {
    if (!showDetailedRunGraph) return [];

    const records = currentWorkout.records!;
    const startTime = new Date(records[0].timestamp).getTime();
    let processedRecords: RunRecordItem[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const currentTime = new Date(record.timestamp).getTime();
      const elapsedTime = (currentTime - startTime) / 1000; // Elapsed seconds

      let pace: number | null = null;

      // Option 1: Use speed directly if available
      if (record.speed !== undefined && record.speed !== null && record.speed > 0) {
        pace = calculatePaceFromSpeed(record.speed);
      } 
      // Option 2: Calculate speed/pace from distance & time delta (if speed is missing/invalid)
      else if (i > 0) {
        const prevRecord = records[i - 1];
        const prevTime = new Date(prevRecord.timestamp).getTime();
        const deltaTime = (currentTime - prevTime) / 1000; // seconds
        
        // Use cumulative distance if available
        if (record.distance !== undefined && record.distance !== null && 
            prevRecord.distance !== undefined && prevRecord.distance !== null) {
          const deltaDistance = record.distance - prevRecord.distance; // meters
          if (deltaTime > 0 && deltaDistance >= 0) {
            const speed = deltaDistance / deltaTime; // m/s
            if (speed > 0) {
              pace = calculatePaceFromSpeed(speed);
            }
          }
        }
      }

      processedRecords.push({
        time: elapsedTime,
        pace: pace,
        heartRate: record.heart_rate ?? null,
      });
    }
    
    // Filter out potential initial points with null pace if derived
    return processedRecords.filter((r, index) => index === 0 || r.pace !== null);

  }, [currentWorkout, showDetailedRunGraph]);

  // --- Data Processing & State for Historical Graph (Conditional) --- 
  const historicalChartData: ChartDataItem[] = useMemo(() => {
    if (showDetailedRunGraph) return []; // Don't process if showing detailed graph
    
    const allWorkoutsRaw = [currentWorkout, ...historyData];
    const now = new Date();
    const allWorkouts = allWorkoutsRaw.map(w => ({...w, date: new Date(w.date)})).filter(w => isValid(w.date));
    let startDate: Date;
    const endDate = now;
    if (timeFilter === 'all') {
        startDate = allWorkouts.length > 0 ? allWorkouts.reduce((earliest, w) => w.date < earliest ? w.date : earliest, allWorkouts[0].date) : now;
        startDate = subDays(startDate, 1); 
    } else if (timeFilter === '2w') startDate = subDays(now, 14);
    else if (timeFilter === '1m') startDate = subMonths(now, 1);
    else startDate = subMonths(now, 3); // 3m
    const timeFilteredWorkouts = allWorkouts.filter(w => w.date >= startDate && w.date <= endDate);
    let mappedData: MappedDataItem[] = [];
    if (granularity === 'week') {
        const adjustedStartDate = startOfWeek(startDate, { weekStartsOn: 1 }); 
        const intervalWeeks = eachWeekOfInterval({ start: adjustedStartDate, end: endDate }, { weekStartsOn: 1 });
        mappedData = intervalWeeks.map(weekStartDate => {
            const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
            const workoutsInWeek = timeFilteredWorkouts.filter(w => isWithinInterval(w.date, { start: weekStartDate, end: weekEndDate }));
            let value: number | null = null;
            if (selectedMetric === 'volume' && currentWorkout.type === 'strength') {
                value = workoutsInWeek.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0);
            } else if (selectedMetric === 'distance') {
                value = workoutsInWeek.reduce((sum, w) => sum + (w.distance ?? w.cardioDetails?.distance ?? 0), 0);
            } else if (selectedMetric === 'pace') {
                const totalDuration = workoutsInWeek.reduce((sum, w) => sum + (w.duration || 0), 0);
                const totalDistance = workoutsInWeek.reduce((sum, w) => sum + (w.distance ?? w.cardioDetails?.distance ?? 0), 0);
                value = (totalDistance > 0 && totalDuration > 0) ? (totalDuration / totalDistance) / 60 : null;
            }
            if (workoutsInWeek.length === 0 && selectedMetric !== 'pace') value = 0;
            return { date: weekStartDate, dateLabel: format(weekStartDate, 'MMM d'), value: value };
        });
    } else {
      mappedData = timeFilteredWorkouts.map(w => {
          let value: number | null = null;
          const workoutDate = new Date(w.date);
          if (selectedMetric === 'pace') value = w.cardioDetails?.pace ?? null; 
          else if (selectedMetric === 'distance') value = w.distance ?? w.cardioDetails?.distance ?? null;
          else if (selectedMetric === 'volume') value = w.calculatedVolume ?? null;
          if (value === null && selectedMetric === 'distance') value = 0;
          if (value === null && selectedMetric === 'volume') value = 0;
          return { date: workoutDate, dateLabel: format(workoutDate, 'MMM d'), value: value, isCurrent: w._id === currentWorkout._id };
        });
    }
    const chartData = mappedData.filter((item): item is ChartDataItem => item.value !== null);
    return chartData.sort((a, b) => a.date.getTime() - b.date.getTime());

  }, [currentWorkout, historyData, timeFilter, selectedMetric, granularity, showDetailedRunGraph]);

  const historicalMetricLabel = useMemo(() => {
    if (showDetailedRunGraph) return ''; // Don't calculate if showing detailed graph
    const baseLabel = selectedMetric === 'pace' ? 'Avg Pace (min/km)' : selectedMetric === 'distance' ? 'Distance (km)' : selectedMetric === 'volume' ? 'Total Volume (kg)' : 'Progress';
    const prefix = (granularity === 'week' && selectedMetric !== 'pace') ? 'Weekly ' : '';
    return `${prefix}${baseLabel}`;
  }, [selectedMetric, granularity, showDetailedRunGraph]);

  const historicalLowerIsBetter = selectedMetric === 'pace';

  const historicalYDomain: [number | string, number | string] = useMemo(() => {
    if (showDetailedRunGraph) return [0, 'auto']; // Don't calculate if showing detailed graph
    const values = historicalChartData.map(d => d.value);
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 1;
    const lowerBound = Math.min(0, minVal);
    const padding = (maxVal - lowerBound) * 0.05 || 1;
    if (historicalLowerIsBetter) {
        return [Math.max(0, minVal - padding), maxVal + padding]; 
    } else {
        return [lowerBound, maxVal + padding];
    }
  }, [historicalChartData, historicalLowerIsBetter, showDetailedRunGraph]);

  // --- Render Logic --- 
  if (!currentWorkout) {
    return <p className="text-center text-muted-foreground">Loading workout data...</p>;
  }

  const isCardio = currentWorkout.type !== 'strength';
  const isStrength = currentWorkout.type === 'strength';

  return (
    <div className="w-full h-[300px]">
      {showDetailedRunGraph ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={runRecordsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis 
              dataKey="time" 
              tickFormatter={formatTimeTick} 
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            {/* Pace Y-Axis (Left) */}
            <YAxis 
              yAxisId="left" 
              orientation="left" 
              stroke="hsl(var(--chart-1))" 
              fontSize={10}
              tickFormatter={formatPaceTick}
              reversed={true} // Lower pace is better
              domain={['dataMin - 0.5', 'dataMax + 0.5']} // Add padding
              allowDecimals={false} // Format pace handles decimals
            />
            {/* Heart Rate Y-Axis (Right) */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="hsl(var(--chart-2))" 
              fontSize={10}
              tickFormatter={formatHrTick}
              domain={['dataMin - 5', 'dataMax + 5']} // Add padding
              allowDecimals={false}
            />
            <Tooltip content={<CustomRunTooltip />} />
            <Legend verticalAlign="top" height={36}/>
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="pace" 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2} 
              dot={false} 
              connectNulls // Connect gaps in pace data
              name="Pace (min/km)" // Legend name
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="heartRate" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2} 
              dot={false}
              connectNulls // Connect gaps in HR data
              name="Heart Rate (bpm)" // Legend name
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            {/* Metric Selection */} 
            <ToggleGroup 
              type="single" 
              value={selectedMetric} 
              onValueChange={(value) => value && setSelectedMetric(value as any)}
              className="h-7"
              size="sm"
            >
              {currentWorkout.type !== 'strength' && <ToggleGroupItem value="pace">Pace</ToggleGroupItem>}
              {currentWorkout.type !== 'strength' && <ToggleGroupItem value="distance">Distance</ToggleGroupItem>}
              {currentWorkout.type === 'strength' && <ToggleGroupItem value="volume">Volume</ToggleGroupItem>}
            </ToggleGroup>
            
            {/* Granularity Selection */} 
            <ToggleGroup 
              type="single" 
              value={granularity} 
              onValueChange={(value) => value && setGranularity(value as any)}
              className="h-7"
              size="sm"
            >
              <ToggleGroupItem value="workout">Per Workout</ToggleGroupItem>
              <ToggleGroupItem value="week">Weekly</ToggleGroupItem>
            </ToggleGroup>

            {/* Time Filter Buttons */}
            <div className="flex space-x-1">
              {(['2w', '1m', '3m', 'all'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={timeFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFilter(filter)}
                  className="h-7 px-2 text-xs"
                >
                  {filter.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          
          {historicalChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={historicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                <XAxis 
                  dataKey="dateLabel" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={'preserveStartEnd'} 
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis 
                  fontSize={10} 
                  strokeWidth={0} 
                  domain={historicalYDomain}
                  tickFormatter={selectedMetric === 'pace' ? formatPaceTick : undefined}
                  reversed={historicalLowerIsBetter}
                />
                <Tooltip content={<CustomTooltip metricLabel={historicalMetricLabel} granularity={granularity} />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={renderCustomDot} // Use custom dot
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Not enough data for {timeFilter !== 'all' ? `the selected time period (${timeFilter.toUpperCase()})` : 'this metric'}.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkoutProgressGraph; 