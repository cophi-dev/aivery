import { subWeeks, parseISO, isValid, startOfDay, endOfDay, subDays } from "date-fns";
import { estimateBodyweightForExercise } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { fetchWorkouts } from "@/lib/workout-actions";
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout'
import dbConnect from '@/lib/db/mongodb'
import mongoose from 'mongoose'
import type { WorkoutData } from "@/types/db";
import { fetchDashboardExercisePRs, type DashboardPREntry } from "@/lib/workout-actions";
import UserModel, { IUser } from '@/lib/db/models/user';

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
  // Exercise-specific metrics
  runningDistanceLast7Days: number;
  swimmingDistanceLast7Days: number;
  bikingDistanceLast7Days: number;
  runningDistancePrevious7Days: number;
  swimmingDistancePrevious7Days: number;
  bikingDistancePrevious7Days: number;
  // topPRs: PRData[]; // Keep commented out
  exercisePRs: DashboardPREntry[];
  overallPRs?: Partial<IUser['personalRecords']>; // <-- Add overall PRs (optional)
  workoutCount: number;
  hasAiPreferences?: boolean; // <-- Add flag
}

// --- Helper to Fetch Workouts in Date Range --- 
async function fetchWorkoutsForMetrics(userId: string, startDate: Date, endDate: Date): Promise<SerializedWorkout[]> {
  await dbConnect();
  console.log(`Fetching workouts for user: ${userId}`);
  console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  try { // Add try...catch around the query
    // Log the actual query we're about to run
    console.log(`MongoDB query: { userId: "${userId}", date: { $gte: ISODate("${startDate.toISOString()}"), $lte: ISODate("${endDate.toISOString()}") } }`);
    
    const workoutDocs = await WorkoutModel
      .find({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      })
      // Refined projection: Select only fields used in calculateDashboardMetrics loop
      .select({
         date: 1,
         type: 1,
         duration: 1,
         distance: 1, // Top-level distance (fallback)
         calculatedVolume: 1, // For strength
         'cardioDetails.distance': 1 // Primary cardio distance
         // _id, userId, name are not needed for the calculation loop
      })
      .maxTimeMS(15000) // Keep the 15-second timeout for now
      .lean()
      .sort({ date: -1 }); // Requires index { userId: 1, date: -1 }
    console.log(`Fetched ${workoutDocs.length} workout documents (minimal projection)`);
    
    // Log the exact dates of the fetched workouts to debug date range issues
    if (workoutDocs.length > 0) {
      console.log("Workout dates fetched:");
      workoutDocs.forEach((doc: any) => {
        const date = doc.date;
        const type = doc.type;
        console.log(`- ${date.toISOString()}: ${type} workout`);
      });
    }
    
    // Map the minimally projected data
    // Note: Fields like _id, userId, name will be undefined here
    return workoutDocs.map((doc: any) => ({
      _id: '', // Not selected
      userId: userId, // We know this already
      name: '', // Not selected
      date: doc.date.toISOString(), // Selected
      type: doc.type, // Selected
      duration: doc.duration, // Selected
      distance: doc.distance, // Selected (fallback)
      calculatedVolume: doc.calculatedVolume, // Selected
      cardioDetails: doc.cardioDetails ? { distance: doc.cardioDetails.distance } : undefined, // Selected distance nested
    }));
  } catch (error) {
    console.error(`Error during fetchWorkoutsForMetrics query (or timeout):`, error);
    return []; // Return empty array on error/timeout
  }
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
  console.log(">>> EXECUTING METRICS CODE V5 (Re-enabled Previous Week) <<<"); // Updated log message
  const user = await getCurrentUser();
  if (!user?.id) {
    console.warn("No user found for dashboard metrics calculation");
    // Return default structure with workoutCount
    return { 
      strengthVolumeLast7Days: 0, 
      cardioDurationLast7Days: 0, 
      cardioDistanceLast7Days: 0, 
      strengthVolumePrevious7Days: 0, 
      cardioDurationPrevious7Days: 0, 
      cardioDistancePrevious7Days: 0,
      runningDistanceLast7Days: 0,
      swimmingDistanceLast7Days: 0,
      bikingDistanceLast7Days: 0,
      runningDistancePrevious7Days: 0,
      swimmingDistancePrevious7Days: 0,
      bikingDistancePrevious7Days: 0,
      exercisePRs: [], 
      overallPRs: {}, 
      workoutCount: 0, 
      hasAiPreferences: false
    };
  }
  const userId = user.id;

  try {
    await dbConnect(); // Ensure DB connection
    const today = new Date();
    const endOfCurrentPeriod = endOfDay(today);
    // Keep start of current period as 7 days ago
    const startOfCurrentPeriod = startOfDay(subDays(today, 7));
    // Define start of the full 14-day fetch period (14 days ago)
    const startOfFetchPeriod = startOfDay(subDays(today, 14));

    console.log(`[Metrics] Calculating periods based on current date: ${today.toISOString()}`);
    console.log(`[Metrics] Current period: ${startOfCurrentPeriod.toISOString()} to ${endOfCurrentPeriod.toISOString()}`);
    console.log(`[Metrics] Previous period: ${startOfFetchPeriod.toISOString()} to ${new Date(startOfCurrentPeriod.getTime() - 1).toISOString()}`);
    // Update log to reflect the 14-day fetch range
    console.log(`[Metrics] Fetching workouts from: ${startOfFetchPeriod.toISOString()} to ${endOfCurrentPeriod.toISOString()}`);

    // Fetch workouts for the last 14 days using the start of the fetch period
    // We can run this in parallel with the count and PR fetches
    const workoutsPromise = fetchWorkoutsForMetrics(userId, startOfFetchPeriod, endOfCurrentPeriod);
    
    // Fetch the new exercise PRs (limit 4)
    const exercisePRsPromise = fetchDashboardExercisePRs(4);

    // Fetch the total workout count
    const workoutCountPromise = WorkoutModel.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });

    // --- Fetch User for Overall PRs and AI Prefs --- 
    const userPromise = UserModel.findById(userId)
      .select('personalRecords aiPreferences') // Select PRs and AI preferences
      .lean<Pick<IUser, 'personalRecords' | 'aiPreferences'> | null>();
    // --- End Fetch User --- 

    // Await all promises
    const [workouts, exercisePRs, workoutCount, userDoc] = await Promise.all([
      workoutsPromise,
      exercisePRsPromise,
      workoutCountPromise,
      userPromise // <-- Await user fetch
    ]);

    // --- Check AI Preferences --- 
    let hasAiPreferences = false;
    if (userDoc?.aiPreferences) {
      const prefs = userDoc.aiPreferences;
      // Check if key preferences have non-empty string values
      if ((prefs.fitnessGoals && prefs.fitnessGoals.trim() !== '') || 
          (prefs.trainingPreferences && prefs.trainingPreferences.trim() !== '')) {
        hasAiPreferences = true;
      }
    }
    console.log(`[Metrics] Has AI Preferences set: ${hasAiPreferences}`);
    // --- End Check AI Preferences ---

    // Extract overall PRs from the user document
    const overallPRs = userDoc?.personalRecords || {};

    console.log(`[Metrics] Fetched ${workouts.length} workouts for the last 14 days.`);
    console.log(`[Metrics] Fetched ${exercisePRs.length} Exercise PRs.`);
    console.log(`[Metrics] Total workout count for user ${userId}: ${workoutCount}`);
    // --- Log the fetched userDoc.personalRecords --- 
    console.log(`[Metrics] Raw personalRecords from userDoc:`, JSON.stringify(userDoc?.personalRecords, null, 2));
    // --- End Log --- 

    // Temporarily disabled to diagnose performance bottleneck - KEEP DISABLED FOR NOW
    // const topPRs = await fetchTopPRs(userId);
    // console.log(`[Metrics] Fetched ${topPRs.length} Top PRs.`);
    
    // Initialize metrics
    let strengthVolumeLast7Days = 0;
    let cardioDurationLast7Days = 0;
    let cardioDistanceLast7Days = 0;
    let strengthVolumePrevious7Days = 0;
    let cardioDurationPrevious7Days = 0;
    let cardioDistancePrevious7Days = 0;
    
    // Initialize exercise-specific metrics
    let runningDistanceLast7Days = 0;
    let swimmingDistanceLast7Days = 0;
    let bikingDistanceLast7Days = 0;
    let runningDistancePrevious7Days = 0;
    let swimmingDistancePrevious7Days = 0;
    let bikingDistancePrevious7Days = 0;

    // Define the time boundaries for comparison
    const startOfCurrentPeriodTime = startOfCurrentPeriod.getTime();
    const endOfCurrentPeriodTime = endOfCurrentPeriod.getTime();
    // Previous period is from startOfFetchPeriod up to (but not including) startOfCurrentPeriod
    const startOfPreviousPeriodTime = startOfFetchPeriod.getTime();
    const endOfPreviousPeriodTime = startOfCurrentPeriodTime - 1; // Ensuring no overlap by subtracting 1ms

    // Log time boundaries with dates for better debugging
    console.log(`[Metrics Debug] Period boundaries:`, {
      currentPeriod: {
        start: new Date(startOfCurrentPeriodTime).toISOString(),
        end: new Date(endOfCurrentPeriodTime).toISOString(),
      },
      previousPeriod: {
        start: new Date(startOfPreviousPeriodTime).toISOString(),
        end: new Date(endOfPreviousPeriodTime).toISOString(),
      }
    });

    console.log(`[Metrics Debug] Raw workouts fetched (${workouts.length}):`, JSON.stringify(workouts.slice(0, 5), null, 2)); // Log first 5 raw workouts

    // Count variables for debugging
    let currentPeriodWorkouts = 0;
    let previousPeriodWorkouts = 0;
    let outsidePeriodWorkouts = 0;
    
    for (const workout of workouts) {
        // Ensure workout.date is valid before parsing
        if (!workout.date || !isValid(parseISO(workout.date))) {
          console.warn(`[Metrics] Skipping workout with invalid date: ${workout.date}`);
          continue; 
        }
        const workoutDate = parseISO(workout.date);
        const workoutTime = workoutDate.getTime();

        // Check which period the workout falls into
        const isInCurrentPeriod = workoutTime >= startOfCurrentPeriodTime && workoutTime <= endOfCurrentPeriodTime;
        const isInPreviousPeriod = workoutTime >= startOfPreviousPeriodTime && workoutTime <= endOfPreviousPeriodTime; // Use <= for end

        // Update counters
        if (isInCurrentPeriod) currentPeriodWorkouts++;
        else if (isInPreviousPeriod) previousPeriodWorkouts++;
        else outsidePeriodWorkouts++;

        // Simplified processing function
        const processWorkout = (workout: SerializedWorkout) => {
            let volume = 0;
            let duration = 0;
            let distance = 0; // This will now store distance in meters
            let runningDistance = 0;
            let swimmingDistance = 0;
            let bikingDistance = 0;

            if (workout.type === 'strength') {
                volume = workout.calculatedVolume ?? 0;
            } else if (['running', 'cycling', 'walking', 'cardio'].includes(workout.type)) {
                duration = workout.duration || 0;
                // Get the raw distance value
                const rawDistance = workout.distance ?? workout.cardioDetails?.distance ?? 0;
                // Normalize the distance to meters (assuming values < 100 are km)
                let normalizedDistance = 0;
                if (rawDistance > 0 && rawDistance < 100) {
                    normalizedDistance = rawDistance * 1000; // Convert km to meters
                } else {
                    normalizedDistance = rawDistance; // Assume already meters or 0
                }
                
                distance = normalizedDistance;
                
                // Assign distance to specific exercise type
                if (workout.type === 'running' || workout.type === 'walking') {
                    runningDistance = normalizedDistance;
                } else if (workout.type === 'swimming') {
                    swimmingDistance = normalizedDistance;
                } else if (workout.type === 'cycling') {
                    bikingDistance = normalizedDistance;
                }
            }
            return { volume, duration, distance, runningDistance, swimmingDistance, bikingDistance };
        };

        const metrics = processWorkout(workout);

        // Log metrics being processed for each workout
        if (metrics.volume > 0 || metrics.distance > 0 || metrics.duration > 0) {
            console.log(`[Metrics Debug] Processing workout (${workout.type}, Date: ${workout.date}): Vol=${metrics.volume}, Dist=${metrics.distance} (m), Dur=${metrics.duration}`); // Log distance in meters
        }

        if (isInCurrentPeriod) {
            strengthVolumeLast7Days += metrics.volume;
            cardioDurationLast7Days += metrics.duration;
            cardioDistanceLast7Days += metrics.distance;
            runningDistanceLast7Days += metrics.runningDistance;
            swimmingDistanceLast7Days += metrics.swimmingDistance;
            bikingDistanceLast7Days += metrics.bikingDistance;
            console.log(`[Metrics] Added to CURRENT period: ${workout.type}, Date: ${workout.date}, Duration: ${metrics.duration}, Distance: ${metrics.distance}`);
        } else if (isInPreviousPeriod) {
             // Accumulate metrics for the previous period
            strengthVolumePrevious7Days += metrics.volume;
            cardioDurationPrevious7Days += metrics.duration;
            cardioDistancePrevious7Days += metrics.distance;
            runningDistancePrevious7Days += metrics.runningDistance;
            swimmingDistancePrevious7Days += metrics.swimmingDistance;
            bikingDistancePrevious7Days += metrics.bikingDistance;
            console.log(`[Metrics] Added to PREVIOUS period: ${workout.type}, Date: ${workout.date}, Duration: ${metrics.duration}, Distance: ${metrics.distance}`);
        } else {
            console.log(`[Metrics] Workout OUTSIDE both periods: ${workout.type}, Date: ${workout.date}`);
        }
    }

    console.log("[Metrics] Workouts distribution:", {
      currentPeriod: currentPeriodWorkouts,
      previousPeriod: previousPeriodWorkouts,
      outsidePeriods: outsidePeriodWorkouts,
      total: workouts.length
    });

    console.log("[Metrics] Final Calculated Metrics:", {
      strengthVolumeLast7Days,
      cardioDurationLast7Days,
      cardioDistanceLast7Days,
      strengthVolumePrevious7Days,
      cardioDurationPrevious7Days,
      cardioDistancePrevious7Days,
      runningDistanceLast7Days,
      swimmingDistanceLast7Days,
      bikingDistanceLast7Days,
      runningDistancePrevious7Days,
      swimmingDistancePrevious7Days,
      bikingDistancePrevious7Days
    });

    // --- Construct final result --- 
    const result: DashboardMetrics = {
        strengthVolumeLast7Days,
        cardioDurationLast7Days,
        cardioDistanceLast7Days,
        strengthVolumePrevious7Days,
        cardioDurationPrevious7Days,
        cardioDistancePrevious7Days,
        runningDistanceLast7Days,
        swimmingDistanceLast7Days,
        bikingDistanceLast7Days,
        runningDistancePrevious7Days,
        swimmingDistancePrevious7Days,
        bikingDistancePrevious7Days,
        // topPRs: [], // Keep commented out
        exercisePRs: exercisePRs,
        overallPRs: overallPRs, // <-- Pass overall PRs
        workoutCount: workoutCount,
        hasAiPreferences: hasAiPreferences, // <-- Add flag to return object
    };
    
    // --- Log the final result object --- 
    console.log("[Metrics] Final result object before return:", JSON.stringify(result, null, 2));
    // --- End Log --- 
    return result;

  } catch (error) {
    console.error(`Error calculating dashboard metrics for user ${userId}:`, error);
    // Return default structure on error
    return { 
      strengthVolumeLast7Days: 0, 
      cardioDurationLast7Days: 0, 
      cardioDistanceLast7Days: 0, 
      strengthVolumePrevious7Days: 0, 
      cardioDurationPrevious7Days: 0, 
      cardioDistancePrevious7Days: 0,
      runningDistanceLast7Days: 0,
      swimmingDistanceLast7Days: 0,
      bikingDistanceLast7Days: 0,
      runningDistancePrevious7Days: 0,
      swimmingDistancePrevious7Days: 0,
      bikingDistancePrevious7Days: 0,
      exercisePRs: [], 
      overallPRs: {}, 
      workoutCount: 0, 
      hasAiPreferences: false
    };
  }
} 