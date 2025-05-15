import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceStrict, formatDuration as formatDurationFns, differenceInSeconds, isValid } from 'date-fns';

// Imports needed for new helpers
import React from 'react';
// Remove Badge and icon imports, moved to workout-utils.tsx
// import { Badge } from "@/components/ui/badge"; 
// import { Dumbbell, Ruler, Activity } from 'lucide-react'; 

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
    return "0.0 km"; // Keep consistent formatting, changed to toFixed(1)
  }

  // Remove the meters to kilometers conversion
  // const distanceInKm = distanceInMeters / 1000;

  // Handle unreasonably large values 
  if (distanceInKm > 10000) { // Increased threshold slightly
    console.warn(`Unreasonably large distance value detected: ${distanceInKm}km. Limiting display.`);
    return "Error: Invalid distance";
  } else if (distanceInKm > 1000) {
     // Display large values with less precision if desired
    return `${distanceInKm.toFixed(1)} km`; // e.g., 5000.0 km 
  } else if (distanceInKm < 0.01) { // Use a small threshold instead of === 0
      return "0.0 km"; // Handle zero or very small values explicitly
  }
  
  // Normal handling for reasonable values - use 1 decimal place
  return `${distanceInKm.toFixed(1)} km`;
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

// Format pace (minutes per km)
export function formatPace(pace: number | null): string {
  if (pace === null || pace <= 0 || !isFinite(pace)) return "N/A";
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
};

// --- REMOVED getWorkoutTypeStyle Helper --- 

// --- Existing Calculate Distance Helper ---
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
// --- END EXISTING ---

// --- NEW: Percentage Change Helper ---
/**
 * Calculates the percentage change between two numbers.
 * @param current The current value.
 * @param previous The previous value.
 * @returns The percentage change (e.g., 10.5 for +10.5%) or null if previous is 0 or invalid.
 */
export function calculatePercentageChange(current: number | undefined | null, previous: number | undefined | null): number | null {
    if (previous === undefined || previous === null || previous === 0 || current === undefined || current === null) {
        return null; // Cannot calculate change if previous is zero or values are missing
    }
    if (isNaN(current) || isNaN(previous) || !isFinite(current) || !isFinite(previous)) {
        return null; // Invalid numbers
    }
    const change = ((current - previous) / previous) * 100;
    // Round to one decimal place
    return Math.round(change * 10) / 10;
}
// --- END NEW ---

export { estimateBodyweightForExercise } from './utils/estimateBodyweightForExercise';
