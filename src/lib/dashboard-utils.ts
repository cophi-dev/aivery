import { format } from "date-fns";
import { statsFormatters, type WeeklyStats, type StatsDelta, type PercentChange } from './stats';

// Types for our dashboard components (client-safe)
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

// Re-export types from stats module for convenience
export type { WeeklyStats, StatsDelta, PercentChange };

// Legacy ProgressData interface for backward compatibility
export interface ProgressData {
  weeklyWorkouts: number;
  previousWeekWorkouts: number;
  weeklyDuration: number; // in seconds
  previousWeekDuration: number;
  weeklyVolume: number; // in kg
  previousWeekVolume: number;
  weeklyDistance: number; // in km
  previousWeekDistance: number;
}

// Helper to calculate delta/change percentage (client-safe) - DEPRECATED, use stats module
export function calculateDelta(current: number, previous: number): {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'same';
} {
  if (previous === 0) {
    return {
      value: current,
      percentage: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'same'
    };
  }

  const change = current - previous;
  const percentage = (change / previous) * 100;
  
  return {
    value: change,
    percentage: Math.abs(percentage),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  };
}

// Helper for formatting functions (client-safe) - use statsFormatters instead
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