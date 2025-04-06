import { getWorkoutsByUserId } from "@/lib/db/repositories/workoutRepository";
import { isValidObjectId } from 'mongoose'; // Import ObjectId validation
import { NextRequest, NextResponse } from "next/server"; // Ensure NextResponse is imported
import { getServerSession } from "next-auth"; // Ensure getServerSession is imported
import { authOptions } from "@/lib/auth";
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel, { IWorkout } from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';
import { formatDistance as formatDistanceUtil } from "@/lib/utils"; // Use existing formatter

// --- Fun Analogy Helpers ---

// Rough estimate: 1 banana ~ 100 kcal
function caloriesToBananas(calories?: number | null): number | null {
    if (!calories || calories <= 0) return null;
    return Math.round(calories / 100);
}

// Standard track lap = 400 meters = 0.4 km
function distanceToTrackLaps(distanceKm?: number | null): number | null {
    if (!distanceKm || distanceKm <= 0) return null;
    return Math.round(distanceKm / 0.4);
}

// Average car ~ 1500 kg
function volumeToCars(volumeKg?: number | null): number | null {
    if (!volumeKg || volumeKg <= 0) return null;
    const weightRatio = volumeKg / 1500;
    // Return only if it's a somewhat meaningful fraction or multiple
    if (weightRatio < 0.05) return null; // Less than 5% of a car isn't very intuitive
    return parseFloat(weightRatio.toFixed(2)); // Return as decimal (e.g., 0.5 cars)
}

// Average adult African Elephant ~ 5000 kg
function volumeToElephants(volumeKg?: number | null): number | null {
     if (!volumeKg || volumeKg <= 0) return null;
     const weightRatio = volumeKg / 5000;
     if (weightRatio < 0.1) return null; // Less than 10% of an elephant
     return parseFloat(weightRatio.toFixed(2));
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
    let insightStatement = `You absolutely crushed this ${workout.type} workout! Great job! 💪`; // Default fun fallback
    const funFacts: string[] = [];

    // 1. Distance Facts (Running, Cycling, Walking, Hiking, Swimming)
    if (['running', 'cycling', 'walking', 'hiking', 'swimming'].includes(workout.type) && workout.distance && workout.distance > 0) {
        const laps = distanceToTrackLaps(workout.distance);
        const formattedDist = formatDistanceUtil(workout.distance); // Use the util function
        if (laps && laps > 0) {
            funFacts.push(`That's like running ${laps} lap${laps > 1 ? 's' : ''} around a track! 🏃`);
        }
         // Add another distance comparison (e.g., length of Golden Gate Bridge ~ 2.7km)
         if (workout.distance > 2 && workout.distance < 4) {
             funFacts.push(`You covered about the length of the Golden Gate Bridge! 🌉`);
         } else if (workout.distance >= 5 && workout.distance < 7) {
              funFacts.push(`That's roughly a 5k run distance, nice! 👍`);
         }
    }

    // 2. Volume Facts (Strength) - Calculate volume if not stored
    let calculatedVolume: number | null = workout.volume ?? null;
    if (!calculatedVolume && workout.type === 'strength' && workout.exercises) {
         // Basic volume calculation placeholder (sum of weight * reps)
         calculatedVolume = workout.exercises.reduce((totalVol, ex) => {
             // Ensure sets exists and is an array before reducing
             const exerciseSets = Array.isArray(ex.sets) ? ex.sets : [];
             const exerciseVol = exerciseSets.reduce((setVol, set) => setVol + ((set.weight ?? 0) * (set.reps ?? 0)), 0);
             return totalVol + exerciseVol;
         }, 0);
    }

    if (workout.type === 'strength' && calculatedVolume && calculatedVolume > 0) {
        const cars = volumeToCars(calculatedVolume);
        const elephants = volumeToElephants(calculatedVolume);

        if (elephants && elephants >= 0.1) {
            funFacts.push(`In total, you lifted about the weight of ${elephants} adult elephant${elephants > 1 ? 's' : ''}! 🐘 Wow!`);
        } else if (cars && cars >= 0.1) {
             funFacts.push(`That's like lifting ${cars} ${cars > 1 ? 'small cars' : 'small car'}! 🚗 Strong work!`);
        } else {
             // Fallback for smaller volumes
             funFacts.push(`You lifted a total volume of ${calculatedVolume.toLocaleString()} kg! Keep building! 🏋️`);
        }
    }

    // 3. Calorie Facts (Any type with calories)
    if (workout.calories && workout.calories > 50) { // Only if meaningful calories burned
        const bananas = caloriesToBananas(workout.calories);
        if (bananas && bananas > 0) {
             funFacts.push(`You burned roughly the energy of ${bananas} banana${bananas > 1 ? 's' : ''}! 🍌`);
        }
    }

    // 4. Duration Facts (Fallback if no other facts generated)
    if (funFacts.length === 0 && workout.duration && workout.duration > 600) { // Min 10 mins
         const durationMinutes = Math.round(workout.duration / 60);
         if (durationMinutes > 20 && durationMinutes < 40) {
              funFacts.push(`That ${durationMinutes}-minute session is about the length of a TV sitcom episode! 📺`);
         } else if (durationMinutes >= 45) {
              funFacts.push(`You powered through for ${durationMinutes} minutes! That's dedication! ⏳`);
         }
    }

    // --- Combine Facts for the Final Statement --- 
    if (funFacts.length === 1) {
        // If only one fact, use it directly
        insightStatement = funFacts[0];
    } else if (funFacts.length >= 2) {
        // If two or more, combine the first two for variety
        // Make the second fact start lowercase for better flow
        insightStatement = `${funFacts[0]} Plus, ${funFacts[1].charAt(0).toLowerCase() + funFacts[1].slice(1)}`;
    }
    // If funFacts is empty, the default insightStatement remains.

    console.log(`Generated insight for workout ${workoutId}: "${insightStatement}"`);
    return NextResponse.json({ insight: insightStatement });

  } catch (error) {
    console.error(`API Insight Error for workout ${params?.workoutId}:`, error);
    return NextResponse.json(
      // Keep a positive fallback even on error
      { insight: "Awesome effort on that workout! Keep it up!" },
      { status: 500 }
    );
  }
} 