import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    
    // Only allow authenticated users
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const workoutId = params.id;
    
    // Verify ObjectId format
    let isValidObjectId = false;
    try {
      isValidObjectId = ObjectId.isValid(workoutId);
    } catch (error) {
      isValidObjectId = false;
    }
    
    if (!isValidObjectId) {
      return NextResponse.json({ 
        exists: false,
        error: 'Invalid workout ID format',
        correctPath: null
      });
    }
    
    await dbConnect();
    
    // Find the workout
    const workout = await WorkoutModel.findOne({ 
      _id: workoutId,
      userId: userId
    });
    
    if (!workout) {
      return NextResponse.json({ 
        exists: false,
        error: 'Workout not found',
        correctPath: null
      });
    }
    
    // Check if it's a Strava workout
    if (workout.source === 'strava') {
      // If it doesn't have a valid Strava ID or link, fix it
      const stravaId = workout.sourceId;
      const stravaLink = workout.stravaLink;
      const needsFix = (!stravaId || !stravaLink || !stravaLink.includes(stravaId));
      
      if (needsFix) {
        // Fix can be done here if needed
        console.log(`Strava workout found that needs fixing: ${workoutId}`);
      }
    }
    
    return NextResponse.json({ 
      exists: true,
      error: null,
      correctPath: `/workouts/${workoutId}`,
      workout: {
        id: workout._id.toString(),
        name: workout.name,
        type: workout.type,
        source: workout.source,
        stravaLink: workout.stravaLink
      }
    });
    
  } catch (error) {
    console.error('Error checking workout:', error);
    return NextResponse.json({ 
      exists: false,
      error: 'An error occurred while checking the workout',
      correctPath: null
    }, { status: 500 });
  }
} 