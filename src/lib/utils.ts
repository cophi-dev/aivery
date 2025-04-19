import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceStrict, formatDuration as formatDurationFns, differenceInSeconds, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper function to safely extract text from Claude API response content
 * 
 * @param content The content array from a Claude API response
 * @returns The extracted text or undefined if not available
 */
export function getTextFromResponse(content: any): string | undefined {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }
  
  const firstBlock = content[0];
  
  // Handle different content block types safely
  if (firstBlock && typeof firstBlock === "object") {
    if ("text" in firstBlock) {
      return firstBlock.text as string;
    }
  }
  
  return undefined;
}

/**
 * Formats a duration given in seconds into a string like "HH:MM:SS" or "MM:SS".
 * Shows hours only if duration is >= 1 hour.
 * Always shows minutes and seconds with two digits.
 */
export function formatDuration(totalSeconds: number | undefined | null): string {
  if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0 || !isFinite(totalSeconds)) {
    return "00:00";
  }

  const secondsInt = Math.round(totalSeconds);
  const hours = Math.floor(secondsInt / 3600);
  const minutes = Math.floor((secondsInt % 3600) / 60);
  const seconds = secondsInt % 60;

  // Pad with zeros for consistent formatting
  const paddedMinutes = minutes.toString().padStart(2, '0');
  const paddedSeconds = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    // Format: "H:MM:SS" or "HH:MM:SS"
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  } else {
    // Format: "MM:SS"
    return `${paddedMinutes}:${paddedSeconds}`;
  }
}

// Format distance with units (accepts and displays km)
export function formatDistance(distanceInKm: number): string {
  if (isNaN(distanceInKm) || distanceInKm < 0) {
    return "0.000 km"; // Keep consistent formatting
  }

  // Remove the meters to kilometers conversion
  // const distanceInKm = distanceInMeters / 1000;

  // Handle unreasonably large values 
  if (distanceInKm > 10000) { // Increased threshold slightly
    console.warn(`Unreasonably large distance value detected: ${distanceInKm}km. Limiting display.`);
    return "Error: Invalid distance";
  } else if (distanceInKm > 1000) {
     // Display large values with less precision if desired, or keep toFixed(3)
    return `${distanceInKm.toFixed(1)} km`; // e.g., 5000.0 km 
  }
  
  // Normal handling for reasonable values - use 3 decimal places for precision
  return `${distanceInKm.toFixed(3)} km`;
}

// Format date nicely
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
}

// Capitalize the first letter of a string
export function capitalizeFirstLetter(string: string | undefined | null): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Add the absoluteUrl helper function
export function absoluteUrl(path: string): string {
  // Ensure NEXT_PUBLIC_APP_URL is set in your .env.local for deployment
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Ensure path starts with a slash and baseUrl doesn't end with one
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

// Estimate weight for common bodyweight exercises
// Modified to accept userWeight
export const estimateBodyweightForExercise = (exerciseName: string, userWeight?: number | null): number => {
  // Use provided userWeight if available and valid, otherwise use a default
  // Fallback to 75kg if user weight is not provided or invalid
  const baseWeight = (userWeight && userWeight > 0) ? userWeight : 75;
  
  // Common bodyweight exercises with percentage of bodyweight used
  const bodyweightExercises: Record<string, number> = {
    // Higher percentage
    "pull-up": 1.0,
    "chin-up": 1.0,
    "dip": 0.95,
    "muscle-up": 1.0,
    "inverted row": 0.8,
    "bodyweight squat": 0.9,
    "pistol squat": 0.9,
    "lunge": 0.6,
    // Medium percentage
    "push-up": 0.65, // Key is "push-up"
    "diamond push-up": 0.7,
    "plank": 0.5,
    // Lower percentage
    "sit-up": 0.3,
    "crunch": 0.2,
    "leg raise": 0.3,
    "mountain climber": 0.4,
    "burpee": 0.7,
    "jumping jack": 0.1
  };

  // Normalize exercise name for comparison
  const normalizedName = exerciseName.toLowerCase().trim();

  // Check if the exercise name contains any of the known bodyweight exercises
  for (const [exerciseKey, percentage] of Object.entries(bodyweightExercises)) {
    if (normalizedName.includes(exerciseKey)) {
      // Use the baseWeight (actual user weight if provided, else default)
      // console.log(`[Volume Calc Util] Matched exercise: ${normalizedName} with key: ${exerciseKey}. Applying ${percentage * 100}% of ${baseWeight}kg.`);
      return Math.round(baseWeight * percentage);
    }
  }

  // console.log(`[Volume Calc Util] No bodyweight match found for exercise: ${normalizedName}. Using 0kg for estimation.`);
  // If no specific match is found
  return 0;
}

// Format pace (minutes per km)
export function formatPace(pace: number | null): string {
  if (pace === null || pace <= 0 || !isFinite(pace)) return "N/A";
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
};

// --- NEW: Calculate Distance Helper ---
/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param lat1 Latitude of the first point in degrees.
 * @param lon1 Longitude of the first point in degrees.
 * @param lat2 Latitude of the second point in degrees.
 * @param lon2 Longitude of the second point in degrees.
 * @returns The distance in meters.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
// --- END NEW ---
