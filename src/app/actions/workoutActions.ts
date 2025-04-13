'use server';

import { getCurrentUser } from '@/lib/auth';
import { getExercisePR, getFastestPace } from '@/lib/db/repositories/workoutRepository';

// Define return types matching the state in the component
interface ExercisePrData {
  benchPress?: { value: number; unit: string; date: Date } | null;
  pullups?: { value: number; unit: string; date: Date } | null;
}
interface PacePrData {
  fastest5k?: { pace: number; date: Date; workoutId: string } | null;
}

interface PrDataResult {
  success: boolean;
  exercisePRs?: ExercisePrData;
  pacePRs?: PacePrData;
  error?: string;
}

/**
 * Server action to fetch Personal Record (PR) data for the current user.
 */
export async function fetchPrDataAction(): Promise<PrDataResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("User not found for fetching PRs via server action.");
      // Depending on requirements, you might return an error or empty data
      return { success: false, error: 'User not authenticated' }; 
    }

    console.log("Server Action: Fetching PRs for user:", user.id); 

    // Fetch PRs concurrently
    const [benchPr, pullupsPr, pace5k] = await Promise.all([
      getExercisePR(user.id, 'Bench Press'),
      getExercisePR(user.id, 'Pull-up'), // Ensure exact name match
      getFastestPace(user.id, 5) // Fetching for 5km
    ]);

    console.log("Server Action: Fetched PRs:", { benchPr, pullupsPr, pace5k });

    const exercisePRs: ExercisePrData = { benchPress: benchPr, pullups: pullupsPr };
    const pacePRs: PacePrData = { fastest5k: pace5k };

    return { success: true, exercisePRs, pacePRs };

  } catch (err) {
    console.error("Server Action Error: Failed to fetch PRs:", err);
    // Return a generic error message to the client
    return { success: false, error: 'Failed to load Personal Records.' }; 
  }
} 