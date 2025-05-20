import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';
import UserModel from '@/lib/db/models/user';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/workouts/delete-by-types
 * Simple endpoint to delete workouts by types without additional checks
 */
export async function POST(request: NextRequest) {
  console.log('[delete-by-types] Starting request');
  
  try {
    // Import getServerSession at runtime
    const { getServerSession } = await import('next-auth');
    // Import auth options at runtime
    const { authOptions } = await import('@/lib/auth');
    
    // Get user session
    const session = await getServerSession(authOptions);
    
    console.log('[delete-by-types] Session:', session ? 'exists' : 'none');
    console.log('[delete-by-types] Session user email:', session?.user?.email || 'none');
    
    if (!session?.user?.email) {
      console.log('[delete-by-types] No valid session found');
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Parse request body
    const { workoutTypes } = await request.json();
    console.log('[delete-by-types] Workout types:', workoutTypes);
    
    if (!workoutTypes || !Array.isArray(workoutTypes) || workoutTypes.length === 0) {
      console.log('[delete-by-types] Invalid workout types');
      return NextResponse.json({ 
        error: 'At least one workout type must be selected' 
      }, { status: 400 });
    }
    
    // Connect to database
    await dbConnect();
    console.log('[delete-by-types] Database connected');
    
    // Find user by email
    const user = await UserModel.findOne({ email: session.user.email }).select('_id');
    if (!user) {
      console.log('[delete-by-types] User not found for email:', session.user.email);
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    console.log('[delete-by-types] Found user with id:', user._id);
    
    // Use the user._id directly from the query result
    const userId = user._id;
    
    // Find all workouts that match the criteria
    const workoutsToDelete = await WorkoutModel.find({
      userId: userId,
      type: { $in: workoutTypes }
    }).select('_id').lean();
    
    // Get the workout IDs to be deleted
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);
    
    console.log(`[delete-by-types] Found ${workoutIdsToDelete.length} workouts to delete`);
    
    if (workoutIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        workoutTypes: workoutTypes,
        message: 'No workouts found matching the selected criteria'
      });
    }
    
    // Update user document to remove the workout references
    try {
      const updateResult = await UserModel.updateOne(
        { _id: userId },
        { $pull: { workouts: { $in: workoutIdsToDelete } } }
      );
      console.log('[delete-by-types] User update result:', updateResult);
    } catch (err) {
      console.error('[delete-by-types] Error updating user:', err);
      // Continue anyway - deleting the workouts is the primary goal
    }
    
    // Delete the workouts
    const deleteResult = await WorkoutModel.deleteMany({
      userId: userId,
      type: { $in: workoutTypes }
    });
    
    console.log('[delete-by-types] Delete result:', deleteResult);
    
    // Reset challenges after deleting workouts
    try {
      console.log(`[delete-by-types] Calling reset-challenges API to update challenges...`);
      const resetResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/reset-challenges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include the authorization header with the session cookie
          Cookie: request.headers.get('cookie') || ''
        },
        // The reset-challenges endpoint doesn't need a body, it uses the session user
      });
      
      const resetResult = await resetResponse.json();
      console.log(`[delete-by-types] Reset challenges result:`, resetResult);
    } catch (resetError) {
      // Log the error but don't fail the whole operation
      console.error(`[delete-by-types] Error resetting challenges:`, resetError);
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      workoutTypes: workoutTypes,
      message: `Successfully deleted ${deleteResult.deletedCount} workouts`
    });
    
  } catch (error) {
    console.error('[delete-by-types] Error:', error);
    return NextResponse.json({ 
      error: 'An error occurred while deleting workouts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 