import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRecentWorkouts } from "@/lib/db/repositories/workoutRepository";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Fetch recent workouts (last 10)
    const recentWorkouts = await getRecentWorkouts(userId, 10);
    
    // Transform the data to match our insights requirements
    const workoutInsights = recentWorkouts.map(workout => ({
      _id: workout._id,
      date: workout.date,
      type: workout.type,
      name: workout.name,
      duration: workout.duration,
      distance: workout.distance,
      calculatedVolume: workout.calculatedVolume,
      intensity: workout.intensity,
      notes: workout.notes,
      cardioDetails: workout.cardioDetails
    }));

    return NextResponse.json({ workouts: workoutInsights });

  } catch (error) {
    console.error("[API /dashboard/recent-workouts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent workouts" }, 
      { status: 500 }
    );
  }
} 