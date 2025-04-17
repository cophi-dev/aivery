import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IExercisePR extends Document {
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  exerciseName: string; // Denormalized for easier display
  value: number; // The PR value (e.g., weight, reps, time in seconds)
  unit: string; // e.g., 'kg', 'lbs', 'reps', 'seconds', 'meters'
  date: Date; // Date the PR was achieved
  workoutId?: Types.ObjectId; // Optional: Link to the specific workout
  createdAt: Date;
  updatedAt: Date;
}

const ExercisePRSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for querying by user
    },
    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
      index: true, // Index for querying by exercise
    },
    exerciseName: {
      // Denormalized name for convenience
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    date: {
      // Date the PR was set
      type: Date,
      required: true,
    },
    workoutId: {
      // Optional link to the workout document
      type: Schema.Types.ObjectId,
      ref: 'Workout',
      required: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    // Unique compound index to ensure only one PR per user/exercise/unit
    // (Allows storing different PR types, e.g., max weight AND max reps for the same exercise)
    indexes: [{ unique: true, fields: ['userId', 'exerciseId', 'unit'] }]
  }
);

export default mongoose.models.ExercisePR || mongoose.model<IExercisePR>('ExercisePR', ExercisePRSchema, 'exercisePRs'); // Use plural collection name 