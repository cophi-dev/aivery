import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository";
import { isValidObjectId } from 'mongoose'; // Import ObjectId validation
import { NextRequest, NextResponse } from "next/server"; // Ensure NextResponse is imported
import { getServerSession } from "next-auth"; // Ensure getServerSession is imported
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';
import { formatDistance as formatDistanceUtil } from "@/lib/utils"; // Use existing formatter
import { estimateBodyweightForExercise } from '@/lib/utils/estimateBodyweightForExercise';
import { generateDistanceComparisonText } from '@/lib/workout-distance-comparisons'; // Import the landmark comparison function

// --- Fun Analogy Helpers ---

// Rough estimate: 1 banana ~ 100 kcal
function caloriesToBananas(calories?: number | null): number | null {
    if (!calories || calories <= 0) return null;
    return Math.round(calories / 100);
}

// Estimate: 1 slice of pizza ~ 300 kcal
function caloriesToPizzaSlices(calories?: number | null): number | null {
    if (!calories || calories <= 0) return null;
    const slices = calories / 300;
    if (slices < 0.5) return null; // Only mention if at least half a slice
    return parseFloat(slices.toFixed(1));
}

// Standard track lap = 400 meters = 0.4 km
function distanceToTrackLaps(distanceKm?: number | null): number | null {
    if (!distanceKm || distanceKm <= 0) return null;
    return Math.round(distanceKm / 0.4);
}

// Length of a standard marathon = 42.195 km
function distanceToMarathonFraction(distanceKm?: number | null): number | null {
    if (!distanceKm || distanceKm <= 0) return null;
    const fraction = distanceKm / 42.195;
    if (fraction < 0.1) return null; // Only mention if at least 10%
    return parseFloat(fraction.toFixed(2));
}

// Average car ~ 1500 kg
function volumeToCars(volumeKg?: number | null): number | null {
    if (!volumeKg || volumeKg <= 0) return null;
    const weightRatio = volumeKg / 1500;
    // More lenient threshold to ensure we get comparisons
    if (weightRatio < 0.02) return null; // Just 2% threshold
    return parseFloat(weightRatio.toFixed(2)); // Return as decimal (e.g., 0.5 cars)
}

// Average adult African Elephant ~ 5000 kg
function volumeToElephants(volumeKg?: number | null): number | null {
     if (!volumeKg || volumeKg <= 0) return null;
     const weightRatio = volumeKg / 5000;
     if (weightRatio < 0.05) return null; // Lower threshold to 5%
     return parseFloat(weightRatio.toFixed(2));
}

// Average grand piano ~ 400 kg
function volumeToGrandPianos(volumeKg?: number | null): number | null {
    if (!volumeKg || volumeKg <= 0) return null;
    const pianos = volumeKg / 400;
    if (pianos < 0.25) return null; // Lower threshold to 25% of a piano
    return parseFloat(pianos.toFixed(1));
}

// Refrigerator ~ 100 kg
function volumeToRefrigerators(volumeKg?: number | null): number | null {
    if (!volumeKg || volumeKg <= 0) return null;
    const fridges = volumeKg / 100;
    if (fridges < 0.2) return null; // 20% threshold
    return parseFloat(fridges.toFixed(1));
}

// Washing machine ~ 70 kg
function volumeToWashingMachines(volumeKg?: number | null): number | null {
    if (!volumeKg || volumeKg <= 0) return null;
    const washers = volumeKg / 70;
    if (washers < 0.2) return null; // 20% threshold
    return parseFloat(washers.toFixed(1));
}

// Falls back to smaller objects for low volumes
function getVolumeComparison(volumeKg?: number | null): string | null {
    if (!volumeKg || volumeKg <= 0) return null;
    
    // Try all comparisons in descending order of weight
    const elephants = volumeToElephants(volumeKg);
    if (elephants) {
        return `lifting ${volumeKg.toLocaleString()} kg total? That's like hoisting ${elephants} adult elephant${elephants > 1 ? 's' : ''}! 🐘 Mind=blown!`;
    }
    
    const cars = volumeToCars(volumeKg);
    if (cars) {
        return `in total, you lifted ${volumeKg.toLocaleString()} kg. That's comparable to ${cars} small car${cars > 1 ? 's' : ''}! 🚗 Beep beep!`;
    }
    
    const pianos = volumeToGrandPianos(volumeKg);
    if (pianos) {
        return `you moved ${volumeKg.toLocaleString()} kg today! That's like lifting ${pianos} grand piano${pianos > 1 ? 's' : ''}! 🎹`;
    }
    
    const fridges = volumeToRefrigerators(volumeKg);
    if (fridges) {
        return `you lifted ${volumeKg.toLocaleString()} kg - equivalent to ${fridges} refrigerator${fridges > 1 ? 's' : ''}! 🧊`;
    }
    
    const washers = volumeToWashingMachines(volumeKg);
    if (washers) {
        return `your ${volumeKg.toLocaleString()} kg workout is like lifting ${washers} washing machine${washers > 1 ? 's' : ''}! 🧺`;
    }
    
    // Final fallback for very low volumes
    return `you moved ${volumeKg.toLocaleString()} kg - that's like lifting ${Math.round(volumeKg / 15)} medium-sized dumbbells all at once! 💪`;
}

