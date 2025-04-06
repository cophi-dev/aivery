import dbConnect from '@/lib/db/mongodb';
import Workout from '@/lib/db/models/workout';
import { WorkoutData } from '@/types/db'; 
import { ObjectId } from 'mongodb'; // Or potentially from mongoose if that's the source

// Find workout by ID
export async function getWorkoutById(id: string | ObjectId): Promise<WorkoutData | null> {
  await dbConnect();
  if (!ObjectId.isValid(id)) {
    console.error("Invalid ObjectId passed to getWorkoutById:", id);
    return null; // Or throw an error if that's preferred
  }
  const workout = await Workout.findById(id);
  if (!workout) return null;
  return workout.toObject() as WorkoutData; // Convert to plain object
}

// Update an existing workout
export async function updateWorkoutInDb(id: string | ObjectId, updateData: Partial<Omit<WorkoutData, '_id'>>): Promise<WorkoutData | null> {
  await dbConnect();
  if (!ObjectId.isValid(id)) {
    console.error("Invalid ObjectId passed to updateWorkoutInDb:", id);
    return null;
  }
  const updatedWorkout = await Workout.findByIdAndUpdate(
    id,
    { $set: updateData }, 
    { new: true, runValidators: true } // Return the updated document and run schema validators
  );
  if (!updatedWorkout) return null;
  return updatedWorkout.toObject() as WorkoutData;
}

// Delete workout by ID
// ... existing code ... 