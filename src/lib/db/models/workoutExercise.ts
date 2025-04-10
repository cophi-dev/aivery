import mongoose, { Schema, Document } from "mongoose"

// Interface for a single set (primarily for strength)
interface ISet {
  weight?: number
  reps?: number
  duration?: number
  distance?: number
  notes?: string
  order?: number
}

// Interface for the WorkoutExercise document
export interface IWorkoutExercise extends Document {
  userId: mongoose.Types.ObjectId
  workoutId: mongoose.Types.ObjectId
  exerciseId: mongoose.Types.ObjectId
  order: number
  notes?: string

  // --- Performance Metrics ---
  // Strength-focused (can also apply to some flexibility/other)
  sets?: ISet[]

  // Cardio/Endurance-focused (can also apply to HIIT components)
  duration?: number
  distance?: number
  pace?: number
  speed?: number
  elevationGain?: number
  calories?: number

  createdAt: Date
  updatedAt: Date
}

// --- Schemas ---

const SetSchema: Schema = new Schema({
  weight: { type: Number },
  reps: { type: Number },
  duration: { type: Number },
  distance: { type: Number },
  notes: { type: String },
  order: { type: Number },
}, { _id: false }) // No separate _id for sets needed usually

const WorkoutExerciseSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workoutId: { type: Schema.Types.ObjectId, ref: "Workout", required: true, index: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true, index: true },
    order: { type: Number, required: true, default: 0 }, // Default order, should be managed by app logic
    notes: { type: String },

    // Performance Metrics
    sets: { type: [SetSchema], default: undefined }, // Use undefined default to avoid empty array unless sets are added
    duration: { type: Number },
    distance: { type: Number },
    pace: { type: Number },
    speed: { type: Number },
    elevationGain: { type: Number },
    calories: { type: Number },
  },
  { timestamps: true } // Adds createdAt and updatedAt
)

// Indexing for common queries
WorkoutExerciseSchema.index({ userId: 1, exerciseId: 1, createdAt: -1 }) // For user's exercise history

export default mongoose.models.WorkoutExercise || 
  mongoose.model<IWorkoutExercise>("WorkoutExercise", WorkoutExerciseSchema) 