// --- API Route ---

export async function GET(
  req: NextRequest,
  { params }: { params: { workoutId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    // --- Get User's Display Name ---
    const userName = session.user.nickname || session.user.name || "Fitness Pro"; // Use nickname, fallback to name, then generic
    // --- End Get User's Display Name ---
    const workoutId = params.workoutId;

    if (!workoutId || !ObjectId.isValid(workoutId)) {
        return NextResponse.json({ error: "Valid Workout ID is required" }, { status: 400 });
    }

    await dbConnect();

    const workout = await WorkoutModel.findOne({
        _id: new ObjectId(workoutId),
        userId: new ObjectId(userId)
    }).lean<IWorkout>();

    if (!workout) {
        return NextResponse.json({ error: "Workout not found or not authorized" }, { status: 404 });
    }

    // --- Fun Insight Generation ---
    // Array to hold potential fun fact strings
    const funFacts: string[] = [];
    // Default fun fallback using the user's name
    let insightStatement = `Great ${workout.type} session, ${userName}! Keep up the fantastic effort! 💪`;

    // 1. Distance Facts (Running, Cycling, Walking, Hiking, Swimming)
    if (['running', 'cycling', 'walking', 'hiking', 'swimming'].includes(workout.type) && 
        workout.cardioDetails?.distance && workout.cardioDetails.distance > 0) {
        const distance = workout.cardioDetails.distance;
        const laps = distanceToTrackLaps(distance);
        const marathonFraction = distanceToMarathonFraction(distance);
        const formattedDist = formatDistanceUtil(distance); // Use the util function

        // Use our landmark comparison function (best comparison)
        if (['running', 'cycling'].includes(workout.type)) {
            try {
                const landmarkComparison = generateDistanceComparisonText(distance);
                if (landmarkComparison) {
                    // Already includes the distance value, so add to fun facts directly
                    funFacts.push(`${userName}, ${landmarkComparison}`);
                }
            } catch (error) {
                console.error("Error generating landmark comparison:", error);
            }
        }

        // Add track laps comparison
        if (laps && laps >= 1) {
            funFacts.push(`You covered ${formattedDist}, ${userName}! That's like running ${laps} lap${laps > 1 ? 's' : ''} around a track! 🏃`);
        }
        
        // Add marathon percentage comparison
        if (marathonFraction) {
            funFacts.push(`That ${formattedDist} is about ${(marathonFraction * 100).toFixed(0)}% of a full marathon, ${userName}! Making progress! 🏁`);
        }
        
        // Keep specific landmark comparisons as fallbacks
        if (distance > 2.5 && distance < 3) {
            funFacts.push(`Covering ${formattedDist}? Nice one, ${userName}! That's roughly the length of the Golden Gate Bridge! 🌉`);
        } else if (distance >= 5 && distance < 7) {
            funFacts.push(`${formattedDist} is roughly a 5k distance, ${userName}! Solid run! 👍`);
        } else if (distance >= 10 && distance < 15) {
            funFacts.push(`Hitting the 10k mark (${formattedDist}), ${userName}! Seriously impressive! 🔥`);
        }
    }

    // 2. Volume Facts (Strength) - Fetch WorkoutExercises for this workout
    let calculatedVolume: number | null = null;
    
    if (workout.type === 'strength') {
        try {
            // Import WorkoutExerciseModel
            const WorkoutExerciseModel = (await import("@/lib/db/models/workoutExercise")).default;
            
            // Fetch workout exercises for this workout
            const workoutExercises = await WorkoutExerciseModel.find({ 
                workoutId: workout._id 
            }).populate('exerciseId').lean();
            
            // Calculate volume from workout exercises
            calculatedVolume = workoutExercises.reduce((totalVol, ex) => {
                const exerciseSets = Array.isArray(ex.sets) ? ex.sets : [];
                const exerciseName = ex.exerciseId?.name || '';
                const isBodyweight = estimateBodyweightForExercise(exerciseName) > 0;
                const exerciseVol = exerciseSets.reduce((setVol, set) => {
                    let weight = set.weight ?? 0;
                    if (isBodyweight && (!weight || weight === 0)) {
                        weight = estimateBodyweightForExercise(exerciseName);
                    }
                    return setVol + (weight * (set.reps ?? 0));
                }, 0);
                return totalVol + exerciseVol;
            }, 0);
        } catch (error) {
            console.error("Error calculating volume from workout exercises:", error);
        }
        
        // If we didn't get volume from workout exercises, use the calculated volume from the workout
        if (!calculatedVolume || calculatedVolume <= 0) {
            calculatedVolume = workout.calculatedVolume || null;
        }
    }

    // Generate strength volume comparisons
    if (workout.type === 'strength' && calculatedVolume && calculatedVolume > 0) {
        // Get a single volume comparison that's appropriate for this volume
        const volumeComparison = getVolumeComparison(calculatedVolume);
        if (volumeComparison) {
            funFacts.push(`${userName}, ${volumeComparison}`);
        } else {
            // Fallback with specific, personalized volume mention
            funFacts.push(`You lifted a total volume of ${calculatedVolume.toLocaleString()} kg, ${userName}! Every rep counts! Keep building! 🏋️`);
        }
    }

    // 3. Calorie Facts (Any type with calories)
    // For calorie data, we need to check cardioDetails for cardio workouts or set a reasonable estimate
    let calorieEstimate: number | null = null;
    
    if (workout.type === 'running' || workout.type === 'cycling' || workout.type === 'swimming') {
        // For cardio workouts, we can estimate calories based on duration and intensity
        if (workout.duration) {
            // Basic estimate: ~ 10 calories per minute for moderate intensity
            const caloriesPerMinute = workout.intensity === 'High' ? 14 : 
                                      workout.intensity === 'Medium' ? 10 : 7;
            calorieEstimate = Math.round((workout.duration / 60) * caloriesPerMinute);
        }
    } else if (workout.type === 'strength') {
        // For strength workouts, estimate based on duration
        if (workout.duration) {
            // Basic estimate: ~ 5-8 calories per minute
            calorieEstimate = Math.round((workout.duration / 60) * 7);
        }
    }
    
    if (calorieEstimate && calorieEstimate > 50) { // Only if meaningful calories burned
        const bananas = caloriesToBananas(calorieEstimate);
        const pizzaSlices = caloriesToPizzaSlices(calorieEstimate);

        if (pizzaSlices) {
             funFacts.push(`You burned ~${calorieEstimate} calories, ${userName}! That's roughly ${pizzaSlices} slice${pizzaSlices > 1 ? 's' : ''} of pizza! 🍕 Worth it!`);
        } else if (bananas && bananas > 0) { // Fallback to bananas if not enough for pizza
             funFacts.push(`Torching ~${calorieEstimate} calories? Nice, ${userName}! That's the energy in about ${bananas} banana${bananas > 1 ? 's' : ''}! 🍌`);
        }
    }

    // 4. Duration Facts (Fallback if no other specific facts generated)
    if (funFacts.length === 0 && workout.duration && workout.duration > 600) { // Min 10 mins
         const durationMinutes = Math.round(workout.duration / 60);
         if (durationMinutes > 20 && durationMinutes < 40) {
              funFacts.push(`A solid ${durationMinutes}-minute session, ${userName}! About the length of a good TV episode! 📺`);
         } else if (durationMinutes >= 45 && durationMinutes < 75) {
              funFacts.push(`Wow, ${userName}, you powered through for ${durationMinutes} minutes! That's some serious dedication! ⏳`);
         } else if (durationMinutes >= 75) {
             funFacts.push(`${durationMinutes} minutes of dedication, ${userName}! You're absolutely crushing it! 🔥`);
         }
    }

    // --- Add Generic Encouragement Facts ---
    // These are added regardless of specific metrics to increase variety
    funFacts.push(`Awesome consistency, ${userName}! Keep showing up! ✨`);
    funFacts.push(`You're building momentum, ${userName}! Great work! 🚀`);
    if (workout.type === 'strength') {
       funFacts.push(`Strength takes time, ${userName}. Proud of your effort today! 💪`);
    }
    if (['running', 'cycling', 'swimming'].includes(workout.type)) {
       funFacts.push(`Pushing your endurance, ${userName}! Keep moving! 💨`);
    }

    // --- Combine Facts for the Final Statement ---
    if (funFacts.length > 0) {
        // Instead of random, prioritize real comparisons (they're more engaging)
        // Sort the fun facts so that real comparisons come first
        const sortedFacts = funFacts.sort((a, b) => {
            const hasComparisonA = a.includes("like") || a.includes("equivalent") || a.includes("comparable");
            const hasComparisonB = b.includes("like") || b.includes("equivalent") || b.includes("comparable");
            
            if (hasComparisonA && !hasComparisonB) return -1;
            if (!hasComparisonA && hasComparisonB) return 1;
            return 0;
        });
        
        // Use the first fact (which should be a comparison if available)
        insightStatement = sortedFacts[0];
    }
    // If funFacts is empty, the personalized default insightStatement remains.

    console.log(`Generated insight for workout ${workoutId} for ${userName}: "${insightStatement}"`);
    return NextResponse.json({ insight: insightStatement });

  } catch (error) {
    console.error(`API Insight Error for workout ${params?.workoutId}:`, error);
    // Attempt to get user name for error message too, if possible within catch scope limitations
    const session = await getServerSession(authOptions);
    const userName = session?.user?.nickname || session?.user?.name || "there";
    return NextResponse.json(
      // Keep a positive fallback even on error, personalized
      { insight: `Awesome effort on that workout, ${userName}! Keep it up!` },
      { status: 500 }
    );
  }
} 