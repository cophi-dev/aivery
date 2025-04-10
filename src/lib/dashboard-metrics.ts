import { subWeeks, parseISO, isValid, startOfDay } from "date-fns";
import { estimateBodyweightForExercise } from "@/lib/utils";

// Assuming WorkoutData and ExerciseData types are defined elsewhere (e.g., @/types/db)
// You might need to adjust these types based on your actual data structure
interface SetData {
    weight?: number | null;
    reps?: number | null;
    // Add other relevant set properties if needed
}

interface ExerciseData {
    name: string;
    sets?: SetData[] | null;
    // Add other relevant exercise properties
}

interface WorkoutData {
    _id: string; // Or ObjectId
    date: string | Date;
    type?: string | null;
    distance?: number | null;
    duration?: number | null; // Assuming duration is in minutes for running
    exercises?: ExerciseData[] | null;
    volume?: number | null; // Add optional top-level volume
    cardioDetails?: { // Add optional cardio details
        distance?: number | null;
        // Add other cardioDetails fields if needed by calculation
    } | null;
    // Add other relevant workout properties
}

interface PersonalRecordEntry {
    exerciseName: string;
    weight: number;
    date: string; // Store as ISO string
}

interface DashboardMetrics {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number; // Changed from runningDistance
    cardioDistanceLast7Days: number; // Added distance in meters
    topPRs: PersonalRecordEntry[]; // Array of top personal records
}

// Adjust interfaces to reflect the *serialized* data structure from fetchWorkouts
interface SerializedSetData {
    weight?: number | null;
    reps?: number | null;
    order?: number;
    notes?: string;
    // Add other fields if present after serialization
}

interface SerializedExerciseData {
    _id?: string; // WorkoutExercise ID
    exerciseId?: { // Populated and serialized canonical exercise
        _id?: string;
        name?: string;
        category?: string;
    } | null;
    sets?: SerializedSetData[] | null;
    order?: number;
    notes?: string;
    duration?: number;
    distance?: number;
    // Add other fields if present
}

interface SerializedWorkoutData {
    _id: string; 
    date: string; // ISO String
    type?: string | null;
    name?: string | null; // Added name property
    duration?: number | null;
    distance?: number | null; // Added distance property for cardio workouts
    // Added legacy exercises field for backward compatibility
    exercises?: Array<{
        name: string;
        sets?: Array<{
            weight?: number | null;
            reps?: number | null;
        }> | null;
    }> | null;
    workoutExercises?: SerializedExerciseData[] | null; // Renamed and uses new structure
    cardioDetails?: { // Assuming this might still exist and be serialized
        distance?: number | null;
        // ... other fields ...
    } | null;
    // Add other relevant serialized workout properties
}

