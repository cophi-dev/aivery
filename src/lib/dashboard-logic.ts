import { subWeeks, parseISO, isValid, startOfDay, endOfDay, subDays, format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { getUserWorkoutsByDateRange } from '@/lib/db/repositories/workoutRepository';
import { WeeklyStats, calculateDelta, statsFormatters, type StatsDelta } from './stats';
import type { WorkoutData } from "@/types/db";

// Types for our dashboard components
export interface LastWorkoutData {
  id: string;
  type: string;
  date: string;
  duration?: number; // in seconds
  distance?: number; // in meters or km
  calculatedVolume?: number; // in kg
  cardioDetails?: {
    distance?: number;
    duration?: number;
  };
}

// Re-export types for convenience
export type { WeeklyStats, StatsDelta };

// Helper to get sessions in last N days
export async function getSessionsInLastNDays(days: number = 7): Promise<WorkoutData[]> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return [];
  }

  const today = new Date();
  const startDate = startOfDay(subDays(today, days));
  const endDate = endOfDay(today);

  try {
    const workouts = await getUserWorkoutsByDateRange(user.id, startDate, endDate);
    return workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

// Helper to get last workout
export async function getLastWorkout(): Promise<LastWorkoutData | null> {
  const workouts = await getSessionsInLastNDays(30); // Look back 30 days
  if (workouts.length === 0) return null;
  
  const lastWorkout = workouts[0];
  return {
    id: lastWorkout._id || 'unknown',
    type: lastWorkout.type || 'unknown',
    date: typeof lastWorkout.date === 'string' ? lastWorkout.date : lastWorkout.date.toISOString(),
    duration: lastWorkout.duration,
    distance: lastWorkout.distance,
    calculatedVolume: lastWorkout.calculatedVolume,
    cardioDetails: lastWorkout.cardioDetails
  };
}

/**
 * Get weekly stats in clean format for Progress Pulse
 */
export async function getWeeklyStats(): Promise<{
  current: WeeklyStats;
  previous: WeeklyStats;
  deltas: StatsDelta;
}> {
  const currentWeekWorkouts = await getSessionsInLastNDays(7);
  const allRecentWorkouts = await getSessionsInLastNDays(14);
  
  // Filter previous week data (8-14 days ago)
  const prevWeekWorkouts = allRecentWorkouts.filter(w => {
    const workoutDate = new Date(w.date);
    const sevenDaysAgo = subDays(new Date(), 7);
    const fourteenDaysAgo = subDays(new Date(), 14);
    return workoutDate >= fourteenDaysAgo && workoutDate < sevenDaysAgo;
  });

  // Calculate current week metrics
  const current: WeeklyStats = {
    workouts: currentWeekWorkouts.length,
    duration: Math.round(currentWeekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60), // Convert to minutes
    volume: currentWeekWorkouts.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0),
    distance: currentWeekWorkouts.reduce((sum, w) => {
      // Normalize distance to km
      let distance = w.cardioDetails?.distance || w.distance || 0;
      if (distance > 100) distance = distance / 1000; // Convert meters to km
      return sum + distance;
    }, 0)
  };

  // Calculate previous week metrics
  const previous: WeeklyStats = {
    workouts: prevWeekWorkouts.length,
    duration: Math.round(prevWeekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) / 60), // Convert to minutes
    volume: prevWeekWorkouts.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0),
    distance: prevWeekWorkouts.reduce((sum, w) => {
      let distance = w.cardioDetails?.distance || w.distance || 0;
      if (distance > 100) distance = distance / 1000;
      return sum + distance;
    }, 0)
  };

  const deltas = calculateDelta(current, previous);

  return {
    current,
    previous,
    deltas
  };
}

// Legacy formatters for backward compatibility - use statsFormatters instead
export const formatters = {
  duration: (seconds?: number) => {
    if (!seconds) return '0m';
    const minutes = Math.floor(seconds / 60);
    return statsFormatters.duration(minutes);
  },

  distance: (meters?: number) => {
    if (!meters) return '0km';
    const km = meters > 100 ? meters / 1000 : meters; // Auto-convert meters to km
    return statsFormatters.distance(km);
  },

  volume: statsFormatters.volume,

  workoutType: (type: string) => {
    const typeMap: Record<string, string> = {
      'strength': 'Strength',
      'running': 'Running',
      'cycling': 'Cycling',
      'swimming': 'Swimming',
      'yoga': 'Yoga',
      'cardio': 'Cardio'
    };
    return typeMap[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
  },

  date: (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return format(date, 'MMM d');
    } catch {
      return 'Unknown';
    }
  }
}; 