export type WeeklyStats = {
  workouts: number;
  duration: number; // in minutes
  distance: number; // in km
  volume: number; // in kg
};

export type StatsDelta = {
  workoutsDelta: PercentChange;
  durationDelta: PercentChange;
  distanceDelta: PercentChange;
  volumeDelta: PercentChange;
};

export type PercentChange = {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'same';
};

/**
 * Calculate percentage change between two values
 * 
 * @example
 * ```ts
 * const change = getPercentChange(7, 5); // { value: 2, percentage: 40, direction: 'up' }
 * ```
 */
export function getPercentChange(current: number, previous: number): PercentChange {
  if (previous === 0) {
    return {
      value: current,
      percentage: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'same'
    };
  }

  const change = current - previous;
  const percentage = Math.abs((change / previous) * 100);
  
  return {
    value: change,
    percentage,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  };
}

/**
 * Calculate deltas for all weekly stats metrics
 * 
 * @example
 * ```ts
 * const current: WeeklyStats = { workouts: 7, duration: 420, distance: 15.5, volume: 2500 };
 * const previous: WeeklyStats = { workouts: 5, duration: 300, distance: 12.0, volume: 2000 };
 * const deltas = calculateDelta(current, previous);
 * // Returns: { workoutsDelta: { percentage: 40, direction: 'up' }, ... }
 * ```
 */
export function calculateDelta(current: WeeklyStats, previous: WeeklyStats): StatsDelta {
  return {
    workoutsDelta: getPercentChange(current.workouts, previous.workouts),
    durationDelta: getPercentChange(current.duration, previous.duration),
    distanceDelta: getPercentChange(current.distance, previous.distance),
    volumeDelta: getPercentChange(current.volume, previous.volume),
  };
}

/**
 * Format statistics for display
 */
export const statsFormatters = {
  duration: (minutes: number) => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  },

  distance: (km: number) => {
    if (km === 0) return '0km';
    return `${km.toFixed(1)}km`;
  },

  volume: (kg: number) => {
    if (kg === 0) return '0kg';
    if (kg >= 1000) {
      const tons = kg / 1000;
      return `${tons.toFixed(1)}t`;
    }
    return `${Math.round(kg)}kg`;
  },

  workouts: (count: number) => {
    return count === 1 ? '1 workout' : `${count} workouts`;
  }
}; 