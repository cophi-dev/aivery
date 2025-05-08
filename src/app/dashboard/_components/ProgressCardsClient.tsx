'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, HeartPulse, TrendingDown, TrendingUp, Bike, Waves, Footprints } from "lucide-react";
import { formatDuration } from "@/lib/utils"

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
  // Log detailed calculation info for debugging
  console.log(`calculateChange: current=${current}, previous=${previous}`);
  
  // Minimum threshold for previous week to show percentage (5 minutes in seconds)
  const MINIMUM_PREVIOUS_THRESHOLD = 300; 
  
  // If previous is too small or zero but current is significant
  if (previous < MINIMUM_PREVIOUS_THRESHOLD && current > MINIMUM_PREVIOUS_THRESHOLD) {
    console.log(`Previous value (${previous}) too small to calculate meaningful percentage`);
    return current > previous ? 100 : -100; // Cap at 100% increase or decrease
  }
  
  // When both are essentially zero or equal, return 0
  if ((previous < MINIMUM_PREVIOUS_THRESHOLD && current < MINIMUM_PREVIOUS_THRESHOLD) || 
      Math.abs(current - previous) < 1) {
    console.log("Values are effectively equal or both negligible, returning 0%");
    return 0;
  }
  
  // Percentage difference as a fraction of the average of the two values
  // This avoids extreme percentages when previous is small but not zero
  if (previous < current / 5) { // If previous is less than 20% of current
    console.log("Previous value too small compared to current, capping at 100%");
    return 100;
  }
  
  // Normal percentage calculation
  const percentChange = ((current - previous) / previous) * 100;
  
  // Cap extreme values
  if (Math.abs(percentChange) > 200) {
    console.log(`Capping extreme percentage: ${percentChange.toFixed(2)}% -> ${percentChange > 0 ? 200 : -200}%`);
    return percentChange > 0 ? 200 : -200;
  }
  
  console.log(`Calculated percent change: ${percentChange.toFixed(2)}%`);
  return percentChange;
};

// -----------------------------------------

interface ProgressCardsProps {
  strengthVolume: number; // Total volume in kg
  cardioDuration: number; // Duration in seconds
  cardioDistance?: number; // Distance in meters
  strengthVolumePrevious: number;
  cardioDurationPrevious: number;
  cardioDistancePrevious?: number;
  // New props for different cardio types
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
  // Use the new props with default values to handle backward compatibility
  runningDistance = 0,
  swimmingDistance = 0,
  bikingDistance = 0,
  runningDistancePrevious = 0,
  swimmingDistancePrevious = 0,
  bikingDistancePrevious = 0
}: ProgressCardsProps) {
  // Add specific debug info for cardio durations
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
  // If specific distances are not provided, use the general cardioDistance
  if (runningDistance === 0 && swimmingDistance === 0 && bikingDistance === 0 && cardioDistance) {
    // For backward compatibility, treat all distance as running if specific types aren't provided
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

  // Check if we should show specific exercise metrics (non-zero in current or previous period)
  const showRunningMetrics = runningDistance > 0 || runningDistancePrevious > 0;
  const showSwimmingMetrics = swimmingDistance > 0 || swimmingDistancePrevious > 0;
  const showBikingMetrics = bikingDistance > 0 || bikingDistancePrevious > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Strength Progress Card */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg flex items-center justify-center">
            <Dumbbell className="mr-2 h-5 w-5 text-primary" /> Strength Progress
          </CardTitle>
          <CardDescription>Total Volume (Last 7 Days)</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-3xl font-bold">{formattedVolume}</p>
          <div className="flex items-center justify-center mt-2 text-sm">
            {/* Always display volume change indicator */}
            {volumeChange > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : volumeChange < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            ) : (
              <span className="h-4 w-4 mr-1">―</span>
            )}
            <span className={
              volumeChange > 0 ? "text-green-500" : 
              volumeChange < 0 ? "text-red-500" : 
              "text-muted-foreground"
            }>
              {volumeChange !== 0 ? `${Math.abs(volumeChange).toFixed(1)}%` : "0%"} from previous week
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cardio Progress Card */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg flex items-center justify-center">
            <HeartPulse className="mr-2 h-5 w-5 text-accent" /> Cardio Progress
          </CardTitle>
          <CardDescription>Total Time (Last 7 Days)</CardDescription>
        </CardHeader>
        <CardContent className="text-center flex flex-col items-center gap-2">
          <p className="text-3xl font-bold">{formattedDuration}</p>
          <div className="flex items-center justify-center mt-2 text-sm">
            {/* Always display duration change indicator, including when there's no change */}
            {durationChange > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : durationChange < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            ) : (
              <span className="h-4 w-4 mr-1">―</span>
            )}
            <span className={
              durationChange > 0 ? "text-green-500" : 
              durationChange < 0 ? "text-red-500" : 
              "text-muted-foreground"
            }>
              {durationChange !== 0 ? `${Math.abs(durationChange).toFixed(1)}%` : "0%"} from previous week
            </span>
          </div>
          
          {/* Display exercise-specific distances */}
          <div className="flex flex-col items-center space-y-2 mt-1 text-muted-foreground">
            {/* Running distance */}
            {showRunningMetrics && formattedRunningDistance && (
              <div className="flex flex-col items-center">
                <div className="flex items-center">
                  <Footprints className="h-4 w-4 mr-1" />
                  <span>{formattedRunningDistance}</span>
                </div>
                <div className="flex items-center text-sm mt-1">
                  {runningDistanceChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : runningDistanceChange < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <span className="h-3 w-3 mr-1">―</span>
                  )}
                  <span className={
                    runningDistanceChange > 0 ? "text-green-500" : 
                    runningDistanceChange < 0 ? "text-red-500" : 
                    "text-muted-foreground"
                  }>
                    {runningDistanceChange !== 0 ? `${Math.abs(runningDistanceChange).toFixed(1)}%` : "0%"}
                  </span>
                </div>
              </div>
            )}
            
            {/* Swimming distance */}
            {showSwimmingMetrics && formattedSwimmingDistance && (
              <div className="flex flex-col items-center">
                <div className="flex items-center">
                  <Waves className="h-4 w-4 mr-1" />
                  <span>{formattedSwimmingDistance}</span>
                </div>
                <div className="flex items-center text-sm mt-1">
                  {swimmingDistanceChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : swimmingDistanceChange < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <span className="h-3 w-3 mr-1">―</span>
                  )}
                  <span className={
                    swimmingDistanceChange > 0 ? "text-green-500" : 
                    swimmingDistanceChange < 0 ? "text-red-500" : 
                    "text-muted-foreground"
                  }>
                    {swimmingDistanceChange !== 0 ? `${Math.abs(swimmingDistanceChange).toFixed(1)}%` : "0%"}
                  </span>
                </div>
              </div>
            )}
            
            {/* Biking distance */}
            {showBikingMetrics && formattedBikingDistance && (
              <div className="flex flex-col items-center">
                <div className="flex items-center">
                  <Bike className="h-4 w-4 mr-1" />
                  <span>{formattedBikingDistance}</span>
                </div>
                <div className="flex items-center text-sm mt-1">
                  {bikingDistanceChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : bikingDistanceChange < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <span className="h-3 w-3 mr-1">―</span>
                  )}
                  <span className={
                    bikingDistanceChange > 0 ? "text-green-500" : 
                    bikingDistanceChange < 0 ? "text-red-500" : 
                    "text-muted-foreground"
                  }>
                    {bikingDistanceChange !== 0 ? `${Math.abs(bikingDistanceChange).toFixed(1)}%` : "0%"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 