import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface representing a document in MongoDB.
export interface ISet extends Document {
  _id: Types.ObjectId;
  workoutExerciseId: Types.ObjectId; // Relation to WorkoutExercise
  order?: number; // Optional: Order of the set within the exercise
  
  // Strength Training Fields
  weight?: number; // e.g., in kg or lbs (unit defined in UserPreferences or context)
  reps?: number; 
  
  // Cardio/Endurance Fields
  distance?: number; // e.g., in meters or km
  duration?: number; // e.g., in seconds
  pace?: number; // e.g., min/km or min/mile
  
  // Other Fields
  notes?: string; // Notes specific to this set
  
  createdAt: Date;
  updatedAt: Date;
}

// Schema corresponding to the document interface.
const SetSchema: Schema<ISet> = new Schema(
  {
    workoutExerciseId: { type: Schema.Types.ObjectId, ref: 'WorkoutExercise', required: true, index: true },
    order: { type: Number },
    weight: { type: Number },
    reps: { type: Number },
    distance: { type: Number },
    duration: { type: Number },
    pace: { type: Number },
    notes: { type: String },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Export the Mongoose model.
// The third argument specifies the collection name ('sets'). If omitted, Mongoose uses the plural, lowercased version of the model name ('sets').
export default mongoose.models.Set || mongoose.model<ISet>('Set', SetSchema, 'sets'); 