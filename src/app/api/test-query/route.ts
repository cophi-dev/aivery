import { NextResponse } from "next/server";
import { getFreshFilteredWorkouts } from "../chat/fresh-data";
import { ObjectId } from "mongodb";
import dbConnect from "@/lib/db/mongodb";
import { getCollection } from "@/lib/db/mongodb";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // For debugging purposes only - this would need authentication in production
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: "No userId provided" }, { status: 400 });
    }
    
    // Connect to DB
    await dbConnect();
    
    // Get user information to verify
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Get some basic workout stats for this user
    // Get the timeframe from query params (default to week)
    const timeframe = url.searchParams.get('timeframe') || 'week';
    const type = url.searchParams.get('type') || 'running';
    
    console.log(`[TEST-QUERY] Getting workouts for user ${userId}, timeframe: ${timeframe}, type: ${type}`);
    
    // First get all workouts for this user to see if any exist
    const workoutsCollection = await getCollection('workouts');
    const allUserWorkouts = await workoutsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .limit(25)
      .toArray();
    
    console.log(`[TEST-QUERY] Found ${allUserWorkouts.length} total workouts for user ${userId}`);
    
    if (allUserWorkouts.length > 0) {
      console.log(`[TEST-QUERY] First workout date: ${allUserWorkouts[0].date}, type: ${allUserWorkouts[0].type}`);
      console.log(`[TEST-QUERY] Last workout date: ${allUserWorkouts[allUserWorkouts.length-1].date}, type: ${allUserWorkouts[allUserWorkouts.length-1].type}`);
    }
    
    // Now get filtered workouts as requested
    const { workouts, count, summaries } = await getFreshFilteredWorkouts(
      userId,
      timeframe,
      type
    );
    
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        nickname: user.nickname
      },
      workoutCount: count,
      hasWorkouts: count > 0,
      recentWorkouts: workouts.map(w => ({
        id: w._id.toString(),
        type: w.type,
        date: w.date,
        distance: w.distance,
        duration: w.duration
      })).slice(0, 3),
      summaries
    });
  } catch (error) {
    console.error("Test query error:", error);
    return NextResponse.json(
      { error: "Failed to execute test query" },
      { status: 500 }
    );
  }
} 