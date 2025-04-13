'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Types } from 'mongoose';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel from '@/lib/db/models/workout';
import WorkoutExerciseModel from '@/lib/db/models/workoutExercise';
import ExerciseModel from '@/lib/db/models/exercise';

/**
 * Fetches a summary of a user's workouts
 * Includes total count, duration, distance, and most common workout type
 */
export async function fetchUserWorkoutSummary() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('Not authenticated');
    }
    
    const userId = session.user.id;
    await dbConnect();
    
    // Fetch all user's workouts
    const workouts = await WorkoutModel.find({ 
      userId: new Types.ObjectId(userId)
    }).lean();
    
    // Calculate total time in seconds (not minutes)
    const totalTimeInSeconds = workouts.reduce((total, workout) => {
      return total + (workout.duration || 0);
    }, 0);
    
    // Get workout types count for favorite determination
    const typeCounts: Record<string, number> = {};
    workouts.forEach(workout => {
      const type = workout.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Determine favorite type
    let favoriteType = 'None';
    let maxCount = 0;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteType = type;
      }
    });
    
    // Calculate total distance from workout exercises (more accurate)
    // This ensures we capture distance from both Workout and WorkoutExercise collections
    const workoutExercises = await WorkoutExerciseModel.find({
      userId: new Types.ObjectId(userId),
      distance: { $exists: true, $gt: 0 }
    }).lean();
    
    console.log(`Found ${workoutExercises.length} workout exercises with distance data`);
    
    // Calculate total distance in km
    let totalDistanceInKm = 0;
    
    // First try to get distance from workout exercises (most accurate)
    if (workoutExercises.length > 0) {
      totalDistanceInKm = workoutExercises.reduce((total, exercise) => {
        // Assuming exercise.distance is in meters, convert to km
        return total + (exercise.distance || 0) / 1000; 
      }, 0);
      console.log(`Total distance from workout exercises: ${totalDistanceInKm.toFixed(3)} km`);
    } 
    
    // If no distance in workout exercises, check the main workouts
    if (totalDistanceInKm === 0) {
      totalDistanceInKm = workouts.reduce((total, workout) => {
        // First try to use the distance field if available
        if (workout.distance && workout.distance > 0) {
          // Only include distance for cardio-type workouts
          const isCardioType = ['running', 'cycling', 'swimming', 'walking', 'hiking'].includes(workout.type || '');
          return total + (isCardioType ? workout.distance : 0);
        }
        
        // If distance field is missing, try to extract from workout name
        if (workout.name) {
          // Look for patterns like "123.45km" or "123m" in the name
          const kmMatch = workout.name.match(/\((\d+\.\d+)km\)/);
          const mMatch = workout.name.match(/\((\d+)m\)/);
          
          if (kmMatch && kmMatch[1]) {
            const kmValue = parseFloat(kmMatch[1]);
            console.log(`Extracted ${kmValue}km from workout name: ${workout.name}`);
            return total + kmValue;
          }
          
          if (mMatch && mMatch[1]) {
            const mValue = parseInt(mMatch[1]);
            const kmValue = mValue / 1000;
            console.log(`Extracted ${mValue}m (${kmValue}km) from workout name: ${workout.name}`);
            return total + kmValue;
          }
        }
        
        return total;
      }, 0);
      console.log(`Total distance from workouts (with name extraction): ${totalDistanceInKm.toFixed(3)} km`);
    }
    
    return {
      totalWorkouts: workouts.length,
      totalTimeInSeconds,
      totalDistanceInKm,
      favoriteType
    };
  } catch (error) {
    console.error('Error fetching workout summary:', error);
    return {
      totalWorkouts: 0,
      totalTimeInSeconds: 0,
      totalDistanceInKm: 0,
      favoriteType: 'None'
    };
  }
}

/**
 * Repair all workout distance data
 * Ensures distance data is consistent between Workout and WorkoutExercise collections
 * If distance is missing but present in the workout name, extracts it
 */
