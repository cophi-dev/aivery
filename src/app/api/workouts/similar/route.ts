import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPreviousWorkoutsByType } from "@/lib/db/repositories/workoutRepository";
import type { WorkoutData } from "@/types/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const workoutType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '5');
    
    if (!workoutType) {
      return NextResponse.json({ error: "Workout type is required" }, { status: 400 });
    }

    // Fetch similar workouts of the same type
    // Using current date and empty workout ID to get recent workouts of this type
    const similarWorkouts = await getPreviousWorkoutsByType(
      userId, 
      workoutType, 
      new Date(), 
      '', // empty current workout ID to get all
      limit
    );
    
    // Transform the data to match our requirements
    const workoutData = similarWorkouts.map((workout: WorkoutData) => ({
      _id: workout._id,
      name: workout.name,
      type: workout.type,
      date: workout.date,
      duration: workout.duration,
      distance: workout.distance,
      calculatedVolume: workout.calculatedVolume,
      intensity: workout.intensity,
      cardioDetails: workout.cardioDetails
    }));

    return NextResponse.json({ workouts: workoutData });

  } catch (error) {
    console.error("[API /workouts/similar] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch similar workouts" }, 
      { status: 500 }
    );
  }
} 