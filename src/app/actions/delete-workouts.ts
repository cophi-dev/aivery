'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/db/mongoose'
import WorkoutModel from '@/lib/db/models/workout'
import UserModel from '@/lib/db/models/user'
import { revalidatePath } from 'next/cache'

export async function deleteWorkoutsByTypes(workoutTypes: string[]) {
  console.log('[SERVER ACTION] deleteWorkoutsByTypes: Starting');
  
  try {
    // Check for valid input
    if (!workoutTypes || !Array.isArray(workoutTypes) || workoutTypes.length === 0) {
      console.log('[SERVER ACTION] deleteWorkoutsByTypes: Invalid workout types');
      return {
        success: false,
        error: 'At least one workout type must be selected'
      };
    }
    
    // Get the session
    const session = await getServerSession(authOptions);
    
    // Add detailed session debugging
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Session debug:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      email: session?.user?.email || 'none',
      name: session?.user?.name || 'none'
    });
    
    if (!session?.user?.email) {
      console.log('[SERVER ACTION] deleteWorkoutsByTypes: No session found');
      return {
        success: false,
        error: 'You must be logged in to delete workouts'
      };
    }
    
    // Connect to the database
    await dbConnect();
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Connected to database');
    
    // Find the user with their email
    const user = await UserModel.findOne({ email: session.user.email }).select('_id');
    
    if (!user) {
      console.log('[SERVER ACTION] deleteWorkoutsByTypes: User not found for email:', session.user.email);
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Found user with ID:', user._id);
    
    // Get workout IDs to delete
    const workoutsToDelete = await WorkoutModel.find({
      userId: user._id,
      type: { $in: workoutTypes }
    }).select('_id').lean();
    
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Found', workoutIdsToDelete.length, 'workouts to delete');
    
    if (workoutIdsToDelete.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        workoutTypes
      };
    }
    
    // Remove workout references from user document
    await UserModel.updateOne(
      { _id: user._id },
      { $pull: { workouts: { $in: workoutIdsToDelete } } }
    );
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Removed workout references from user');
    
    // Delete the workouts
    const deleteResult = await WorkoutModel.deleteMany({
      userId: user._id,
      type: { $in: workoutTypes }
    });
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Deleted', deleteResult.deletedCount, 'workouts');
    
    // Revalidate the path to refresh the UI
    revalidatePath('/settings');
    
    return {
      success: true,
      deletedCount: deleteResult.deletedCount,
      workoutTypes
    };
  } catch (error) {
    console.error('[SERVER ACTION] deleteWorkoutsByTypes: Error:', error);
    return {
      success: false,
      error: 'An error occurred while deleting workouts'
    };
  }
}

// Wrapper function to handle form submissions
export async function deleteWorkoutsAction(formData: FormData) {
  'use server'
  
  const types = formData.getAll('workoutTypes').map(t => t.toString());
  const confirmation = formData.get('confirmation')?.toString() || '';
  
  if (confirmation !== 'delete') {
    return { success: false, error: "Please type 'delete' to confirm" };
  }
  
  if (types.length === 0) {
    return { success: false, error: "Please select at least one workout type" };
  }
  
  try {
    const result = await deleteWorkoutsByTypes(types);
    return result;
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred' 
    };
  }
} 