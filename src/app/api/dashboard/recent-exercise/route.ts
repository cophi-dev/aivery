import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import WorkoutExerciseModel from "@/lib/db/models/workoutExercise";
import WorkoutModel from "@/lib/db/models/workout";
import ExerciseModel from "@/lib/db/models/exercise";
import ExercisePRModel from "@/lib/db/models/exercisePR";
import mongoose from "mongoose";
import { estimateBodyweightForExercise } from "@/lib/utils";

// Force dynamic execution
export const dynamic = 'force-dynamic';

interface RecentExerciseData {
  exerciseInfo: {
    _id: string;
    name: string;
    category: string;
    muscleGroups: string[];
  };
  workoutInfo: {
    _id: string;
    name: string;
    date: string;
    type: string;
    duration: number;
  };
  performance: {
    sets: Array<{
      weight?: number;
      reps?: number;
      duration?: number;
      distance?: number;
      order?: number;
    }>;
    totalVolume: number;
    totalReps: number;
    maxWeight: number;
    maxReps: number;
    notes?: string;
  };
  insights: {
    summary: string;
    progressIndicator: 'improving' | 'maintaining' | 'declining' | 'first-time';
    comparisonWithPrevious?: {
      weightChange: number;
      repsChange: number;
      volumeChange: number;
    };
    personalRecord?: {
      isNewPR: boolean;
      type: 'weight' | 'reps' | 'volume';
      value: number;
      unit: string;
    };
  };
  navigation: {
    exerciseDetailsUrl: string;
    workoutDetailsUrl: string;
  };
}

