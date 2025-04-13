import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import WorkoutModel from '@/lib/db/models/workout';
import UserModel from '@/lib/db/models/user';
import WorkoutExerciseModel from '@/lib/db/models/workoutExercise';

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

    // Map workout types to handle both formats (Run -> running, Swim -> swimming, etc.)
    const typeMapping: Record<string, string[]> = {
      'strength': ['strength', 'Strength', 'Workout'],
      'running': ['running', 'Running', 'Run', 'run'],
      'swimming': ['swimming', 'Swimming', 'Swim', 'swim'],
      'cycling': ['cycling', 'Cycling', 'Ride', 'ride', 'bike'],
      'hiit': ['hiit', 'Hiit', 'HIIT'],
      'flexibility': ['flexibility', 'Flexibility', 'stretch', 'Stretch'],
      'other': ['other', 'Other'],
    };
    
    // Get all possible type variations for the selected workout types
    const allTypeVariations: string[] = [];
    
    workoutTypes.forEach(selectedType => {
      // Check if this is a key in our mapping
      if (typeMapping[selectedType]) {
        // Add all variations for this key
        allTypeVariations.push(...typeMapping[selectedType]);
      } else {
        // For each mapping key, check if the selected type is in its value array
        for (const [standardType, variations] of Object.entries(typeMapping)) {
          if (variations.includes(selectedType)) {
            allTypeVariations.push(...variations);
            break;
          }
        }
        
        // If not found in any mapping, add as-is and also lowercase version
        if (!allTypeVariations.includes(selectedType)) {
          allTypeVariations.push(selectedType);
          allTypeVariations.push(selectedType.toLowerCase());
        }
      }
    });
    
    console.log(`[delete-workouts] Original workout types: ${workoutTypes.join(', ')}`);
    console.log(`[delete-workouts] All type variations: ${allTypeVariations.join(', ')}`);
    
    // Debug: Find all workouts for this user with their types to see what exists
    const allUserWorkouts = await WorkoutModel.find({
      userId: user._id
    }).select('type').lean();
    
    const userWorkoutTypes = allUserWorkouts.map(w => w.type);
    const uniqueUserWorkoutTypes = Array.from(new Set(userWorkoutTypes));
    
    console.log(`[delete-workouts] User has ${allUserWorkouts.length} total workouts`);
    console.log(`[delete-workouts] User has workout types: ${JSON.stringify(uniqueUserWorkoutTypes)}`);
    
    // Find workouts with any of the type variations
    const workoutsToDelete = await WorkoutModel.find({
      userId: user._id,
      type: { $in: allTypeVariations }
    }).select('_id type').lean();
    
    console.log(`[delete-workouts] Found ${workoutsToDelete.length} workouts matching the types`);
    
    // Log found workout types for debugging
    const foundTypes = workoutsToDelete.map(w => w.type);
    const uniqueFoundTypes = Array.from(new Set(foundTypes));
    console.log(`[delete-workouts] Found workout types: ${uniqueFoundTypes.join(', ')}`);
    
    // Get the workout IDs to be deleted
    const workoutIdsToDelete = workoutsToDelete.map(workout => workout._id);

    // --- Start: Calculate unique, normalized types for the success message ---
    const actualDeletedTypes = workoutsToDelete.map(w => w.type || 'other'); // Get types actually found

    // Reuse the mapping logic, but simplify for normalization
    const simpleTypeMapping: Record<string, string> = {
      'run': 'running', 'swim': 'swimming', 'ride': 'cycling', 'bike': 'cycling',
      'workout': 'strength', 'strength_training': 'strength', 'weight_training': 'strength',
      'functional_strength': 'strength', 'stretch': 'flexibility', 'yoga': 'flexibility',
      'trail_running': 'running', 'treadmill_running': 'running', 'virtual_ride': 'cycling',
      'indoor_cycling': 'cycling', 'pool_swimming': 'swimming', 'open_water_swimming': 'swimming',
      'walk': 'walking', 'hike': 'hiking', 'circuit_training': 'hiit', 'crossfit': 'hiit',
      // Ensure base types map to themselves if not covered above
      'strength': 'strength', 'running': 'running', 'swimming': 'swimming', 
      'cycling': 'cycling', 'hiit': 'hiit', 'flexibility': 'flexibility', 
      'other': 'other', 'walking': 'walking', 'hiking': 'hiking'
    };

    const deletedTypesNormalized = actualDeletedTypes.map(type => 
      simpleTypeMapping[type.toLowerCase()] || type.toLowerCase() // Normalize the found types
    );
    const uniqueDeletedTypes = Array.from(new Set(deletedTypesNormalized));
    
    // Capitalize first letter for display
    const uniqueDeletedTypesString = uniqueDeletedTypes.map(type => 
        type.charAt(0).toUpperCase() + type.slice(1)
      ).join(', ');
    // --- End: Calculate unique, normalized types ---
    
    if (workoutIdsToDelete.length === 0) {
      console.log(`[delete-workouts] No workouts found for deletion`);
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        workoutTypes,
        userHasWorkouts: allUserWorkouts.length > 0,
        availableTypes: uniqueUserWorkoutTypes
      });
    }

    console.log(`[delete-workouts] Found ${workoutIdsToDelete.length} workouts to delete`);

    // Delete associated WorkoutExercise documents first
    if (workoutIdsToDelete.length > 0) {
      console.log(`[delete-workouts] Deleting ${workoutIdsToDelete.length} associated workout exercises...`);
      const deleteExercisesResult = await WorkoutExerciseModel.deleteMany({
        workoutId: { $in: workoutIdsToDelete }
      });
      console.log(`[delete-workouts] Deleted ${deleteExercisesResult.deletedCount} workout exercise documents.`);
    }

    // Remove workout references from user document
    await UserModel.updateOne(
      { _id: user._id },
      { $pull: { workouts: { $in: workoutIdsToDelete } } }
    );
    
    console.log(`[delete-workouts] Removed workout references from user document`);
    
    // Delete the workouts
    const deleteResult = await WorkoutModel.deleteMany({
      userId: user._id,
      type: { $in: allTypeVariations }
    });

    console.log(`[delete-workouts] Deleted ${deleteResult.deletedCount} workouts`);

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      // Return the string of unique, normalized, capitalized types
      deletedTypesString: uniqueDeletedTypesString 
    });
  } catch (error) {
    console.error('Error deleting workouts:', error);
    return NextResponse.json(
      { error: 'Failed to delete workouts. Please try again.' },
      { status: 500 }
    );
  }
} 