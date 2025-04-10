'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, HeartPulse } from "lucide-react";

// --- Formatting Helpers (defined locally) ---
// Format volume (assuming kg)
const formatVolume = (volume: number | undefined | null): string | null => {
  if (volume === undefined || volume === null || volume <= 0) return null;
  // Format with commas for thousands
  return `${Math.round(volume).toLocaleString()} kg`;
};

// Format distance (assuming km)
// const formatDistance = (distance: number | undefined | null): string | null => {
//   if (distance === undefined || distance === null || distance <= 0) return null;
//   // Format to 1 decimal place
//   return `${distance.toFixed(1)} km`;
// };

// Format duration (assuming input is in minutes)
const formatDuration = (minutes: number | undefined | null): string | null => {
  if (minutes === undefined || minutes === null || minutes <= 0) return null;
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h`;
  }
  if (remainingMinutes > 0) {
    formatted += ` ${remainingMinutes}m`;
  }
  return formatted.trim() || "0m"; // Return "0m" if total duration rounds to 0
};
// -----------------------------------------

interface ProgressCardsProps {
  strengthVolume: number;
  cardioDuration: number; // Changed from cardioDistance
}

export function ProgressCards({ strengthVolume, cardioDuration }: ProgressCardsProps) {
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
          {/* <p className="text-sm text-muted-foreground">+Y% from last week</p> */}
        </CardContent>
      </Card>
    </div>
  );
} 