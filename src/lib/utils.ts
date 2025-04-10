import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
 * Formats a duration given in seconds into a string like "Xh Ym Zs".
 * Omits hours or minutes if they are zero.
 * Rounds seconds to the nearest whole number.
 */
export function formatDuration(totalSeconds: number | undefined | null): string {
  if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0 || !isFinite(totalSeconds)) {
    return "0s";
  }

  const secondsInt = Math.round(totalSeconds);
  const hours = Math.floor(secondsInt / 3600);
  const minutes = Math.floor((secondsInt % 3600) / 60);
  const seconds = secondsInt % 60;

  let formatted = "";
  if (hours > 0) {
    formatted += `${hours}h `;
  }
  if (minutes > 0) {
    formatted += `${minutes}m `;
  }
  if (seconds > 0 || formatted === "") { // Always show seconds if hours/minutes are 0, or if seconds > 0
    formatted += `${seconds}s`;
  }

  return formatted.trim(); // Remove trailing space if seconds is 0
}

// Format distance with units (assuming km)
export function formatDistance(distance: number): string {
  if (isNaN(distance) || distance < 0) {
    return "0.00 km";
  }
  
  // Handle unreasonably large values (likely data errors)
  if (distance > 1000) {
    console.warn(`Unreasonably large distance value detected: ${distance}km. Limiting display.`);
    
    // If it's truly massive (>10,000), it's almost certainly an error
    if (distance > 10000) {
      return "Error: Invalid distance";
    }
    
    // For large but potentially valid values, show without decimals
    return `${Math.round(distance)} km`;
  }
  
  // Normal handling for reasonable values
  return `${distance.toFixed(2)} km`;
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
export const estimateBodyweightForExercise = (exerciseName: string): number => {
  // Default estimated bodyweight in kg if nothing else applies
  const defaultBodyweight = 75; // Adjusted default

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
      // console.log(`[Volume Calc Util] Matched exercise: ${normalizedName} with key: ${exerciseKey}. Applying ${percentage * 100}% of ${defaultBodyweight}kg.`);
      return Math.round(defaultBodyweight * percentage);
    }
  }

  // console.log(`[Volume Calc Util] No bodyweight match found for exercise: ${normalizedName}. Using 0kg for estimation.`);
  // If no specific match is found
  return 0;
}
