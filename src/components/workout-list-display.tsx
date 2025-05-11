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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
            <span className="font-semibold text-sm text-card-foreground break-words max-w-full">
              {new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}: {workout.name || workout.type}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize mt-1 sm:mt-0">
              {workout.type}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex justify-between sm:block">
              <span className="font-medium">Duration:</span>{' '}
              <span className="ml-1">{workout.duration ? formatDuration(workout.duration) : 'N/A'}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="font-medium">Distance:</span>{' '}
              <span className="ml-1">{workout.distance ? formatDistance(workout.distance) : 'N/A'}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="font-medium">Calories:</span>{' '}
              <span className="ml-1">{workout.calories ? `${Math.round(workout.calories)} kcal` : 'N/A'}</span>
            </div>
          </div>
          {workout.notes && (
            <p className="mt-1 text-xs text-muted-foreground italic break-words">
              Notes: {workout.notes}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
} 