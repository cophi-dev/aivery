'use client'

import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from 'recharts';
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
const formatPaceTick = (tickValue: number) => {
  const minutes = Math.floor(tickValue);
  const seconds = Math.round((tickValue % 1) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

const WorkoutProgressGraph: React.FC<WorkoutProgressGraphProps> = ({ currentWorkout, historyData }) => {
  // --- State --- 
  const [timeFilter, setTimeFilter] = useState<'2w' | '1m' | '3m' | 'all'>('3m');
  
  // Default metric based on workout type
  const initialMetric = currentWorkout.type === 'strength' ? 'volume' : 'pace';
  const [selectedMetric, setSelectedMetric] = useState<'pace' | 'distance' | 'volume'>(initialMetric);
  const [granularity, setGranularity] = useState<'workout' | 'week'>('workout'); // New state for granularity

  // --- Memoized Data Processing --- 
  const processedData: ChartDataItem[] = useMemo(() => {
    const allWorkoutsRaw = [currentWorkout, ...historyData];
    const now = new Date();
    
    // Ensure dates are valid Date objects
    const allWorkouts = allWorkoutsRaw.map(w => ({...w, date: new Date(w.date)})).filter(w => isValid(w.date));

    // Determine date range for filtering and weekly iteration
    let startDate: Date;
    const endDate = now;
    if (timeFilter === 'all') {
        // Find the earliest workout date if 'all' is selected
        startDate = allWorkouts.length > 0 
            ? allWorkouts.reduce((earliest, w) => w.date < earliest ? w.date : earliest, allWorkouts[0].date)
            : now;
        // Add a small buffer to the start date if 'all' to ensure the first point is included in weekly view
        startDate = subDays(startDate, 1); 
    } else if (timeFilter === '2w') startDate = subDays(now, 14);
    else if (timeFilter === '1m') startDate = subMonths(now, 1);
    else startDate = subMonths(now, 3); // 3m
    
    // Filter workouts by time first
    const timeFilteredWorkouts = allWorkouts.filter(w => w.date >= startDate && w.date <= endDate);

    // --- Debugging Logs (Uncomment in Browser DevTools if needed) ---
    /*
    if (granularity === 'workout' && timeFilter === '3m' && selectedMetric === 'distance') {
        console.log('[WorkoutGraph Debug]');
        console.log('  Time Filter:', timeFilter, 'Metric:', selectedMetric, 'Granularity:', granularity);
        console.log('  Date Range:', startDate, 'to', endDate);
        console.log('  Workouts in Range (' + timeFilteredWorkouts.length + '):', timeFilteredWorkouts);
    }
    */

    let mappedData: MappedDataItem[] = [];

    // --- AGGREGATION LOGIC --- 
    if (granularity === 'week') {
        const adjustedStartDate = startOfWeek(startDate, { weekStartsOn: 1 }); 
        const intervalWeeks = eachWeekOfInterval({ start: adjustedStartDate, end: endDate }, { weekStartsOn: 1 });
        
        // Temporary array to hold weekly data, including nulls for pace
        mappedData = intervalWeeks.map(weekStartDate => {
            const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
            const workoutsInWeek = timeFilteredWorkouts.filter(w => 
                isWithinInterval(w.date, { start: weekStartDate, end: weekEndDate })
            );
            
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
            
            // Ensure 0 for volume/distance if no workouts, pace remains null
            if (workoutsInWeek.length === 0 && selectedMetric !== 'pace') {
                value = 0;
            }
            
            return {
                date: weekStartDate,
                dateLabel: format(weekStartDate, 'MMM d'),
                value: value,
                // isCurrent is not applicable to weekly aggregated data
            };
        });

    } else {
      // Process per workout (granularity === 'workout')
      mappedData = timeFilteredWorkouts
        .map(w => {
          let value: number | null = null;
          const workoutDate = new Date(w.date);
          
          // Assign value based on metric, keeping null if data missing
          if (selectedMetric === 'pace') value = w.pace ?? null; 
          else if (selectedMetric === 'distance') value = w.distance ?? w.cardioDetails?.distance ?? null;
          else if (selectedMetric === 'volume') value = w.calculatedVolume ?? null;
          
          // **Explicitly ensure distance/volume defaults to 0 IF the metric is selected**
          if (value === null && selectedMetric === 'distance') value = 0;
          if (value === null && selectedMetric === 'volume') value = 0;

          return {
            date: workoutDate,
            dateLabel: format(workoutDate, 'MMM d'),
            value: value,
            isCurrent: w._id === currentWorkout._id, 
          };
        });
    }

    // **Filter ONLY null values (which should only be invalid Pace now)**
    const chartData = mappedData.filter((item): item is ChartDataItem => 
        item.value !== null
        // Removed check for isFinite or typeof, assuming mapping produces number | null
    );

    // --- Debugging Logs (Uncomment in Browser DevTools if needed) ---
    /*
    if (granularity === 'workout' && timeFilter === '3m' && selectedMetric === 'distance') {
        console.log('  Final Chart Data:', chartData);
    }
    */

    return chartData.sort((a, b) => a.date.getTime() - b.date.getTime());

  }, [currentWorkout, historyData, timeFilter, selectedMetric, granularity]);

  // --- Dynamic Chart Props --- 
  const metricLabel = useMemo(() => {
    const baseLabel = 
        selectedMetric === 'pace' ? 'Avg Pace (min/km)' // Changed label slightly
      : selectedMetric === 'distance' ? 'Distance (km)'
      : selectedMetric === 'volume' ? 'Total Volume (kg)'
      : 'Progress';
      
    // Add Weekly prefix if granularity is week and metric is distance/volume
    // Pace is already average, so no prefix needed
    const prefix = (granularity === 'week' && selectedMetric !== 'pace') ? 'Weekly ' : '';
      
    return `${prefix}${baseLabel}`;

  }, [selectedMetric, granularity]);

  const lowerIsBetter = selectedMetric === 'pace';

  // --- Render Logic --- 
  if (!currentWorkout) {
    return <p className="text-center text-muted-foreground">Loading workout data...</p>;
  }

  const isCardio = currentWorkout.type !== 'strength';
  const isStrength = currentWorkout.type === 'strength';

  // Adjust Y-axis domain to ensure 0 is included if it's the minimum
  const yDomain: [number | string, number | string] = useMemo(() => {
      const values = processedData.map(d => d.value);
      const minVal = values.length > 0 ? Math.min(...values) : 0;
      const maxVal = values.length > 0 ? Math.max(...values) : 1; // Default max to 1 if no data
      
      const lowerBound = Math.min(0, minVal); // Ensure 0 is included if minVal is positive
      const padding = (maxVal - lowerBound) * 0.05 || 1; // Add 5% padding, minimum 1
      
      if (lowerIsBetter) {
          // For pace, ensure lower bound is slightly below min, upper slightly above max
          return [Math.max(0, minVal - padding), maxVal + padding]; 
      } else {
          // For distance/volume, ensure lower bound is 0 or slightly below min
          return [Math.max(0, lowerBound - padding), maxVal + padding];
      }
  }, [processedData, lowerIsBetter]);

  return (
    <div>
      {/* Filter and Toggle Controls - Moved outside ResponsiveContainer */}
      <div className="flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 mb-4">
        <ToggleGroup type="single" value={timeFilter} onValueChange={(value: '2w' | '1m' | '3m' | 'all') => value && setTimeFilter(value)} size="sm">
          <ToggleGroupItem value="2w">2W</ToggleGroupItem>
          <ToggleGroupItem value="1m">1M</ToggleGroupItem>
          <ToggleGroupItem value="3m">3M</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
        
        <div className="flex gap-4">
          {/* Metric Toggle (Cardio Only) */} 
          {!isStrength && (
            <ToggleGroup type="single" value={selectedMetric} onValueChange={(value: 'pace' | 'distance') => value && setSelectedMetric(value)} size="sm">
              <ToggleGroupItem value="pace">Pace</ToggleGroupItem>
              <ToggleGroupItem value="distance">Distance</ToggleGroupItem>
            </ToggleGroup>
          )}

          {/* Granularity Toggle (All Types) */} 
           <ToggleGroup type="single" value={granularity} onValueChange={(value: 'workout' | 'week') => value && setGranularity(value)} size="sm">
            <ToggleGroupItem value="workout">Per Workout</ToggleGroupItem>
            <ToggleGroupItem value="week">Weekly</ToggleGroupItem> { /* Changed label */ }
          </ToggleGroup>
        </div>
      </div>

      {/* Chart Area */} 
      <div className="h-[250px]"> {/* Maintain height for the chart container */}
        {processedData.length < (granularity === 'week' ? 1 : 2) ? ( // Adjust check for weekly (1 point is ok)
          <div className="flex items-center justify-center h-full">
            <p className="text-center text-muted-foreground">
              Not enough data for the selected period/metric/granularity.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="dateLabel"
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={yDomain}
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--muted-foreground))"
                reversed={lowerIsBetter}
                tickFormatter={selectedMetric === 'pace' ? formatPaceTick : undefined}
                width={40} // Ensure space for Y-axis labels
                allowDecimals={selectedMetric !== 'pace'} // Allow decimals for distance/volume
              />
              <Tooltip 
                content={<CustomTooltip metricLabel={metricLabel} granularity={granularity} />} // Pass granularity to tooltip
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                // Apply custom dot renderer function directly for 'workout' granularity
                dot={granularity === 'workout' ? renderCustomDot : { r: 3, fill: "hsl(var(--primary))" }} 
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }} 
                name={metricLabel}
                connectNulls={false} // Do not connect across gaps in data
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default WorkoutProgressGraph; 