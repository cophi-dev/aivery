'use client';

import { Dumbbell, HeartPulse, TrendingDown, TrendingUp, Bike, Waves, Footprints } from "lucide-react";
import { cn } from '@/lib/utils';

// --- Formatting Helpers (defined locally) ---
// Format volume (assuming kg)
const formatVolume = (volume: number | undefined | null): string | null => {
  if (volume === undefined || volume === null || volume <= 0) return null;
  // Convert to tons and format with one decimal place
  const tons = volume / 1000;
  return `${tons.toFixed(1)} tons`;
};

// Format distance (in meters)
const formatDistance = (meters: number | undefined | null): string | null => {
  if (meters === undefined || meters === null || meters <= 0) return null;
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
};

// Calculate percentage change
const calculateChange = (current: number, previous: number): number => {
  console.log(`calculateChange: current=${current}, previous=${previous}`);
  
  const MINIMUM_PREVIOUS_THRESHOLD = 300; 
  
  if (previous < MINIMUM_PREVIOUS_THRESHOLD && current > MINIMUM_PREVIOUS_THRESHOLD) {
    console.log(`Previous value (${previous}) too small to calculate meaningful percentage`);
    return current > previous ? 100 : -100;
  }
  
  if ((previous < MINIMUM_PREVIOUS_THRESHOLD && current < MINIMUM_PREVIOUS_THRESHOLD) || 
      Math.abs(current - previous) < 1) {
    console.log("Values are effectively equal or both negligible, returning 0%");
    return 0;
  }
  
  if (previous < current / 5) {
    console.log("Previous value too small compared to current, capping at 100%");
    return 100;
  }
  
  const percentChange = ((current - previous) / previous) * 100;
  
  if (Math.abs(percentChange) > 200) {
    console.log(`Capping extreme percentage: ${percentChange.toFixed(2)}% -> ${percentChange > 0 ? 200 : -200}%`);
    return percentChange > 0 ? 200 : -200;
  }
  
  console.log(`Calculated percent change: ${percentChange.toFixed(2)}%`);
  return percentChange;
};

// Clean trend indicator component
const TrendIndicator = ({ change }: { change: number }) => {
  if (change > 0) {
    return (
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <span className="text-body-sm text-emerald-600 font-medium">
          +{Math.abs(change).toFixed(1)}%
        </span>
      </div>
    );
  } else if (change < 0) {
    return (
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-red-600" />
        <span className="text-body-sm text-red-600 font-medium">
          -{Math.abs(change).toFixed(1)}%
        </span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 flex items-center justify-center">
          <div className="w-3 h-0.5 bg-neutral-400 rounded-full" />
        </div>
        <span className="text-body-sm text-neutral-500 font-medium">
          No change
        </span>
      </div>
    );
  }
};

// Minimalist metric card
const MetricCard = ({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  subtitle 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  change: number; 
  subtitle?: string;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        <Icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
      </div>
      <div className="flex-1">
        <h3 className="text-heading-sm font-medium text-foreground">{label}</h3>
        <p className="text-body-sm text-neutral-600">{subtitle || "Last 7 days"}</p>
      </div>
    </div>
    
    <div className="pl-13 space-y-2">
      <div className="text-display-sm font-display text-foreground tracking-tight">
        {value}
      </div>
      <TrendIndicator change={change} />
    </div>
  </div>
);

interface ProgressCardsProps {
  strengthVolume: number;
  cardioDuration: number;
  cardioDistance?: number;
  strengthVolumePrevious: number;
  cardioDurationPrevious: number;
  cardioDistancePrevious?: number;
  runningDistance?: number;
  swimmingDistance?: number;
  bikingDistance?: number;
  runningDistancePrevious?: number;
  swimmingDistancePrevious?: number;
  bikingDistancePrevious?: number;
}

export function ProgressCards({ 
  strengthVolume, 
  cardioDuration, 
  cardioDistance,
  strengthVolumePrevious,
  cardioDurationPrevious,
  cardioDistancePrevious,
  runningDistance = 0,
  swimmingDistance = 0,
  bikingDistance = 0,
  runningDistancePrevious = 0,
  swimmingDistancePrevious = 0,
  bikingDistancePrevious = 0
}: ProgressCardsProps) {
  
  console.log("==== CARDIO DURATION DETAILS ====");
  console.log(`Current week: ${cardioDuration} seconds (${Math.floor(cardioDuration / 60)} minutes)`);
  console.log(`Previous week: ${cardioDurationPrevious} seconds (${Math.floor(cardioDurationPrevious / 60)} minutes)`);
  console.log(`Raw percentage: ${cardioDurationPrevious > 0 ? ((cardioDuration - cardioDurationPrevious) / cardioDurationPrevious * 100).toFixed(2) : 'N/A (prev = 0)'}`);
  console.log("================================");
  
  // Calculate formatted values
  const formattedVolume = formatVolume(strengthVolume) ?? "0 tons";
  const minutes = Math.floor(cardioDuration / 60);
  const formattedDuration = `${minutes} min`;

  // Format exercise-specific distances
  const formattedRunningDistance = formatDistance(runningDistance);
  const formattedSwimmingDistance = formatDistance(swimmingDistance);
  const formattedBikingDistance = formatDistance(bikingDistance);

  // Calculate overall distance for backward compatibility
  if (runningDistance === 0 && swimmingDistance === 0 && bikingDistance === 0 && cardioDistance) {
    runningDistance = cardioDistance;
    runningDistancePrevious = cardioDistancePrevious || 0;
  }

  // Calculate percentage changes
  const volumeChange = calculateChange(strengthVolume, strengthVolumePrevious);
  const durationChange = calculateChange(cardioDuration, cardioDurationPrevious);
    
  // Calculate exercise-specific percentage changes
  const runningDistanceChange = calculateChange(runningDistance, runningDistancePrevious);
  const swimmingDistanceChange = calculateChange(swimmingDistance, swimmingDistancePrevious);
  const bikingDistanceChange = calculateChange(bikingDistance, bikingDistancePrevious);

  // Check if we should show specific exercise metrics
  const showRunningMetrics = runningDistance > 0 || runningDistancePrevious > 0;
  const showSwimmingMetrics = swimmingDistance > 0 || swimmingDistancePrevious > 0;
  const showBikingMetrics = bikingDistance > 0 || bikingDistancePrevious > 0;

  // Prepare metrics to display
  const metrics = [
    {
      icon: Dumbbell,
      label: "Strength Volume",
      value: formattedVolume,
      change: volumeChange,
      subtitle: "Total weight lifted"
    },
    {
      icon: HeartPulse,
      label: "Cardio Duration",
      value: formattedDuration,
      change: durationChange,
      subtitle: "Active time"
    }
  ];

  // Add specific cardio metrics if available
  if (showRunningMetrics && formattedRunningDistance) {
    metrics.push({
      icon: Footprints,
      label: "Running",
      value: formattedRunningDistance,
      change: runningDistanceChange,
      subtitle: "Distance covered"
    });
  }

  if (showBikingMetrics && formattedBikingDistance) {
    metrics.push({
      icon: Bike,
      label: "Cycling",
      value: formattedBikingDistance,
      change: bikingDistanceChange,
      subtitle: "Distance covered"
    });
  }

  if (showSwimmingMetrics && formattedSwimmingDistance) {
    metrics.push({
      icon: Waves,
      label: "Swimming",
      value: formattedSwimmingDistance,
      change: swimmingDistanceChange,
      subtitle: "Distance covered"
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
} 