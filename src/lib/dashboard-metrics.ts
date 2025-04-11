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

    // IMPORTANT: Use the actual current date, not dates from workouts
    // Get the current real date as our reference point
    const now = new Date();
    
    // Set the reference date
    const referenceDate = now;
    console.log(`[Metrics] Real current date for calculations: ${referenceDate.toISOString()}`);
    
    // IMPORTANT: Instead of focusing on dates, focus on the most recent workouts
    // Get the 7 most recent workouts for a more accurate representation
    
    // RESET accumulated values from previous runs to ensure we're starting fresh
    let totalVolume = 0;
    
    // Sort workouts by date (newest first)
    const sortedWorkouts = [...workouts].sort((a, b) => {
        try {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        } catch (e) {
            return 0;
        }
    });
    
    // Log just the date ranges in the data
    if (sortedWorkouts.length > 0) {
        const newestDate = new Date(sortedWorkouts[0].date);
        const oldestDate = new Date(sortedWorkouts[sortedWorkouts.length - 1].date);
        console.log(`[Metrics] Workout date range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}`);
    }
    
    // Take the 7 most recent workouts regardless of date
    const recentWorkouts = sortedWorkouts.slice(0, 7);
    
    // Create a set of recent workout IDs for fast lookup
    const recentWorkoutIds = new Set(recentWorkouts.map(w => w._id));
    
    console.log(`[Metrics] Using ${recentWorkouts.length} most recent workouts:`, 
        recentWorkouts.map(w => ({
            id: w._id.toString().slice(-4),
            date: w.date?.split('T')[0] || new Date(w.date).toISOString().split('T')[0],
            type: w.type,
            name: w.name?.substring(0, 20),
            duration: w.duration
        }))
    );
    
    let totalCardioDuration = 0; // In seconds
    let totalCardioDistance = 0; // In meters
    const personalRecords: Record<string, { weight: number; date: Date }> = {};
    
    workouts.forEach((workout, index) => {
        const isRecentWorkout = recentWorkoutIds.has(workout._id);
        
        console.log(`\n[Metrics] Processing workout #${index + 1} (ID: ${workout._id}, Date: ${workout.date}, Type: ${workout.type}, Name: ${workout.name || 'undefined'}, Recent: ${isRecentWorkout}`);
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

        console.log(`[Metrics] Workout Date: ${workoutDate.toISOString()}, Is Recent: ${isRecentWorkout}`);

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
            if (isRecentWorkout && 
                (workoutNameStr.includes('home workout') || workoutTypeStr === 'Strength') && 
                (!workout.workoutExercises || workout.workoutExercises.length === 0) && 
                (!workout.exercises || workout.exercises.length === 0)) {
                
                // Don't assign default volume - only use actual data
                console.log(`[Metrics] Home workout with no exercises - no volume added`);
            }
            // First try to use the new workoutExercises field
            else if (isRecentWorkout && workout.workoutExercises && workout.workoutExercises.length > 0) {
                console.log(`[Metrics] Found ${workout.workoutExercises.length} workout exercises to process`);
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
            // Fallback to old schema where exercises might be directly on workout
            else if (isRecentWorkout && workout.exercises && workout.exercises.length > 0) {
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
                console.log(`[Metrics] No exercises found or not a recent workout. isRecent=${isRecentWorkout}, has workoutExercises=${!!workout.workoutExercises}, count=${workout.workoutExercises?.length || 0}`);
            }
            
            console.log(`[Metrics] Strength - Calculated Volume from Sets: ${calculatedVolumeFromSets}`);
            if (isRecentWorkout && calculatedVolumeFromSets > 0) { // Only add if calculated AND in last 7 days
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

        if (isCardioWorkout && isRecentWorkout) {
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
            console.log(`[Metrics] Cardio workout ${workout._id.slice(-4)} (${workoutDate.toISOString().split('T')[0]}) data:`, JSON.stringify({
                name: workout.name,
                type: workout.type,
                distance: workout.distance,
                isDated2025: workoutDate.getFullYear() === 2025,
                // Check for distance across different properties
                directDistance: workout.distance,
                hasCardioDetails: !!workout.cardioDetails,
                cardioDetailsDistance: workout.cardioDetails?.distance,
                // Check workout exercises for distance
                workoutExercisesCount: workout.workoutExercises?.length || 0,
                hasWorkoutExercisesWithDistance: workout.workoutExercises?.some(ex => !!ex.distance) || false,
                // Show sample workout exercise if available
                sampleExercise: workout.workoutExercises && workout.workoutExercises.length > 0 ? {
                    id: workout.workoutExercises[0]._id,
                    exerciseName: workout.workoutExercises[0].exerciseId?.name,
                    distance: workout.workoutExercises[0].distance,
                    isCardio: workout.workoutExercises[0].exerciseId?.category === 'cardio'
                } : null
            }, null, 2).substring(0, 500));

            // First, check if we have distance on the workout exercises (new schema)
            if (workout.workoutExercises && workout.workoutExercises.length > 0) {
                // Look for any workout exercises with distance
                for (const ex of workout.workoutExercises) {
                    if (ex.distance && ex.distance > 0) {
                        // Ensure distance is a number
                        let exDistance = typeof ex.distance === 'string' ? parseFloat(ex.distance) : ex.distance;
                        console.log(`[Metrics] Found raw distance value of type ${typeof ex.distance}: ${ex.distance} in workout exercise ${ex.exerciseId?.name || 'unnamed'}`);
                        
                        if (!isNaN(exDistance)) {
                            // Check if distance might be in kilometers and needs conversion to meters
                            if (exDistance < 100 && (workoutTypeLower.includes('run') || workoutTypeLower.includes('walk'))) {
                                console.log(`[Metrics] Distance appears to be in km (${exDistance}), converting to meters`);
                                exDistance *= 1000;
                            }
                            
                            distanceToAdd += exDistance;
                            console.log(`[Metrics] Added distance ${exDistance}m from workout exercise ${ex.exerciseId?.name || 'unnamed'}`);
                        }
                    }
                }
            }
            
            // If we didn't find distance in workout exercises, try cardioDetails (legacy)
            if (distanceToAdd === 0 && workout.cardioDetails?.distance) {
                // Ensure distance is a number
                let cdDistance = typeof workout.cardioDetails.distance === 'string' 
                    ? parseFloat(workout.cardioDetails.distance) 
                    : workout.cardioDetails.distance;
                
                console.log(`[Metrics] Found raw cardioDetails.distance value of type ${typeof workout.cardioDetails.distance}: ${workout.cardioDetails.distance}`);
                
                if (!isNaN(cdDistance)) {
                    // Check if distance might be in kilometers and needs conversion to meters
                    if (cdDistance < 100 && (workoutTypeLower.includes('run') || workoutTypeLower.includes('walk'))) {
                        console.log(`[Metrics] Distance appears to be in km (${cdDistance}), converting to meters`);
                        cdDistance *= 1000;
                    }
                    
                    distanceToAdd = cdDistance;
                    console.log(`[Metrics] Using distance from cardioDetails: ${distanceToAdd}m`);
                }
            } 
            // Or try distance directly on workout (also legacy)
            else if (distanceToAdd === 0 && workout.distance) {
                // Ensure distance is a number
                let wDistance = typeof workout.distance === 'string' 
                    ? parseFloat(workout.distance) 
                    : workout.distance;
                
                console.log(`[Metrics] Found raw workout.distance value of type ${typeof workout.distance}: ${workout.distance}`);
                
                if (!isNaN(wDistance)) {
                    // Check if distance might be in kilometers and needs conversion to meters
                    if (wDistance < 100 && (workoutTypeLower.includes('run') || workoutTypeLower.includes('walk'))) {
                        console.log(`[Metrics] Distance appears to be in km (${wDistance}), converting to meters`);
                        wDistance *= 1000;
                    }
                    
                    distanceToAdd = wDistance;
                    console.log(`[Metrics] Using distance directly from workout: ${distanceToAdd}m`);
                }
            }
            
            // If it's a walking workout with duration but no distance, estimate distance
            if (distanceToAdd === 0) {
                // For walking workouts with duration but no distance, estimate distance
                // Average walking pace is ~5 km/h = 1.38 m/s
                if (workout.duration && workout.duration > 0 && 
                    (workoutTypeLower === 'walking' || workoutNameStr.includes('walk'))) {
                    
                    const durationSecs = workout.duration;
                    // Calculate estimated distance: 1.38 m/s * duration in seconds
                    const estimatedMeters = Math.round(1.38 * durationSecs);
                    
                    console.log(`[Metrics] No distance found for walking workout. Estimating based on duration: ${durationSecs}s → ${estimatedMeters}m`);
                    distanceToAdd = estimatedMeters;
                } 
                // For running workouts, check if distance is in the name (e.g. "4km")
                else if (workout.duration && workout.duration > 0 &&
                         (workoutTypeLower === 'running' || workoutNameStr.includes('run'))) {
                    // Try to extract distance from workout name if it's there (e.g., "4km", "5k", etc.)
                    const distanceMatch = workoutNameStr.match(/\((\d+(?:\.\d+)?)\s*(?:km|k)\)/i);
                    if (distanceMatch && distanceMatch[1]) {
                        const extractedKm = parseFloat(distanceMatch[1]);
                        if (!isNaN(extractedKm) && extractedKm > 0) {
                            // Convert km to meters
                            const extractedMeters = Math.round(extractedKm * 1000);
                            console.log(`[Metrics] Extracted distance from workout name: ${extractedKm}km → ${extractedMeters}m`);
                            distanceToAdd = extractedMeters;
                        }
                    } else {
                        // If we can't extract distance from the name, use a reasonable pace (3.33 m/s or 5 min/km)
                        const estimatedMeters = Math.round(3.33 * workout.duration);
                        console.log(`[Metrics] No distance found for running workout. Estimating based on duration: ${workout.duration}s → ${estimatedMeters}m`);
                        distanceToAdd = estimatedMeters;
                    }
                } else {
                    console.log(`[Metrics] No distance data found for this cardio workout. No distance will be added.`);
                }
            }

            // Add to total if we found a valid distance
            if (distanceToAdd > 0) {
                // Sanity check: cap unreasonably large distances (over 100km in a single workout)
                if (distanceToAdd > 100000) {
                    console.log(`[Metrics] WARNING: Unreasonably large distance detected (${distanceToAdd}m). Capping to 100km.`);
                    distanceToAdd = 100000;
                }
                
                totalCardioDistance += distanceToAdd;
                console.log(`[Metrics] Added ${distanceToAdd}m distance. New Total: ${totalCardioDistance}m`);
            }
        }

        // Calculate Personal Records (from any non-empty workout) - New
        // Check both workoutExercises (new schema) and exercises (legacy schema)
        const hasExerciseSets = 
            (workout.workoutExercises && workout.workoutExercises.some(exercise => 
                exercise.sets && exercise.sets.length > 0)) || 
            (workout.exercises && workout.exercises.some(exercise => 
                exercise.sets && exercise.sets.length > 0));

        if (hasExerciseSets) {
            // Define a type for the exercise object we'll process
            interface ProcessableExercise {
                name: string;
                sets?: Array<{
                    weight?: number | null;
                    reps?: number | null;
                }> | null;
            }
            
            let exercisesToProcess: ProcessableExercise[] = [];
            
            // Check for new workout exercise structure first
            if (workout.workoutExercises && workout.workoutExercises.length > 0) {
                console.log(`[Metrics] Checking ${workout.workoutExercises.length} workout exercises for PRs`);
                exercisesToProcess = workout.workoutExercises.map(we => ({
                    name: we.exerciseId?.name || 'Unknown Exercise',
                    sets: we.sets || []
                }));
            } 
            // Fallback to legacy structure
            else if (workout.exercises && workout.exercises.length > 0) {
                console.log(`[Metrics] Checking ${workout.exercises.length} legacy exercises for PRs`);
                exercisesToProcess = workout.exercises;
            }
            
            // Process all exercises for PRs
            exercisesToProcess.forEach(exercise => {
                if (!exercise.sets || exercise.sets.length === 0) return;
                
                const exerciseName = exercise.name;
                console.log(`[Metrics] Checking for PRs in exercise: ${exerciseName}`);
                
                // Find max weight in this exercise
                const maxWeight = exercise.sets.reduce((max: number, set: { weight?: number | null; reps?: number | null }) => {
                    const weight = set.weight || 0;
                    const reps = set.reps || 0;
                    
                    // Only count sets with both weight and reps
                    if (weight > 0 && reps > 0) {
                        return Math.max(max, weight);
                    }
                    return max;
                }, 0);
                
                // Check if this is a PR for this exercise
                if (maxWeight > 0) {
                    const currentPR = personalRecords[exerciseName];
                    const workoutDateObj = new Date(workout.date);
                    
                    if (!currentPR || maxWeight > currentPR.weight) {
                        console.log(`[Metrics] New PR for ${exerciseName}: ${maxWeight}kg`);
                        personalRecords[exerciseName] = { 
                            weight: maxWeight, 
                            date: workoutDateObj 
                        };
                    }
                }
            });
        }
    });
    
    // Convert PRs to sorted array format
    const topPRs = Object.entries(personalRecords)
        .map(([exerciseName, details]) => ({
            exerciseName,
            weight: details.weight,
            date: details.date.toISOString()
        }))
        // Sort by weight (descending)
        .sort((a, b) => b.weight - a.weight)
        // Limit to top 5 PRs
        .slice(0, 5);
    
    console.log(`[Metrics] Final Strength Volume Total: ${totalVolume}`);
    console.log(`[Metrics] Final Cardio Duration Total: ${totalCardioDuration}`);
    console.log(`[Metrics] Final Cardio Distance Total: ${totalCardioDistance}m`);
    console.log(`[Metrics] Total PRs found: ${topPRs.length}`);
    
    // Log a summary of workouts included in the last 7 days
    const includedWorkouts = workouts.filter(w => recentWorkoutIds.has(w._id));
    
    console.log(`[Metrics] Recent workouts (${includedWorkouts.length}):`, 
        includedWorkouts.map(w => ({
            id: w._id.toString().slice(-4),
            date: w.date,
            type: w.type,
            name: w.name,
            duration: w.duration,
            distance: w.distance,
            hasWorkoutExercises: !!(w.workoutExercises && w.workoutExercises.length)
        }))
    );
    
    return {
        strengthVolumeLast7Days: Math.round(totalVolume),
        cardioDurationLast7Days: totalCardioDuration, // Keep in seconds for correct formatting in UI
        cardioDistanceLast7Days: Math.round(totalCardioDistance), // Round to nearest meter
        topPRs
    };
} 