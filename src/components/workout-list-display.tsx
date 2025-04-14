"use client";

import Link from 'next/link';
import { formatDistance, formatDuration } from '@/lib/utils'; // Corrected import path

// Define the structure of a single workout item based on API response
interface WorkoutListItem {
  id: string;
  name: string | null; // Name might be null
  date: string; // ISO Date string
  type: string;
  duration: number | null; // In seconds
  distance: number | null; // In km
  calories: number | null;
  notes: string | null;
}

interface WorkoutListDisplayProps {
  workouts: WorkoutListItem[];
}

export function WorkoutListDisplay({ workouts }: WorkoutListDisplayProps) {
  if (!workouts || workouts.length === 0) {
    return null; // Don't render anything if there are no workouts
  }

  return (
    <div className="mt-2 space-y-3">
      {workouts.map((workout) => (
        <Link
          href={`/workout/${workout.id}`} // Link to individual workout page
          key={workout.id}
          className="block p-3 bg-card border rounded-lg shadow-sm hover:bg-muted/80 transition-colors"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-sm text-card-foreground">
              {new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}: {workout.name || workout.type}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
              {workout.type}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Duration:</span>{' '}
              {workout.duration ? formatDuration(workout.duration) : 'N/A'}
            </div>
            <div>
              <span className="font-medium">Distance:</span>{' '}
              {workout.distance ? formatDistance(workout.distance * 1000) : 'N/A'} {/* Convert km back to meters for formatter */}
            </div>
            <div>
              <span className="font-medium">Calories:</span>{' '}
              {workout.calories ? `${Math.round(workout.calories)} kcal` : 'N/A'}
            </div>
          </div>
          {workout.notes && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              Notes: {workout.notes}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
} 