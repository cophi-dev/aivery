import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';
import UserModel from '@/lib/db/models/user';
import mongoose from 'mongoose';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/workouts/delete
 * Deletes all workouts of specified types for the given user ID.
 * This is a direct database operation that doesn't rely on session data.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[workouts/delete] Processing delete request');
    
    // Parse request body
    const { userId, workoutTypes } = await request.json();

    if (!userId) {
      console.log('[workouts/delete] No user ID provided');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!workoutTypes || !Array.isArray(workoutTypes) || workoutTypes.length === 0) {
      console.log('[workouts/delete] Invalid workout types');
      return NextResponse.json(
        { error: 'You must select at least one workout type to delete' },
        { status: 400 }
      );
    }

    console.log(`[workouts/delete] Connecting to database for user ${userId}`);
    await dbConnect();
    console.log(`[workouts/delete] Connected to database`);

    // Convert userId to ObjectId if it's a string
    const userObjectId = typeof userId === 'string' 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;

    // Find all workouts that match the criteria
    const workoutsToDelete = await WorkoutModel.find({
      userId: userObjectId,
      type: { $in: workoutTypes }
    }).select('_id').lean();
    
    // Get the workout IDs to be deleted
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);
    
    if (workoutIdsToDelete.length === 0) {
      console.log(`[workouts/delete] No workouts found for deletion`);
      return NextResponse.json({
        success: true,
        deletedCount: 0
      });
    }

    console.log(`[workouts/delete] Found ${workoutIdsToDelete.length} workouts to delete`);

    // Remove workout references from user document
    await UserModel.updateOne(
      { _id: userObjectId },
      { $pull: { workouts: { $in: workoutIdsToDelete } } }
    );
    
    console.log(`[workouts/delete] Removed workout references from user document`);
    
    // Delete the workouts
    const deleteResult = await WorkoutModel.deleteMany({
      userId: userObjectId,
      type: { $in: workoutTypes }
    });

    console.log(`[workouts/delete] Deleted ${deleteResult.deletedCount} workouts`);

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('[workouts/delete] Error deleting workouts:', error);
    return NextResponse.json(
      { error: 'Failed to delete workouts. Please try again.' },
      { status: 500 }
    );
  }
} 