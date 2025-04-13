import { subWeeks, parseISO, isValid, startOfDay } from "date-fns";
import { estimateBodyweightForExercise } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { fetchWorkouts } from "@/lib/workout-actions";
import type { WorkoutData } from "@/types/db";

// Simplified version of WorkoutExerciseData for our needs
interface SimpleWorkoutExercise {
  name?: string;
  exerciseName?: string; // Some workouts might use this field instead
  sets?: Array<{
    weight?: number;
    reps?: number;
  }>;
  distance?: number;
}

// Our serialized workout type that matches what we get from fetchWorkouts
interface SerializedWorkout {
  _id: string;
  userId: string;
    name: string;
  date: string;
  type: string;
  duration: number;
  distance?: number;
  workoutExercises?: SimpleWorkoutExercise[];
  calculatedVolume?: number;
  cardioDetails?: {
    distance: number;
  };
}

function normalizeDistance(distance: number, workoutName: string): number {
  // If the workout name contains 'km', the distance is in kilometers
  if (workoutName.toLowerCase().includes('km')) {
    return distance * 1000; // Convert km to meters
  }
  // If the distance is very large (> 1000), it's likely already in meters
  if (distance > 1000) {
    return distance;
  }
  // If the distance is small (< 100), it's likely in kilometers
  if (distance > 0 && distance < 100) {
    return distance * 1000; // Convert km to meters
  }
  return distance; // Return as is if we can't determine the unit
}

interface DashboardMetrics {
    strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  strengthVolumePrevious7Days: number;
  cardioDurationPrevious7Days: number;
  cardioDistancePrevious7Days: number;
  topPRs: Array<{ exerciseName: string; weight: number; date: string; }>;
}