export async function GET(request: Request) {
  console.log("[API /dashboard/recent-exercise] Request received.");
  
  try {
    // 1. Authenticate the request
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error("[API /dashboard/recent-exercise] Unauthorized - No session or user ID found.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`[API /dashboard/recent-exercise] User authenticated: ${userId}`);

    await dbConnect();

    // 2. Find the most recent workout exercise
    // @ts-ignore - Mongoose lean with populate has complex typing
    const recentWorkoutExercise = await WorkoutExerciseModel
      .findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('exerciseId')
      .populate('workoutId')
      .sort({ createdAt: -1 })
      .lean();

    if (!recentWorkoutExercise) {
      console.log("[API /dashboard/recent-exercise] No recent exercises found.");
      return NextResponse.json({ 
        message: "No recent exercises found. Start your first workout to see insights here!" 
      }, { status: 404 });
    }

    // @ts-ignore - Populated documents are typed as any
    const exercise = recentWorkoutExercise.exerciseId;
    // @ts-ignore - Populated documents are typed as any
    const workout = recentWorkoutExercise.workoutId;

    if (!exercise || !workout) {
      console.log("[API /dashboard/recent-exercise] Missing exercise or workout data.");
      return NextResponse.json({ 
        message: "Invalid exercise data found." 
      }, { status: 404 });
    }

    // 3. Calculate performance metrics
    // @ts-ignore - Document property access
    const sets = recentWorkoutExercise.sets || [];
    let totalVolume = 0;
    let totalReps = 0;
    let maxWeight = 0;
    let maxReps = 0;

    const isBodyweight = exercise.category === 'bodyweight' || 
                        exercise.muscleGroups?.includes('bodyweight') ||
                        !sets.some((set: any) => set.weight > 0);

    sets.forEach((set: any) => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      
      // Use estimated bodyweight for bodyweight exercises
      let effectiveWeight = weight;
      if (isBodyweight && weight === 0 && reps > 0) {
        effectiveWeight = estimateBodyweightForExercise(exercise.name);
      }
      
      totalVolume += effectiveWeight * reps;
      totalReps += reps;
      maxWeight = Math.max(maxWeight, effectiveWeight);
      maxReps = Math.max(maxReps, reps);
    });

    // 4. Get previous workout for comparison
    // @ts-ignore - Mongoose lean with populate has complex typing
    const previousWorkoutExercise = await WorkoutExerciseModel
      .findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        // @ts-ignore - Document property access
        exerciseId: recentWorkoutExercise.exerciseId,
        // @ts-ignore - Document property access
        _id: { $ne: recentWorkoutExercise._id }
      })
      .populate('workoutId')
      .sort({ createdAt: -1 })
      .lean();

    // 5. Calculate comparison metrics
    let comparisonWithPrevious;
    let progressIndicator: 'improving' | 'maintaining' | 'declining' | 'first-time' = 'first-time';

    if (previousWorkoutExercise) {
      // @ts-ignore - Document property access
      const prevSets = previousWorkoutExercise.sets || [];
      let prevTotalVolume = 0;
      let prevTotalReps = 0;
      let prevMaxWeight = 0;

      prevSets.forEach((set: any) => {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        
        let effectiveWeight = weight;
        if (isBodyweight && weight === 0 && reps > 0) {
          effectiveWeight = estimateBodyweightForExercise(exercise.name);
        }
        
        prevTotalVolume += effectiveWeight * reps;
        prevTotalReps += reps;
        prevMaxWeight = Math.max(prevMaxWeight, effectiveWeight);
      });

      comparisonWithPrevious = {
        weightChange: maxWeight - prevMaxWeight,
        repsChange: totalReps - prevTotalReps,
        volumeChange: totalVolume - prevTotalVolume
      };

      // Determine progress indicator
      if (totalVolume > prevTotalVolume * 1.05) {
        progressIndicator = 'improving';
      } else if (totalVolume < prevTotalVolume * 0.95) {
        progressIndicator = 'declining';
      } else {
        progressIndicator = 'maintaining';
      }
    }

    // 6. Check for personal records
    // @ts-ignore - Mongoose lean with complex queries
    const recentPR = await ExercisePRModel
      .findOne({
        userId: new mongoose.Types.ObjectId(userId),
        // @ts-ignore - Document property access
        exerciseId: recentWorkoutExercise.exerciseId,
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      })
      .sort({ date: -1 })
      .lean();

    let personalRecord;
    if (recentPR) {
      personalRecord = {
        isNewPR: true,
        // @ts-ignore - Document property access
        type: recentPR.type as 'weight' | 'reps' | 'volume',
        // @ts-ignore - Document property access
        value: recentPR.value,
        // @ts-ignore - Document property access
        unit: recentPR.unit
      };
    }

    // 7. Generate insights
    let summary = "";
    if (progressIndicator === 'first-time') {
      summary = `Great start with ${exercise.name}! This is your first recorded session.`;
    } else if (progressIndicator === 'improving') {
      summary = `Excellent progress! Your ${exercise.name} performance has improved.`;
    } else if (progressIndicator === 'maintaining') {
      summary = `Steady progress with ${exercise.name}. Consistency is key!`;
    } else {
      summary = `Your ${exercise.name} performance dipped slightly. Consider adjusting rest or form.`;
    }

    if (personalRecord?.isNewPR) {
      summary += ` 🎉 New ${personalRecord.type} PR: ${personalRecord.value}${personalRecord.unit}!`;
    }

    // 8. Format response
    const responseData: RecentExerciseData = {
      exerciseInfo: {
        _id: exercise._id.toString(),
        name: exercise.name,
        category: exercise.category || 'strength',
        muscleGroups: exercise.muscleGroups || []
      },
      workoutInfo: {
        _id: workout._id.toString(),
        name: workout.name || `${workout.type} workout`,
        date: workout.date.toISOString(),
        type: workout.type,
        duration: workout.duration || 0
      },
      performance: {
        sets: sets.map((set: any) => ({
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance,
          order: set.order
        })),
        totalVolume: Math.round(totalVolume * 100) / 100,
        totalReps,
        maxWeight: Math.round(maxWeight * 100) / 100,
        maxReps,
        // @ts-ignore - Document property access
        notes: recentWorkoutExercise.notes
      },
      insights: {
        summary,
        progressIndicator,
        comparisonWithPrevious,
        personalRecord
      },
      navigation: {
        exerciseDetailsUrl: `/exercises/${exercise._id}`,
        workoutDetailsUrl: `/workouts/${workout._id}`
      }
    };

    console.log("[API /dashboard/recent-exercise] Data fetched successfully");
    return NextResponse.json(responseData);

  } catch (error) {
    console.error("[API /dashboard/recent-exercise] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent exercise data" },
      { status: 500 }
    );
  }
} 