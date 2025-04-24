import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db/mongodb";
import WorkoutModel from "@/lib/db/models/workout"; // Use the Mongoose model

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();

    const userId = session.user.id;

    // Fetch the 20 most recent workouts sourced from Strava for this user
    const recentStravaWorkouts = await WorkoutModel.find({
      userId: userId,
      source: 'strava',
    })
    .sort({ date: -1 }) // Sort by date descending (most recent first)
    .limit(20) // Limit to 20 results
    .lean() // Use .lean() for faster, plain JS objects
    .exec();

    return NextResponse.json({ success: true, workouts: recentStravaWorkouts });

  } catch (error) {
    console.error("Error fetching recent Strava activities:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
} 