export async function calculateDashboardMetrics(workouts?: SerializedWorkout[]): Promise<DashboardMetrics> {
  console.log(">>> EXECUTING LATEST METRICS CODE V3 <<<");
  try {
    // If no workouts provided, fetch them
    if (!workouts) {
      const user = await getCurrentUser();
      if (!user?.id) {
        console.warn("No user found for dashboard metrics calculation");
        return {
          strengthVolumeLast7Days: 0,
          cardioDurationLast7Days: 0,
          cardioDistanceLast7Days: 0,
          strengthVolumePrevious7Days: 0,
          cardioDurationPrevious7Days: 0,
          cardioDistancePrevious7Days: 0,
          topPRs: []
        };
      }
      workouts = await fetchWorkouts();
    }

    console.log(`[Metrics] Processing ${workouts.length} total workouts`);

    // Sort workouts by date (newest first) to make sure we're processing them in order
    workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Use the actual current date to define periods, not the most recent workout date.
    const today = new Date();
    
    // Calculate the period boundaries using the actual current date.
    // Current Period: Starts 7 days ago (at 00:00:00) and ends now.
    const endOfCurrentPeriod = new Date(today); 
    // Optional: Set to end of day for consistency? For now, using 'now'.
    // endOfCurrentPeriod.setHours(23, 59, 59, 999); 

    const startOfCurrentPeriod = new Date(today);
    startOfCurrentPeriod.setDate(today.getDate() - 7);
    startOfCurrentPeriod.setHours(0, 0, 0, 0); // Start of the day 7 days ago

    // Previous Period: Starts 14 days ago (at 00:00:00) and ends 7 days ago (at 00:00:00).
    const startOfPreviousPeriod = new Date(today);
    startOfPreviousPeriod.setDate(today.getDate() - 14);
    startOfPreviousPeriod.setHours(0, 0, 0, 0); // Start of the day 14 days ago

    // The end of the previous period is the start of the current period.
    const endOfPreviousPeriod = startOfCurrentPeriod; 

    console.log(`[Metrics] Calculating periods based on current date: ${today.toISOString()}`);
    console.log(`Current period: ${startOfCurrentPeriod.toISOString()} to ${endOfCurrentPeriod.toISOString()}`);
    console.log(`Previous period: ${startOfPreviousPeriod.toISOString()} to ${endOfPreviousPeriod.toISOString()}`);

    let strengthVolumeLast7Days = 0;
    let cardioDurationLast7Days = 0;
    let cardioDistanceLast7Days = 0;
    let strengthVolumePrevious7Days = 0;
    let cardioDurationPrevious7Days = 0;
    let cardioDistancePrevious7Days = 0;

    // Use a for...of loop instead of forEach for potentially more robust iteration
    let index = 0; 
    for (const workout of workouts) {
      index++; // Increment index manually
      console.log(`\n[Metrics] Loop Iteration ${index}: Processing workout ID ${workout._id}`);
      const workoutDate = new Date(workout.date);
      console.log(`\n[Metrics] Checking workout "${workout.name}" (${workout.type})`);
      console.log(`[Metrics] - Date: ${workoutDate.toISOString()}`);
      
      // Check which period this workout belongs to (using timestamp comparison)
      const workoutTime = workoutDate.getTime();
      // Corrected comparison logic using the new period boundaries
      const isInCurrentPeriod = workoutTime >= startOfCurrentPeriod.getTime() && workoutTime <= endOfCurrentPeriod.getTime();
      const isInPreviousPeriod = workoutTime >= startOfPreviousPeriod.getTime() && workoutTime < endOfPreviousPeriod.getTime();
      
      console.log(`[Metrics] - Comparing against (actual dates):`);
      console.log(`[Metrics]   Current period: ${startOfCurrentPeriod.toISOString()} to ${endOfCurrentPeriod.toISOString()}`);
      console.log(`[Metrics]   Previous period: ${startOfPreviousPeriod.toISOString()} to ${endOfPreviousPeriod.toISOString()}`);
      console.log(`[Metrics] - In current period: ${isInCurrentPeriod}`);
      console.log(`[Metrics] - In previous period: ${isInPreviousPeriod}`);

      // Helper function to process a workout
      const processWorkout = (workout: SerializedWorkout, isCurrentPeriod: boolean) => {
        if (workout.type === 'strength') {
          // Use the pre-calculated volume stored on the workout object
          const volume = workout.calculatedVolume ?? 0; 
          console.log(`[Metrics] Processing strength workout: "${workout.name}"`);
          console.log(`[Metrics] - Date: ${workout.date}`);
          console.log(`[Metrics] - Using stored calculated volume: ${volume}kg`);
          
          if (volume > 0) {
             if (isCurrentPeriod) {
              strengthVolumeLast7Days += volume;
              console.log(`[Metrics] - Added to current period. Total now: ${strengthVolumeLast7Days}kg`);
            } else {
              strengthVolumePrevious7Days += volume;
              console.log(`[Metrics] - Added to previous period. Total now: ${strengthVolumePrevious7Days}kg`);
            }
          } else {
            console.log(`[Metrics] - Workout volume is 0 or undefined, not adding.`);
          }

        } else if (['running', 'cycling', 'walking'].includes(workout.type)) {
          const duration = workout.duration || 0;
          // Get distance in meters from either the workout or its exercises
          // Prefer direct distance if available, fallback to cardioDetails
          const distanceInMeters = workout.distance ?? workout.cardioDetails?.distance ?? 0;
          
          // Detailed logging for this workout
          console.log(`[Metrics] Processing workout: "${workout.name}" (${workout.type})`);
          console.log(`[Metrics] - Raw distance: ${distanceInMeters}`);
          console.log(`[Metrics] - Date: ${workout.date}`);
          console.log(`[Metrics] - Source: ${workout.workoutExercises?.[0]?.distance ? 'exercises' : 'workout'}`);
          
          // Convert to meters if needed - but first log what we're getting
          console.log(`[Metrics] - Distance stored in workout:`, workout.distance);
          console.log(`[Metrics] - Distance from first exercise:`, workout.workoutExercises?.[0]?.distance);
          
          console.log(`[Metrics] - Using distance (meters): ${distanceInMeters}`);
          
          if (isCurrentPeriod) {
            cardioDurationLast7Days += duration;
            cardioDistanceLast7Days += distanceInMeters;
            console.log(`[Metrics] - Added to current period. Total now: ${cardioDistanceLast7Days}m`);
                    } else {
            cardioDurationPrevious7Days += duration;
            cardioDistancePrevious7Days += distanceInMeters;
            console.log(`[Metrics] - Added to previous period. Total now: ${cardioDistancePrevious7Days}m`);
          }
        }
      };

      // Process workout based on its date
      if (isInCurrentPeriod) {
        processWorkout(workout, true);
      } else if (isInPreviousPeriod) {
        processWorkout(workout, false);
      } else {
        console.log(`[Metrics] - Workout outside both periods`);
      }
    }

    // Convert all distances to meters for consistency
    cardioDistanceLast7Days = Math.round(cardioDistanceLast7Days);
    cardioDistancePrevious7Days = Math.round(cardioDistancePrevious7Days);

    console.log("[Dashboard Page] Calculated metrics:", {
      strengthVolumeLast7Days,
      cardioDurationLast7Days,
      cardioDistanceLast7Days,
      strengthVolumePrevious7Days,
      cardioDurationPrevious7Days,
      cardioDistancePrevious7Days,
      topPRs: []
    });

    // Before returning the metrics, log the final totals
    console.log("\n[Metrics] Final Distance Totals:");
    console.log(`Current 7 days: ${cardioDistanceLast7Days}m (${cardioDistanceLast7Days/1000}km)`);
    console.log(`Previous 7 days: ${cardioDistancePrevious7Days}m (${cardioDistancePrevious7Days/1000}km)`);
    
    return {
      strengthVolumeLast7Days,
      cardioDurationLast7Days,
      cardioDistanceLast7Days,
      strengthVolumePrevious7Days,
      cardioDurationPrevious7Days,
      cardioDistancePrevious7Days,
      topPRs: []
    };
  } catch (error) {
    console.error("[Dashboard Metrics] Error calculating metrics:", error);
    return {
      strengthVolumeLast7Days: 0,
      cardioDurationLast7Days: 0,
      cardioDistanceLast7Days: 0,
      strengthVolumePrevious7Days: 0,
      cardioDurationPrevious7Days: 0,
      cardioDistancePrevious7Days: 0,
      topPRs: []
    };
  }
} 