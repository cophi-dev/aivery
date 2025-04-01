import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { getFreshWorkouts, getFreshFilteredWorkouts } from "../fresh-data";

// Force dynamic rendering and prevent caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Define QueryAnalysis interface for workout data queries
export interface QueryAnalysis {
  dataType?: string;
  timeFrame?: string;
  filters?: {
    workoutType?: string;
    format?: string;
    includeDetails?: boolean;
    aggregation?: string;
    metric?: string;
  };
  workoutType?: string;
}

export async function POST(request: Request) {
  try {
    const { message, userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Connect to database
    await dbConnect();
    
    // Get fresh workout data
    const { recentWorkouts, totalWorkoutCount } = await getFreshWorkouts(userId);

    // Format the workout data
    const formattedWorkouts = recentWorkouts.map(workout => ({
      type: workout.type,
      date: new Date(workout.date).toLocaleDateString(),
      distance: workout.distance ? `${workout.distance} km` : undefined,
      duration: workout.duration ? `${Math.floor(workout.duration / 60)}h ${workout.duration % 60}m` : undefined
    }));

    // Create a summary response
    const response = {
      totalWorkouts: totalWorkoutCount,
      recentWorkouts: formattedWorkouts,
      message: `You have completed ${totalWorkoutCount} workouts in total. Here are your most recent workouts:\n\n` +
        formattedWorkouts.map(w => 
          `${w.type} on ${w.date}${w.distance ? ` - ${w.distance}` : ''}${w.duration ? ` - ${w.duration}` : ''}`
        ).join('\n')
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Workout Analysis Error:', error);
    return NextResponse.json(
      { error: "Error analyzing workout data" },
      { status: 500 }
    );
  }
} 