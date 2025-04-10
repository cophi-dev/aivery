import { subWeeks, parseISO, isValid } from "date-fns";

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
    topPRs: PersonalRecordEntry[]; // Array of top personal records
}

// --- Bodyweight Estimation Helper ---
// Include this if needed for volume calculation of bodyweight exercises
const estimateBodyweightForExercise = (exerciseName: string): number => {
    const defaultBodyweight = 75; // Use a reasonable default or fetch from user profile
    const bodyweightExercises: Record<string, number> = {
        "pull up": 1.0, "chin up": 1.0,
        "push up": 0.65,
        "dip": 0.9,
        "bodyweight squat": 0.8, 
        "lunge": 0.4,
        // Add more exercises and their estimated bodyweight percentage used
    };
    const normalizedName = exerciseName.toLowerCase().trim();
    for (const [exerciseKey, percentage] of Object.entries(bodyweightExercises)) {
        if (normalizedName.includes(exerciseKey)) {
            return Math.round(defaultBodyweight * percentage);
        }
    }
    return 0; // Return 0 if not a recognized bodyweight exercise or has no weight
}

// --- Main Metrics Calculation Function ---
export function calculateDashboardMetrics(workouts: WorkoutData[]): DashboardMetrics {
    if (!workouts || workouts.length === 0) {
        return { strengthVolumeLast7Days: 0, cardioDurationLast7Days: 0, topPRs: [] };
    }

    const oneWeekAgo = subWeeks(new Date(), 1);
    let totalVolume = 0;
    let totalCardioDuration = 0;
    const personalRecords: Record<string, { weight: number; date: Date }> = {};

    workouts.forEach(workout => {
        let workoutDate: Date;
        try {
            workoutDate = parseISO(workout.date as string); // Assuming date is ISO string
            if (!isValid(workoutDate)) throw new Error('Invalid date');
        } catch (e) {
            console.warn(`[Metrics] Skipping workout - invalid date format: ${workout.date}`);
            return; // Skip this workout if date is invalid
        }

        const isLast7Days = workoutDate >= oneWeekAgo;

        // Calculate Strength Volume (Last 7 Days)
        if (isLast7Days && workout.type === 'strength') {
            let calculatedVolumeFromSets = 0;
            if (workout.exercises && workout.exercises.length > 0) {
                workout.exercises.forEach(exercise => {
                    if (exercise.sets && exercise.sets.length > 0) {
                        const exerciseVolume = exercise.sets.reduce((sum, set) => {
                            const weight = set.weight ?? 0;
                            const reps = set.reps ?? 0;
                            const effectiveWeight = weight > 0 ? weight : estimateBodyweightForExercise(exercise.name);
                            return sum + (effectiveWeight * reps);
                        }, 0);
                        calculatedVolumeFromSets += exerciseVolume;
                    }
                });
            }
            
            // Use volume calculated from sets if > 0, otherwise use top-level volume if available
            if (calculatedVolumeFromSets > 0) {
                 totalVolume += calculatedVolumeFromSets;
            } else if (workout.volume && workout.volume > 0) {
                 totalVolume += workout.volume;
            }
        }

        // Calculate Cardio Duration (Last 7 Days - Running, Cycling, Swimming)
        const cardioTypes = ['running', 'cycling', 'swimming']; // Use schema enum values
        if (isLast7Days && cardioTypes.includes(workout.type || '')) {
            // Add duration if it exists and is positive
            const durationToAdd = workout.duration ?? 0;
            if (durationToAdd > 0) {
                totalCardioDuration += durationToAdd;
            }
        }

        // Calculate Personal Records (All Time, for relevant exercises)
        if (workout.type === 'strength' && workout.exercises) {
            workout.exercises.forEach(exercise => {
                // Define exercises for which you want to track PRs (e.g., compound lifts)
                const trackPRExercises = ['bench press', 'squat', 'deadlift', 'overhead press']; 
                const normalizedExerciseName = exercise.name.toLowerCase();
                
                if (trackPRExercises.some(tracked => normalizedExerciseName.includes(tracked)) && exercise.sets) {
                    exercise.sets.forEach(set => {
                        const weight = set.weight ?? 0;
                        // Check if this set is a new PR for this exercise name
                        // Group variations (e.g., "Barbell Bench Press" and "Bench Press" might be grouped)
                        // Basic grouping: use the tracked name as the key if found
                        const prKey = trackPRExercises.find(tracked => normalizedExerciseName.includes(tracked)) || normalizedExerciseName;

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

    return {
        strengthVolumeLast7Days: Math.round(totalVolume),
        cardioDurationLast7Days: Math.round(totalCardioDuration), // Return total duration (assuming it's in minutes or seconds)
        topPRs: formattedTopPRs,
    };
} 