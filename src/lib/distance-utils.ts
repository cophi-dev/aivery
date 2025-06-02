/**
 * Centralized distance utilities to handle consistent distance normalization and formatting
 * 
 * This fixes the issue where distance conversion logic was inconsistent across components,
 * leading to unrealistic distance displays (e.g., showing 8449.2 km instead of 8.4 km).
 */

export interface WorkoutDistance {
  distance?: number;
  cardioDetails?: {
    distance?: number;
  };
}

/**
 * Normalizes distance from workout data to kilometers
 * 
 * Rules:
 * 1. cardioDetails.distance is always in kilometers (preferred)
 * 2. top-level distance field is in meters when > 1000, kilometers otherwise
 * 3. Return 0 if no valid distance found
 * 
 * @param workout Workout object with distance fields
 * @returns Distance in kilometers
 */
export function normalizeDistanceToKm(workout: WorkoutDistance): number {
  // Check both distance sources and apply the same normalization logic
  let candidateDistances: number[] = [];
  
  // Add cardioDetails.distance if available
  if (workout.cardioDetails?.distance != null && workout.cardioDetails.distance > 0) {
    candidateDistances.push(workout.cardioDetails.distance);
  }
  
  // Add top-level distance if available
  if (workout.distance != null && workout.distance > 0) {
    candidateDistances.push(workout.distance);
  }
  
  if (candidateDistances.length === 0) {
    return 0;
  }
  
  // Apply normalization to all candidates and pick the most reasonable one
  const normalizedDistances = candidateDistances.map(distance => {
    // If distance is very large (> 1000), it's likely in meters
    if (distance > 1000) {
      return distance / 1000;
    }
    // If distance is reasonable (1-1000), it's likely already in km
    return distance;
  });
  
  // Pick the smallest reasonable distance (likely the correctly converted one)
  // This handles cases where one field has raw meters and another has km
  const reasonableDistances = normalizedDistances.filter(d => d > 0 && d < 1000);
  
  if (reasonableDistances.length > 0) {
    return Math.min(...reasonableDistances);
  }
  
  // Fallback to the first normalized distance
  return normalizedDistances[0];
}

/**
 * Formats distance in kilometers for display
 * 
 * @param distanceInKm Distance in kilometers
 * @returns Formatted string (e.g., "8.4 km")
 */
export function formatDistanceDisplay(distanceInKm: number): string {
  if (isNaN(distanceInKm) || distanceInKm < 0) {
    return "0.0 km";
  }

  // Handle unreasonably large values (likely a data error)
  if (distanceInKm > 10000) {
    console.warn(`Unreasonably large distance value detected: ${distanceInKm}km. Limiting display.`);
    return "Error: Invalid distance";
  }
  
  // Handle very small values
  if (distanceInKm < 0.01) {
    return "0.0 km";
  }
  
  // Normal formatting
  return `${distanceInKm.toFixed(1)} km`;
}

/**
 * Gets distance from workout and formats it for display in one step
 * 
 * @param workout Workout object with distance fields
 * @returns Formatted distance string
 */
export function getFormattedDistance(workout: WorkoutDistance): string {
  const distanceInKm = normalizeDistanceToKm(workout);
  return formatDistanceDisplay(distanceInKm);
}

/**
 * Calculates pace in minutes per kilometer
 * 
 * @param durationSeconds Duration in seconds
 * @param workout Workout object with distance fields
 * @returns Pace string (e.g., "5:30") or "--:--" if invalid
 */
export function calculatePace(durationSeconds: number, workout: WorkoutDistance): string {
  const distanceInKm = normalizeDistanceToKm(workout);
  
  if (!durationSeconds || !distanceInKm || durationSeconds <= 0 || distanceInKm <= 0) {
    return '--:--';
  }
  
  const paceInMinutes = (durationSeconds / 60) / distanceInKm;
  const minutes = Math.floor(paceInMinutes);
  const seconds = Math.round((paceInMinutes - minutes) * 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
} 