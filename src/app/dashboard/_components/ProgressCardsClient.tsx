'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, HeartPulse, Route } from "lucide-react";

// --- Formatting Helpers (defined locally) ---
// Format volume (assuming kg)
const formatVolume = (volume: number | undefined | null): string | null => {
  if (volume === undefined || volume === null || volume <= 0) return null;
  // Format with commas for thousands
  return `${Math.round(volume).toLocaleString()} kg`;
};

// Format distance (handling both meters and km appropriately)
const formatDistance = (meters: number | undefined | null): string => {
  console.log('[ProgressCards] Formatting distance:', meters);
  
  // Handle undefined, null, or negative values
  if (meters === undefined || meters === null || meters <= 0) {
    return "0 m"; // Show as meters for zero
  }
  
  // For small distances (less than 1000m), show in meters
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  
  // For larger distances, convert to km and format to 1 decimal place
  const km = meters / 1000;
  
  // Log to verify the conversion is happening correctly
  console.log(`[ProgressCards] Converting ${meters}m to ${km.toFixed(1)}km`);
  
  return `${km.toFixed(1)} km`;
};

// Format duration (assuming input is in seconds)
const formatDuration = (seconds: number | undefined | null): string | null => {
  console.log('[ProgressCards] Formatting duration:', seconds, 'seconds');
  
  if (seconds === undefined || seconds === null || seconds <= 0) return null;
  
  // Convert seconds to hours and minutes
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  console.log('[ProgressCards] Duration converted to:', { hours, remainingMinutes });
  
  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h`;
  }
  if (remainingMinutes > 0 || hours === 0) {
    formatted += `${hours > 0 ? ' ' : ''}${remainingMinutes}m`;
  }
  return formatted.trim();
};
// -----------------------------------------

interface ProgressCardsProps {
  strengthVolume: number;
  cardioDuration: number;
  cardioDistance?: number; // Added optional distance
}

export function ProgressCards({ strengthVolume, cardioDuration, cardioDistance }: ProgressCardsProps) {
  // Determine if we should show distance alongside duration
  const hasCardioDistance = cardioDistance !== undefined && cardioDistance !== null && cardioDistance > 0;
  
  // Debug values
  console.log('[ProgressCards] Received props:', { strengthVolume, cardioDuration, cardioDistance });
  console.log('[ProgressCards] Raw cardioDistance:', cardioDistance);
  console.log('[ProgressCards] Kilometers (raw / 1000):', (cardioDistance || 0) / 1000);
  console.log('[ProgressCards] Formatted duration:', formatDuration(cardioDuration));
  console.log('[ProgressCards] Formatted distance:', formatDistance(cardioDistance));
  console.log('[ProgressCards] Display distance:', hasCardioDistance);
  
  // For testing, calculate a raw km value
  const distanceInKm = (cardioDistance || 0) / 1000;
  const formattedKm = `${distanceInKm.toFixed(1)} km`;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {/* Strength Progress Card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg flex items-center justify-center">
            <Dumbbell className="mr-2 h-5 w-5 text-primary" /> Strength Progress
          </CardTitle>
          <CardDescription>Total Volume (Last 7 Days)</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-3xl font-bold">{formatVolume(strengthVolume) ?? "0 kg"}</p>
          {/* Placeholder for comparison, could be passed as prop if calculated server-side */}
          {/* <p className="text-sm text-muted-foreground">+X% from last week</p> */}
        </CardContent>
      </Card>

      {/* Cardio Progress Card */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg flex items-center justify-center">
            <HeartPulse className="mr-2 h-5 w-5 text-red-500" /> Cardio Progress
          </CardTitle>
          <CardDescription>Total Time (Last 7 Days)</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-3xl font-bold">{formatDuration(cardioDuration) ?? "0m"}</p>
          
          {/* Always show the distance element */}
          <p className="text-md text-muted-foreground mt-1 flex items-center justify-center">
            <Route className="h-4 w-4 mr-1" />
            {formattedKm}
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 