export async function repairWorkoutDistances() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('Not authenticated');
    }
    
    const userId = session.user.id;
    await dbConnect();
    
    // Find all workouts
    const workouts = await WorkoutModel.find({
      userId: new Types.ObjectId(userId),
    });
    
    console.log(`Found ${workouts.length} workouts to check for repairs`);
    
    let updatedCount = 0;
    
    // First extract distance from names where missing
    for (const workout of workouts) {
      // Skip if already has distance 
      if (workout.distance && workout.distance > 0) {
        continue;
      }
      
      // Extract distance from name if available
      let extractedDistance = 0;
      if (workout.name) {
        // Look for patterns like "123.45km" or "123m" in the name
        const kmMatch = workout.name.match(/\((\d+\.\d+)km\)/);
        const mMatch = workout.name.match(/\((\d+)m\)/);
        
        if (kmMatch && kmMatch[1]) {
          extractedDistance = parseFloat(kmMatch[1]);
          console.log(`Extracted ${extractedDistance}km from workout name: ${workout.name}`);
        } else if (mMatch && mMatch[1]) {
          const mValue = parseInt(mMatch[1]);
          extractedDistance = mValue / 1000;
          console.log(`Extracted ${mValue}m (${extractedDistance}km) from workout name: ${workout.name}`);
        }
      }
      
      // Update workout if we got distance
      if (extractedDistance > 0) {
        await WorkoutModel.updateOne(
          { _id: workout._id },
          { 
            $set: { 
              distance: extractedDistance,
              'cardioDetails.distance': extractedDistance 
            } 
          }
        );
        updatedCount++;
        
        console.log(`Updated workout ${workout._id} with distance ${extractedDistance}km from name`);
      }
    }
    
    // Now let's reload the workouts with their updated distances
    const updatedWorkouts = await WorkoutModel.find({
      userId: new Types.ObjectId(userId),
      distance: { $exists: true, $gt: 0 }
    });
    
    console.log(`Found ${updatedWorkouts.length} workouts with distance data after name extraction`);
    
    // For each workout, ensure the workout exercise also has the distance
    for (const workout of updatedWorkouts) {
      const workoutExercise = await WorkoutExerciseModel.findOne({
        workoutId: workout._id,
        userId: new Types.ObjectId(userId)
      });
      
      if (workoutExercise) {
        // Update workout exercise with distance if missing or different
        if (!workoutExercise.distance || workoutExercise.distance !== workout.distance) {
          await WorkoutExerciseModel.updateOne(
            { _id: workoutExercise._id },
            { $set: { distance: workout.distance } }
          );
          updatedCount++;
          console.log(`Updated workout exercise ${workoutExercise._id} with distance ${workout.distance}km`);
        }
      } else {
        // Create workout exercise if it doesn't exist
        console.log(`Workout exercise missing for workout ${workout._id}, creating one`);
        
        // Find the exercise for this workout type
        const exerciseType = workout.type || 'running';
        let exercise = await ExerciseModel.findOne({
          category: 'cardio',
          name: { $regex: new RegExp(`^${exerciseType}$`, 'i') }
        });
        
        // If exercise doesn't exist, create a basic one
        if (!exercise) {
          exercise = await ExerciseModel.create({
            name: exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1),
            category: 'cardio',
            muscleGroups: [],
            equipment: [],
            instructions: '',
            isSystemExercise: true,
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        
        // Create the workout exercise
        await WorkoutExerciseModel.create({
          workoutId: workout._id,
          exerciseId: exercise._id,
          userId: new Types.ObjectId(userId),
          duration: workout.duration * 60 || 0, // Duration in seconds
          distance: workout.distance || 0,
          order: 1,
          sets: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        updatedCount++;
        console.log(`Created missing workout exercise for workout ${workout._id}`);
      }
    }
    
    // Also check for workout exercises with distance that might be missing in the main workout
    const exercisesWithDistance = await WorkoutExerciseModel.find({
      userId: new Types.ObjectId(userId),
      distance: { $exists: true, $gt: 0 }
    });
    
    for (const exercise of exercisesWithDistance) {
      const workout = await WorkoutModel.findOne({
        _id: exercise.workoutId,
        userId: new Types.ObjectId(userId)
      });
      
      if (workout && (!workout.distance || workout.distance !== exercise.distance)) {
        await WorkoutModel.updateOne(
          { _id: workout._id },
          { 
            $set: { 
              distance: exercise.distance,
              'cardioDetails.distance': exercise.distance
            } 
          }
        );
        updatedCount++;
        console.log(`Updated workout ${workout._id} with distance ${exercise.distance}km from exercise`);
      }
    }
    
    // Revalidate paths to reflect the updates
    revalidatePath("/workouts");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/");
    
    return {
      success: true,
      message: `Updated ${updatedCount} records with distance data`,
      updatedCount
    };
  } catch (error) {
    console.error('Error repairing workout distances:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      updatedCount: 0
    };
  }
} 