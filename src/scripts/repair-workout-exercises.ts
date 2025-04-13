// Script to repair workout exercise relationships
import { getDatabase } from '@/lib/db/mongodb';
import WorkoutModel from '@/lib/db/models/workout';
import WorkoutExerciseModel from '@/lib/db/models/workoutExercise';
import ExerciseModel from '@/lib/db/models/exercise';

async function repairWorkoutExercises() {
  try {
    console.log('Starting workout exercise repair...');
    
    // Get all workouts
    const workouts = await WorkoutModel.find({}).lean();
    console.log(`Found ${workouts.length} total workouts to check`);
    
    let repaired = 0;
    
    for (const workout of workouts) {
      // Check if workout already has a workout exercise
      const existingExercise = await WorkoutExerciseModel.findOne({
        workoutId: workout._id
      });
      
      if (!existingExercise) {
        console.log(`Workout ${workout._id} missing workout exercise. Type: ${workout.type}`);
        
        // Handle cardio workouts
        if (['running', 'cycling', 'swimming', 'walking', 'hiking'].includes(workout.type)) {
          // Find or create the exercise
          let exercise = await ExerciseModel.findOne({
            name: { $regex: new RegExp(`^${workout.type}$`, 'i') }
          });
          
          if (!exercise) {
            // Create a basic exercise if it doesn't exist
            const exerciseName = workout.type.charAt(0).toUpperCase() + workout.type.slice(1);
            exercise = await ExerciseModel.create({
              name: exerciseName,
              category: 'cardio',
              muscleGroups: [],
              equipment: [],
              instructions: '',
              isSystemExercise: true,
              isDefault: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            console.log(`Created new exercise: ${exerciseName}`);
          }
          
          // Create the workout exercise
          await WorkoutExerciseModel.create({
            workoutId: workout._id,
            exerciseId: exercise._id,
            userId: workout.userId,
            duration: workout.duration || 0,
            distance: workout.distance || (workout.cardioDetails?.distance) || 0,
            order: 1,
            sets: [],
            createdAt: workout.createdAt || new Date(),
            updatedAt: workout.updatedAt || new Date(),
          });
          
          console.log(`Created workout exercise for ${workout._id}`);
          repaired++;
        }
      }
    }
    
    console.log(`Repair complete. Fixed ${repaired} workouts.`);
    
  } catch (error) {
    console.error('Error repairing workout exercises:', error);
  }
}

// Run the repair
repairWorkoutExercises(); 