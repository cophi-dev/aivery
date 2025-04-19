"use server";

import { ExerciseData } from "@/types/db"; // Assuming this type might be useful, adjust if needed

// Interface for the expected response structure from ExerciseDB API (based on their example)
// We only care about a few fields for now.
interface ExerciseDbApiResponse {
  name: string;
  instructions: string[]; // It seems instructions are an array of strings
  gifUrl?: string; // Assuming gifUrl might be the key based on repo description
  // Add other fields if needed later
}

const EXERCISE_DB_API_BASE_URL = "https://exercisedb-api.vercel.app/api/exercises";

/**
 * Fetches detailed information (description, GIF) for a given exercise name 
 * from the public ExerciseDB API.
 * 
 * @param exerciseName The name of the exercise to search for.
 * @returns An object with description and gifUrl, or null if not found or error.
 */
export async function fetchExerciseDetailsFromApi(exerciseName: string): Promise<{ description: string; gifUrl: string | null } | null> {
  if (!exerciseName) {
    console.warn("fetchExerciseDetailsFromApi called with empty name");
    return null;
  }

  // Encode the exercise name for the URL
  const encodedName = encodeURIComponent(exerciseName.toLowerCase());
  // Construct the likely API endpoint URL based on typical REST patterns and the repo structure
  // Using /name/{name} endpoint as it's common for specific lookups
  const apiUrl = `${EXERCISE_DB_API_BASE_URL}/name/${encodedName}`; 

  console.log(`[ExerciseDB API] Fetching details for: ${exerciseName} from ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      // No API key needed for this public API based on their docs
      headers: {
        'Accept': 'application/json',
      },
      // Add cache control if needed, but let's start simple
      // cache: 'no-store' // Uncomment if data freshness is critical and caching is an issue
    });

    if (!response.ok) {
      // Handle cases where the exercise is not found (404) or other API errors
      if (response.status === 404) {
        console.log(`[ExerciseDB API] Exercise not found: ${exerciseName}`);
        return null; // Not found is not an error in our flow, just no data
      } else {
        console.error(`[ExerciseDB API] Error fetching exercise '${exerciseName}': ${response.status} ${response.statusText}`);
        // Consider throwing an error or returning a specific error object if needed downstream
        return null; 
      }
    }

    const data: ExerciseDbApiResponse[] = await response.json();

    // The API seems to return an array, even when searching by name. Assume the first result is the best match.
    if (!data || data.length === 0) {
      console.log(`[ExerciseDB API] No data returned for exercise: ${exerciseName}`);
      return null;
    }

    const exerciseDetails = data[0];

    // Format description from instructions array
    const description = exerciseDetails.instructions ? exerciseDetails.instructions.join('\n') : "No instructions available.";
    // Use the gifUrl if present
    const gifUrl = exerciseDetails.gifUrl || null; // Adjust key 'gifUrl' if different in actual API response

    console.log(`[ExerciseDB API] Successfully fetched details for: ${exerciseName}`);
    return { description, gifUrl };

  } catch (error) {
    console.error(`[ExerciseDB API] Failed to fetch exercise details for '${exerciseName}':`, error);
    // Depending on requirements, you might want to re-throw the error
    // throw new Error(`Failed to fetch details for ${exerciseName}`);
    return null; // Return null on network errors etc.
  }
} 