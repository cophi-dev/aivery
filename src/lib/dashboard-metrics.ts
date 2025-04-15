import { subWeeks, parseISO, isValid, startOfDay, endOfDay, subDays } from "date-fns";
import { estimateBodyweightForExercise } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { fetchWorkouts } from "@/lib/workout-actions";
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout'
import dbConnect from '@/lib/db/mongodb'
import mongoose from 'mongoose'
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

// --- Interface for PR data ---
interface PRData {
  exerciseName: string;
  weight: number;
  date: string; 
}

interface DashboardMetrics {
    strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  strengthVolumePrevious7Days: number;
  cardioDurationPrevious7Days: number;
  cardioDistancePrevious7Days: number;
  topPRs: PRData[];
}

// --- Helper to Fetch Workouts in Date Range --- 
async function fetchWorkoutsForMetrics(userId: string, startDate: Date, endDate: Date): Promise<SerializedWorkout[]> {
  await dbConnect();
  const workoutDocs = await WorkoutModel
    .find({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: startDate, $lte: endDate }
    })
    .select('_id userId name date type duration distance calculatedVolume cardioDetails workoutExercises') // Select only needed fields
    .lean()
    .sort({ date: -1 }); // Sort by date descending

  // Basic serialization (adapt if needed based on actual usage)
  return workoutDocs.map((doc: any) => ({
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    date: doc.date.toISOString(),
    type: doc.type,
    duration: doc.duration,
    distance: doc.distance,
    calculatedVolume: doc.calculatedVolume,
    cardioDetails: doc.cardioDetails ? { distance: doc.cardioDetails.distance } : undefined, // Only serialize needed parts
    // workoutExercises: doc.workoutExercises // Avoid fetching/serializing exercises if not needed for metrics
  }));
}

// --- Helper to Fetch Top PRs (Example Implementation) ---
async function fetchTopPRs(userId: string, limit: number = 3): Promise<PRData[]> {
    await dbConnect();
    // This is a simplified example. Real PR tracking might need a separate collection
    // or a more complex aggregation pipeline on workouts/exercises/sets.
    // This example finds the heaviest set for each exercise across all strength workouts.
    const prAggregation = await WorkoutModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'strength' } },
        { $unwind: '$workoutExercises' }, // Assuming exercises are embedded; adjust if using WorkoutExerciseModel
        { $unwind: '$workoutExercises.sets' },
        { $match: { 'workoutExercises.sets.weight': { $gt: 0 } } }, // Only consider sets with weight
        {
            $group: {
                _id: '$workoutExercises.name', // Group by exercise name
                maxWeight: { $max: '$workoutExercises.sets.weight' },
                date: { $max: '$date' } // Get the date of the latest workout with this exercise
            }
        },
        { $sort: { maxWeight: -1 } }, // Sort by heaviest weight
        { $limit: limit },
        {
            $project: {
                _id: 0,
                exerciseName: '$_id',
                weight: '$maxWeight',
                date: '$date'
            }
        }
    ]);

    // Serialize the result
    return prAggregation.map((pr: any) => ({
        ...pr,
        date: pr.date.toISOString()
    }));
}

export async function calculateDashboardMetrics(): Promise<DashboardMetrics> {
  console.log(">>> EXECUTING METRICS CODE V4 (Optimized Fetch) <<<");
  const user = await getCurrentUser();
  if (!user?.id) {
    console.warn("No user found for dashboard metrics calculation");
    // Return default structure
    return { strengthVolumeLast7Days: 0, cardioDurationLast7Days: 0, cardioDistanceLast7Days: 0, strengthVolumePrevious7Days: 0, cardioDurationPrevious7Days: 0, cardioDistancePrevious7Days: 0, topPRs: [] };
  }
  const userId = user.id;

  try {
    const today = new Date();
    const endOfCurrentPeriod = endOfDay(today);
    const startOfCurrentPeriod = startOfDay(subDays(today, 7)); // Start of 7 days ago
    const startOfPreviousPeriod = startOfDay(subDays(today, 14)); // Start of 14 days ago
    const endOfPreviousPeriod = startOfCurrentPeriod; // Previous period ends where current begins

    console.log(`[Metrics] Calculating periods based on current date: ${today.toISOString()}`);
    console.log(`[Metrics] Fetching workouts from: ${startOfPreviousPeriod.toISOString()} to ${endOfCurrentPeriod.toISOString()}`);

    // Fetch only workouts from the last 14 days
    const workouts = await fetchWorkoutsForMetrics(userId, startOfPreviousPeriod, endOfCurrentPeriod);
    console.log(`[Metrics] Fetched ${workouts.length} workouts for the last 14 days.`);

    // Fetch Top PRs separately
    const topPRs = await fetchTopPRs(userId);
    console.log(`[Metrics] Fetched ${topPRs.length} Top PRs.`);

    let strengthVolumeLast7Days = 0;
    let cardioDurationLast7Days = 0;
    let cardioDistanceLast7Days = 0;
    let strengthVolumePrevious7Days = 0;
    let cardioDurationPrevious7Days = 0;
    let cardioDistancePrevious7Days = 0;

    for (const workout of workouts) {
        const workoutDate = parseISO(workout.date); // Use parseISO for string dates
        const workoutTime = workoutDate.getTime();

        const isInCurrentPeriod = workoutTime >= startOfCurrentPeriod.getTime() && workoutTime <= endOfCurrentPeriod.getTime();
        const isInPreviousPeriod = workoutTime >= startOfPreviousPeriod.getTime() && workoutTime < endOfPreviousPeriod.getTime();

        // Simplified processing logic
        const processWorkout = (workout: SerializedWorkout, isCurrentPeriod: boolean) => {
            if (workout.type === 'strength') {
                const volume = workout.calculatedVolume ?? 0;
                if (isCurrentPeriod) strengthVolumeLast7Days += volume;
                else strengthVolumePrevious7Days += volume;
            } else if (['running', 'cycling', 'walking', 'cardio'].includes(workout.type)) { // Include generic cardio
                const duration = workout.duration || 0;
                const distanceInMeters = workout.distance ?? workout.cardioDetails?.distance ?? 0;
                if (isCurrentPeriod) {
                    cardioDurationLast7Days += duration;
                    cardioDistanceLast7Days += distanceInMeters;
                } else {
                    cardioDurationPrevious7Days += duration;
                    cardioDistancePrevious7Days += distanceInMeters;
                }
            }
        };

        if (isInCurrentPeriod) {
            processWorkout(workout, true);
        } else if (isInPreviousPeriod) {
            processWorkout(workout, false);
        }
    }

    // Round distances
    cardioDistanceLast7Days = Math.round(cardioDistanceLast7Days);
    cardioDistancePrevious7Days = Math.round(cardioDistancePrevious7Days);

    const finalMetrics = {
        strengthVolumeLast7Days,
        cardioDurationLast7Days,
        cardioDistanceLast7Days,
        strengthVolumePrevious7Days,
        cardioDurationPrevious7Days,
        cardioDistancePrevious7Days,
        topPRs
    };
    console.log("[Metrics] Final Calculated Metrics:", finalMetrics);
    return finalMetrics;

  } catch (error) {
    console.error("[Dashboard Metrics] Error calculating metrics:", error);
    // Return default structure on error
    return { strengthVolumeLast7Days: 0, cardioDurationLast7Days: 0, cardioDistanceLast7Days: 0, strengthVolumePrevious7Days: 0, cardioDurationPrevious7Days: 0, cardioDistancePrevious7Days: 0, topPRs: [] };
  }
} 