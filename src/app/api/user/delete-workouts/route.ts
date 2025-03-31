import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';
import UserModel from '@/lib/db/models/user';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/delete-workouts
 * Deletes all workouts of specified types for the current user.
 * Requires typing 'delete' as confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    // First check session immediately to avoid unnecessary work
    const session = await getServerSession(authOptions);
    
    // Add detailed session debugging
    console.log("[delete-workouts] Session debug:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      email: session?.user?.email || 'none',
      name: session?.user?.name || 'none',
      id: session?.user?.id || 'none'
    });

    // Check if we have any valid session info (id, email, or name)
    if (!session?.user || (!session.user.id && !session.user.email && !session.user.name)) {
      console.log("[delete-workouts] No valid session found");
      return NextResponse.json(
        { error: 'You must be logged in to delete workouts' },
        { status: 401 }
      );
    }

    console.log(`[delete-workouts] Processing request for user: ${session.user.name || session.user.email || session.user.id}`);

    // Parse request body
    const { workoutTypes, confirmation } = await request.json();

    if (!workoutTypes || !Array.isArray(workoutTypes) || workoutTypes.length === 0) {
      console.log("[delete-workouts] Invalid workout types");
      return NextResponse.json(
        { error: 'You must select at least one workout type to delete' },
        { status: 400 }
      );
    }

    if (!confirmation || confirmation !== 'delete') {
      console.log("[delete-workouts] Invalid confirmation");
      return NextResponse.json(
        { error: 'You must type "delete" to confirm deletion' },
        { status: 400 }
      );
    }

    console.log(`[delete-workouts] Connecting to database`);
    await dbConnect();
    console.log(`[delete-workouts] Connected to database`);

    // Find user ID from session
    let user;
    
    if (session.user.id) {
      // Try to find user by ID first
      user = await UserModel.findById(session.user.id).select('_id');
    } 
    
    if (!user && session.user.email) {
      // Try to find by email next
      user = await UserModel.findOne({ email: session.user.email }).select('_id');
    }
    
    if (!user && session.user.name) {
      // Try to find by name as last resort
      user = await UserModel.findOne({ name: session.user.name }).select('_id');
    }
    
    if (!user) {
      console.log(`[delete-workouts] User not found for session: ${JSON.stringify(session.user)}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`[delete-workouts] Found user: ${user._id}`);

    // Find all workouts that match the criteria
    const workoutsToDelete = await WorkoutModel.find({
      userId: user._id,
      type: { $in: workoutTypes }
    }).select('_id').lean();
    
    // Get the workout IDs to be deleted
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);
    
    if (workoutIdsToDelete.length === 0) {
      console.log(`[delete-workouts] No workouts found for deletion`);
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        workoutTypes
      });
    }

    console.log(`[delete-workouts] Found ${workoutIdsToDelete.length} workouts to delete`);

    // Remove workout references from user document
    await UserModel.updateOne(
      { _id: user._id },
      { $pull: { workouts: { $in: workoutIdsToDelete } } }
    );
    
    console.log(`[delete-workouts] Removed workout references from user document`);
    
    // Delete the workouts
    const deleteResult = await WorkoutModel.deleteMany({
      userId: user._id,
      type: { $in: workoutTypes }
    });

    console.log(`[delete-workouts] Deleted ${deleteResult.deletedCount} workouts`);

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      workoutTypes
    });
  } catch (error) {
    console.error('Error deleting workouts:', error);
    return NextResponse.json(
      { error: 'Failed to delete workouts. Please try again.' },
      { status: 500 }
    );
  }
} 