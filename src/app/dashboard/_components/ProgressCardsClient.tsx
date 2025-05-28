'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, HeartPulse, TrendingDown, TrendingUp, Bike, Waves, Footprints, Target } from "lucide-react";
import { formatDuration } from "@/lib/utils"
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

// Simple progress bar component
const ProgressBar = ({ value, max, className }: { value: number; max: number; className?: string }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  return (
    <div className={cn("w-full bg-muted rounded-full h-2", className)}>
      <div
        className="h-2 rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// Clean trend indicator component
const TrendIndicator = ({ change, large = false }: { change: number; large?: boolean }) => {
  const size = large ? "h-5 w-5" : "h-4 w-4";
  const textSize = large ? "text-base" : "text-sm";
  
  if (change > 0) {
    return (
      <div className="flex items-center gap-1">
        <TrendingUp className={cn(size, "text-emerald-600")} />
        <span className={cn(textSize, "text-emerald-600 font-medium")}>
          +{Math.abs(change).toFixed(1)}%
        </span>
      </div>
    );
  } else if (change < 0) {
    return (
      <div className="flex items-center gap-1">
        <TrendingDown className={cn(size, "text-red-600")} />
        <span className={cn(textSize, "text-red-600 font-medium")}>
          -{Math.abs(change).toFixed(1)}%
        </span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1">
        <div className={cn(size, "flex items-center justify-center")}>
          <div className="w-3 h-0.5 bg-muted-foreground rounded-full" />
        </div>
        <span className={cn(textSize, "text-muted-foreground font-medium")}>
          0%
        </span>
      </div>
    );
  }
};

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
  const formattedDuration = `${minutes} minutes`;

  // Format exercise-specific distances
  const formattedRunningDistance = formatDistance(runningDistance);
  const formattedSwimmingDistance = formatDistance(swimmingDistance);
  const formattedBikingDistance = formatDistance(bikingDistance);

  // Calculate overall distance for backward compatibility
  if (runningDistance === 0 && swimmingDistance === 0 && bikingDistance === 0 && cardioDistance) {
    runningDistance = cardioDistance;
    runningDistancePrevious = cardioDistancePrevious || 0;
  }
  
  const formattedDistance = formatDistance(cardioDistance);

  // Calculate percentage changes
  const volumeChange = calculateChange(strengthVolume, strengthVolumePrevious);
  const durationChange = calculateChange(cardioDuration, cardioDurationPrevious);
  const distanceChange = cardioDistance && cardioDistancePrevious ? 
    calculateChange(cardioDistance, cardioDistancePrevious) : 0;
    
  // Calculate exercise-specific percentage changes
  const runningDistanceChange = calculateChange(runningDistance, runningDistancePrevious);
  const swimmingDistanceChange = calculateChange(swimmingDistance, swimmingDistancePrevious);
  const bikingDistanceChange = calculateChange(bikingDistance, bikingDistancePrevious);

  // Check if we should show specific exercise metrics
  const showRunningMetrics = runningDistance > 0 || runningDistancePrevious > 0;
  const showSwimmingMetrics = swimmingDistance > 0 || swimmingDistancePrevious > 0;
  const showBikingMetrics = bikingDistance > 0 || bikingDistancePrevious > 0;

  return (
    <div className="space-y-6">
      {/* Main Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strength Progress Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Strength Training</CardTitle>
                  <CardDescription>Total volume this week</CardDescription>
                </div>
              </div>
              <TrendIndicator change={volumeChange} large />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{formattedVolume}</span>
              <span className="text-sm text-muted-foreground">lifted</span>
            </div>
            
            {strengthVolumePrevious > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress vs last week</span>
                  <span>{formatVolume(strengthVolumePrevious)}</span>
                </div>
                <ProgressBar 
                  value={strengthVolume} 
                  max={Math.max(strengthVolume, strengthVolumePrevious)} 
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cardio Progress Card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <HeartPulse className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Cardio Training</CardTitle>
                  <CardDescription>Total time this week</CardDescription>
                </div>
              </div>
              <TrendIndicator change={durationChange} large />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{minutes}</span>
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            
            {cardioDurationPrevious > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress vs last week</span>
                  <span>{Math.floor(cardioDurationPrevious / 60)} min</span>
                </div>
                <ProgressBar 
                  value={cardioDuration} 
                  max={Math.max(cardioDuration, cardioDurationPrevious)} 
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity-Specific Distance Cards */}
      {(showRunningMetrics || showSwimmingMetrics || showBikingMetrics) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Activity Breakdown
            </CardTitle>
            <CardDescription>Distance covered by activity type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Running */}
              {showRunningMetrics && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <Footprints className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Running</p>
                      <p className="text-lg font-bold">{formattedRunningDistance || "0 km"}</p>
                    </div>
                  </div>
                  <TrendIndicator change={runningDistanceChange} />
                </div>
              )}

              {/* Swimming */}
              {showSwimmingMetrics && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Waves className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Swimming</p>
                      <p className="text-lg font-bold">{formattedSwimmingDistance || "0 km"}</p>
                    </div>
                  </div>
                  <TrendIndicator change={swimmingDistanceChange} />
                </div>
              )}

              {/* Biking */}
              {showBikingMetrics && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                      <Bike className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Cycling</p>
                      <p className="text-lg font-bold">{formattedBikingDistance || "0 km"}</p>
                    </div>
                  </div>
                  <TrendIndicator change={bikingDistanceChange} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 