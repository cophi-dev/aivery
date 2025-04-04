import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import WorkoutModel from '@/lib/db/models/workout';
import dbConnect from '@/lib/db/mongodb';

// Support both GET and POST methods
export async function GET(request: Request) {
  return handleFixDistances(request);
}

export async function POST(request: Request) {
  return handleFixDistances(request);
}

// Handle the logic in a shared function
async function handleFixDistances(request: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error("API /api/strava/fix-distances: Not authenticated");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log(`API /api/strava/fix-distances: User ${userId} initiated distance fix.`);
    
    // Find all workouts with exactly 10000.0 km distance
    const buggyWorkouts = await WorkoutModel.find({
      userId: userId,
      $or: [
        { distance: 10000 },
        { distance: 10000.0 },
        { 'cardioDetails.distance': 10000 },
        { 'cardioDetails.distance': 10000.0 }
      ]
    }).exec();
    
    console.log(`Found ${buggyWorkouts.length} workouts with 10000km distance bug.`);
    
    // Fix each workout
    let updatedCount = 0;
    for (const workout of buggyWorkouts) {
      // Apply the fix - set to a reasonable distance of 5km
      // (or we could also divide by 100 if we suspect this was the cm issue)
      
      // Option 1: Fixed value
      const fixedDistance = 5.0;
      
      // Option 2: Divide by 100 (converts cm to km, uncomment if you prefer this method)
      // const fixedDistance = 10000.0 / 100;
      
      // Update the workout with correct distance
      workout.distance = fixedDistance;
      if (workout.cardioDetails && workout.cardioDetails.distance) {
        workout.cardioDetails.distance = fixedDistance;
      }
      
      // Add a note that this was fixed
      workout._debug = workout._debug || {};
      workout._debug.distanceFixed = true;
      workout._debug.originalDistance = 10000;
      workout._debug.fixedDistance = fixedDistance;
      workout._debug.fixedAt = new Date().toISOString();
      
      await workout.save();
      updatedCount++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${updatedCount} out of ${buggyWorkouts.length} workouts with 10000km distance bug.`,
      fixedCount: updatedCount,
      totalBuggyWorkouts: buggyWorkouts.length
    });
    
  } catch (error: any) {
    console.error("API /api/strava/fix-distances Error:", error);
    const errorMessage = error.message || 'Failed to fix workout distances';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 