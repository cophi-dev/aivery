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
    
    // Map workout types to handle both formats (Run -> running, Swim -> swimming, etc.)
    // More comprehensive mapping
    const typeMapping: Record<string, string> = {
      // Standard types (lowercase)
      'strength': 'strength',
      'running': 'running',
      'swimming': 'swimming',
      'cycling': 'cycling',
      'hiit': 'hiit',
      'flexibility': 'flexibility',
      'other': 'other',
      'walking': 'walking',
      'hiking': 'hiking',
      
      // Common variations (case-insensitive handled by .toLowerCase() later)
      'run': 'running',
      'swim': 'swimming',
      'ride': 'cycling',
      'bike': 'cycling',
      'workout': 'strength', // Map general 'Workout' to 'Strength'
      'strength_training': 'strength',
      'weight_training': 'strength',
      'functional_strength': 'strength',
      'stretch': 'flexibility',
      'yoga': 'flexibility',
      'trail_running': 'running',
      'treadmill_running': 'running',
      'virtual_ride': 'cycling',
      'indoor_cycling': 'cycling',
      'pool_swimming': 'swimming',
      'open_water_swimming': 'swimming',
      'walk': 'walking',
      'hike': 'hiking',
      'circuit_training': 'hiit',
      'crossfit': 'hiit',
    };
    
    // Apply mapping to the input types for the query
    const normalizedQueryTypes = workoutTypes.map(type => 
      typeMapping[type.toLowerCase()] || type.toLowerCase()
    );
    const uniqueQueryTypes = Array.from(new Set(normalizedQueryTypes));
    
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Original input types:', workoutTypes);
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Normalized query types:', uniqueQueryTypes);
    
    // Find workouts matching the normalized types
    const workoutsToDelete = await WorkoutModel.find({
      userId: user._id,
      type: { $in: uniqueQueryTypes } 
    }).select('_id type').lean(); // Fetch only necessary fields
    
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Found', workoutIdsToDelete.length, 'workouts to delete');

    // --- Get unique, NORMALIZED types FROM THE FOUND WORKOUTS for the success message --- 
    const actualDeletedTypes = workoutsToDelete.map(w => w.type || 'other'); // Get types actually found
    const deletedTypesNormalized = actualDeletedTypes.map(type => 
      typeMapping[type.toLowerCase()] || type.toLowerCase() // Normalize the found types
    );
    const uniqueDeletedTypes = Array.from(new Set(deletedTypesNormalized));
    // Capitalize first letter for display
    const uniqueTypesString = uniqueDeletedTypes.map(type => 
        type.charAt(0).toUpperCase() + type.slice(1)
      ).join(', ');
    // --- End unique types calculation --- 

    if (workoutIdsToDelete.length === 0) {
      return { success: true, deletedCount: 0, message: 'No workouts found matching the selected criteria' };
    }
    
    // Remove workout references from user document
    await UserModel.updateOne(
      { _id: user._id },
      { $pull: { workouts: { $in: workoutIdsToDelete } } }
    );
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Removed workout references from user');
    
    // Delete the workouts using the found IDs for accuracy
    const deleteResult = await WorkoutModel.deleteMany({
      _id: { $in: workoutIdsToDelete }
    });
    console.log('[SERVER ACTION] deleteWorkoutsByTypes: Deleted', deleteResult.deletedCount, 'workouts');
    
    revalidatePath('/settings');
    
    // Use the unique, normalized types string in the message
    const successMessage = `Successfully deleted ${deleteResult.deletedCount} workouts of types: ${uniqueTypesString}.`;

    return {
      success: true,
      deletedCount: deleteResult.deletedCount,
      message: successMessage
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