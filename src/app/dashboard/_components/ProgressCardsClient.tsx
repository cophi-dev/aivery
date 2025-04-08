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
const formatDistance = (distance: number | undefined | null): string | null => {
  if (distance === undefined || distance === null || distance <= 0) return null;
  // Format to 1 decimal place
  return `${distance.toFixed(1)} km`;
};
// -----------------------------------------

interface ProgressCardsProps {
  strengthVolume: number;
  cardioDistance: number;
}

export function ProgressCards({ strengthVolume, cardioDistance }: ProgressCardsProps) {
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
          <CardDescription>Running Distance (Last 7 Days)</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-3xl font-bold">{formatDistance(cardioDistance) ?? "0 km"}</p>
          {/* <p className="text-sm text-muted-foreground">+Y% from last week</p> */}
        </CardContent>
      </Card>
    </div>
  );
} 