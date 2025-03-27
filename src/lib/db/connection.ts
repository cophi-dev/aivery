import { getCollection } from './mongodb';
import { ObjectId } from 'mongodb';
import { serializeMongoData } from './mongodb';

// Database client to abstract MongoDB operations
export const getDbClient = async () => {
  return {
    // Find all workouts
    findWorkouts: async () => {
      const collection = await getCollection('workouts');
      const workouts = await collection.find({}).sort({ date: -1 }).toArray();
      return serializeMongoData(workouts);
    },
    
    // Find workout by ID
    findWorkoutById: async (id: string) => {
      const collection = await getCollection('workouts');
      const workout = await collection.findOne({ _id: new ObjectId(id) });
      if (!workout) return null;
      return serializeMongoData(workout);
    },
    
    // Insert a workout
    insertWorkout: async (workout: any) => {
      const collection = await getCollection('workouts');
      const result = await collection.insertOne(workout);
      return { id: result.insertedId.toString() };
    },
    
    // Update a workout
    updateWorkout: async (id: string, data: any) => {
      const collection = await getCollection('workouts');
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...data, updatedAt: new Date() } }
      );
      return result.modifiedCount > 0;
    },
    
    // Delete a workout
    deleteWorkout: async (id: string) => {
      const collection = await getCollection('workouts');
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    }
  };
}; 