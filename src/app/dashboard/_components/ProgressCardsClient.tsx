'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, HeartPulse, Route, TrendingDown, TrendingUp } from "lucide-react";
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
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// -----------------------------------------

interface ProgressCardsProps {
  strengthVolume: number; // Total volume in kg
  cardioDuration: number; // Duration in seconds
  cardioDistance?: number; // Distance in meters
  strengthVolumePrevious: number;
  cardioDurationPrevious: number;
  cardioDistancePrevious?: number;
}

export function ProgressCards({ 
  strengthVolume, 
  cardioDuration, 
  cardioDistance,
  strengthVolumePrevious,
  cardioDurationPrevious,
  cardioDistancePrevious
}: ProgressCardsProps) {
  // Calculate formatted values
  const formattedVolume = formatVolume(strengthVolume) ?? "0 tons";
  const minutes = Math.floor(cardioDuration / 60);
  const formattedDuration = `${minutes} minutes`;
  const formattedDistance = formatDistance(cardioDistance);

  // Calculate percentage changes
  const volumeChange = calculateChange(strengthVolume, strengthVolumePrevious);
  const durationChange = calculateChange(cardioDuration, cardioDurationPrevious);
  const distanceChange = cardioDistance && cardioDistancePrevious ? 
    calculateChange(cardioDistance, cardioDistancePrevious) : 0;

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
            {volumeChange !== 0 && (
              <>
                {volumeChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={volumeChange > 0 ? "text-green-500" : "text-red-500"}>
                  {Math.abs(volumeChange).toFixed(1)}% from previous week
                </span>
              </>
            )}
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
          <div className="flex items-center justify-center text-sm">
            {durationChange !== 0 && (
              <>
                {durationChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={durationChange > 0 ? "text-green-500" : "text-red-500"}>
                  {Math.abs(durationChange).toFixed(1)}% from previous week
                </span>
              </>
            )}
          </div>
          {formattedDistance && (
            <div className="flex flex-col items-center text-muted-foreground">
              <div className="flex items-center">
                <Route className="h-4 w-4 mr-1" />
                <span>{formattedDistance}</span>
              </div>
              {distanceChange !== 0 && (
                <div className="flex items-center text-sm mt-1">
                  {distanceChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={distanceChange > 0 ? "text-green-500" : "text-red-500"}>
                    {Math.abs(distanceChange).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 