// --- Main Metrics Calculation Function (Refactored) ---
export function calculateDashboardMetrics(workouts: SerializedWorkoutData[]): DashboardMetrics {
    console.log(`[Metrics] Received ${workouts?.length ?? 0} workouts for calculation.`); // Log received workouts count
    console.log(`[Metrics DEBUG Input] Dates received by metrics fn: ${workouts?.map((w: any) => w.date).join(', ') || 'Empty array'}`); // ADDED LOG
    
    if (!workouts || workouts.length === 0) {
        return { strengthVolumeLast7Days: 0, cardioDurationLast7Days: 0, cardioDistanceLast7Days: 0, topPRs: [] };
    }

    // Force creating a new date for "now" - make sure timezone issues don't interfere
    const now = new Date();
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    console.log(`[Metrics] Today: ${now.toISOString()}, One week ago: ${oneWeekAgo.toISOString()}`); // Log date boundary
    
    let totalVolume = 0;
    let totalCardioDuration = 0; // In seconds
    let totalCardioDistance = 0; // In meters
    const personalRecords: Record<string, { weight: number; date: Date }> = {};
    
    // RESET accumulated values from previous runs to ensure we're starting fresh
    totalVolume = 0;

    workouts.forEach((workout, index) => {
        console.log(`\n[Metrics] Processing workout #${index + 1} (ID: ${workout._id}, Date: ${workout.date}, Type: ${workout.type}, Name: ${workout.name || 'undefined'}`);
        // Debug workout structure to identify potential issues
        console.log(`[Metrics DEBUG] Workout Structure Keys: ${Object.keys(workout).join(', ')}`);
        
        let workoutDate: Date;
        try {
            // Parse date and set to start of day to avoid time comparison issues
            const parsedDate = parseISO(workout.date as string);
            workoutDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
            if (!isValid(workoutDate)) throw new Error('Invalid date object');
        } catch (e) {
            console.warn(`[Metrics] Skipping workout ${workout._id} - invalid date format or object: ${workout.date}`);
            return; 
        }

        // Simple date comparison using UTC timestamps for start of day
        const isLast7Days = workoutDate.getTime() >= oneWeekAgo.getTime();
        console.log(`[Metrics] Workout Date: ${workoutDate.toISOString()}, Is Last 7 Days: ${isLast7Days}, Comparison: ${workoutDate.getTime()} >= ${oneWeekAgo.getTime()}`);

        // Calculate Strength Volume (Last 7 Days) - Use workoutExercises
        // Handle both old and new workout types for strength
        const workoutTypeStr = workout.type || '';
        const workoutNameStr = (workout.name || '').toLowerCase();
        
        // Check for various strength workout types including "Home Workout"
        const isStrengthWorkout = 
            ['strength', 'gym', 'home_strength', 'Strength'].includes(workoutTypeStr) || 
            workoutTypeStr.toLowerCase().includes('strength') ||
            workoutNameStr.includes('strength') ||
            // Special case for "Home Workout" which doesn't mention "strength"
            (workoutTypeStr === 'Strength' || workoutNameStr.includes('home workout'));
        
        if (isStrengthWorkout) {
            console.log(`[Metrics] Identified as strength workout: "${workoutTypeStr}" (Name: "${workout.name}")`);
            let calculatedVolumeFromSets = 0;
            
            // Basic volume for home workouts with empty exercises
            if (isLast7Days && 
                (workoutNameStr.includes('home workout') || workoutTypeStr === 'Strength') && 
                (!workout.workoutExercises || workout.workoutExercises.length === 0)) {
                
                // Don't assign default volume - only use actual data
                console.log(`[Metrics] Home workout with no exercises - no volume added`);
            }
            // Standard volume calculation
            else if (isLast7Days && workout.workoutExercises && workout.workoutExercises.length > 0) {
                console.log(`[Metrics] Found ${workout.workoutExercises.length} exercises to process`);
                workout.workoutExercises.forEach(exerciseDetail => {
                    // Check if sets exist on the exercise detail
                    if (exerciseDetail.sets && exerciseDetail.sets.length > 0) {
                        const exerciseName = exerciseDetail.exerciseId?.name || ''; // Get name from populated exerciseId
                        console.log(`[Metrics] Processing exercise: ${exerciseName} with ${exerciseDetail.sets.length} sets`);
                        const exerciseVolume = exerciseDetail.sets.reduce((sum, set) => {
                            const weight = set.weight ?? 0;
                            const reps = set.reps ?? 0;
                            // Use bodyweight estimation if weight is 0
                            const effectiveWeight = weight > 0 ? weight : estimateBodyweightForExercise(exerciseName);
                            return sum + (effectiveWeight * reps);
                        }, 0);
                        calculatedVolumeFromSets += exerciseVolume;
                    }
                });
            }
            // Add support for old schema where exercises might be directly on workout
            else if (isLast7Days && workout.exercises && workout.exercises.length > 0) {
                console.log(`[Metrics] Using legacy 'exercises' property with ${workout.exercises.length} exercises`);
                workout.exercises.forEach(exercise => {
                    if (exercise.sets && exercise.sets.length > 0) {
                        const exerciseName = exercise.name || '';
                        const exerciseVolume = exercise.sets.reduce((sum, set) => {
                            const weight = set.weight ?? 0;
                            const reps = set.reps ?? 0;
                            const effectiveWeight = weight > 0 ? weight : estimateBodyweightForExercise(exerciseName);
                            return sum + (effectiveWeight * reps);
                        }, 0);
                        calculatedVolumeFromSets += exerciseVolume;
                    }
                });
            } else {
                console.log(`[Metrics] No exercises found or not in last 7 days. isLast7Days=${isLast7Days}, has exercises=${!!workout.workoutExercises}, count=${workout.workoutExercises?.length || 0}`);
            }
            
            console.log(`[Metrics] Strength - Calculated Volume from Sets: ${calculatedVolumeFromSets}`);
            if (isLast7Days && calculatedVolumeFromSets > 0) { // Only add if calculated AND in last 7 days
                 totalVolume += calculatedVolumeFromSets;
                 console.log(`[Metrics] Added ${calculatedVolumeFromSets} volume from sets. New Total: ${totalVolume}`);
            } 
        }

        // Calculate Cardio Duration (Last 7 Days)
        const cardioTypes = ['run', 'running', 'cycling', 'swimming', 'walk', 'walking', 'hike', 'other']; 
        const workoutTypeLower = (workout.type || '').toLowerCase();
        const isCardioWorkout = cardioTypes.some(type => workoutTypeLower.includes(type)) || 
                               workoutNameStr.includes('run') || 
                               workoutNameStr.includes('walk');

        // Debug workout type
        console.log(`[Metrics] Checking if cardio: "${workout.type}" → "${workoutTypeLower}" → ${isCardioWorkout}`);

        if (isCardioWorkout && isLast7Days) {
            // Add duration
            const durationToAdd = workout.duration ?? 0;
            console.log(`[Metrics] Cardio - Duration Value: ${workout.duration}, Type: ${workout.type}`);
            if (durationToAdd > 0) {
                totalCardioDuration += durationToAdd; 
                console.log(`[Metrics] Added ${durationToAdd}s duration. New Total: ${totalCardioDuration}s`);
            }
            
            // Add distance from cardioDetails if available
            let distanceToAdd = 0;
            // Debug the complete workout object to see where distance is stored
            console.log(`[Metrics] Cardio workout data structure:`, JSON.stringify({
                id: workout._id,
                type: workout.type,
                name: workout.name,
                distance: workout.distance,
                cardioDetails: workout.cardioDetails,
                // Check for more potential distance locations
                directDistance: workout.distance,
                hasCardioDetails: !!workout.cardioDetails,
                cardioDetailsDistance: workout.cardioDetails?.distance,
            }));

            if (workout.cardioDetails?.distance) {
                distanceToAdd = workout.cardioDetails.distance;
                console.log(`[Metrics] Found distance in cardioDetails: ${distanceToAdd}`);
            } else if (workout.distance) {
                distanceToAdd = workout.distance;
                console.log(`[Metrics] Found distance directly on workout: ${distanceToAdd}`);
            } 
            // Try looking in different possible locations
            else if (typeof workout.distance === 'string') {
                // Try parsing string distance
                const parsed = parseFloat(workout.distance);
                if (!isNaN(parsed)) {
                    distanceToAdd = parsed;
                    console.log(`[Metrics] Parsed string distance: "${workout.distance}" → ${distanceToAdd}`);
                }
            }
            // Remove default distance assumptions
            else {
                console.log(`[Metrics] No distance data found for this cardio workout. No distance will be added.`);
            }

            // Force cardio distance to be numbers
            if (typeof distanceToAdd !== 'number' || isNaN(distanceToAdd)) {
                console.log(`[Metrics] Distance invalid (${distanceToAdd}), resetting to 0`);
                distanceToAdd = 0;
            }

            if (distanceToAdd > 0) {
                // If distance looks like it's in km, convert to meters
                if (distanceToAdd < 100 && (workoutTypeLower.includes('run') || workoutTypeLower.includes('walk'))) {
                    distanceToAdd *= 1000;
                    console.log(`[Metrics] Distance appears to be in km, converted to meters: ${distanceToAdd}m`);
                }
                
                totalCardioDistance += distanceToAdd;
                console.log(`[Metrics] Added ${distanceToAdd}m distance. New Total: ${totalCardioDistance}m`);
            }
        }

        // Calculate Personal Records (All Time) - Use workoutExercises
        if (workout.type === 'strength' && workout.workoutExercises) {
            workout.workoutExercises.forEach(exerciseDetail => {
                const exerciseName = exerciseDetail.exerciseId?.name || null;
                if (!exerciseName) return; // Skip if no exercise name
                
                const trackPRExercises = ['bench press', 'squat', 'deadlift', 'overhead press']; 
                const normalizedExerciseName = exerciseName.toLowerCase();
                const prKey = trackPRExercises.find(tracked => normalizedExerciseName.includes(tracked)) || normalizedExerciseName;

                if (trackPRExercises.some(tracked => normalizedExerciseName.includes(tracked)) && exerciseDetail.sets) {
                    exerciseDetail.sets.forEach(set => {
                        const weight = set.weight ?? 0;
                        if (weight > (personalRecords[prKey]?.weight || 0)) {
                            personalRecords[prKey] = { weight, date: workoutDate };
                        }
                    });
                }
            });
        }
    });

    // Format Top PRs for display (e.g., top 4 by weight or alphabetically)
    const formattedTopPRs = Object.entries(personalRecords)
        .sort(([,a], [,b]) => b.weight - a.weight) // Sort by weight descending
        .slice(0, 4) // Take top 4
        .map(([exerciseName, record]): PersonalRecordEntry => ({ // Ensure type match
            exerciseName: exerciseName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), // Capitalize name
            weight: record.weight,
            date: record.date.toISOString(), // Pass date as ISO string
        }));

    // Convert totalCardioDuration from seconds to minutes before returning
    const totalCardioMinutes = Math.round(totalCardioDuration / 60);
    console.log(`[Metrics] Final Volume: ${totalVolume}, Final Cardio Duration: ${totalCardioDuration}s (${totalCardioMinutes}m), Final Distance: ${totalCardioDistance}m`);

    return {
        strengthVolumeLast7Days: Math.round(totalVolume),
        cardioDurationLast7Days: totalCardioMinutes,
        cardioDistanceLast7Days: Math.round(totalCardioDistance),
        topPRs: formattedTopPRs,
    };
} 