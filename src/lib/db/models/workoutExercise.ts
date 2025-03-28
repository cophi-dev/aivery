import mongoose, { Schema, type Document } from "mongoose"

interface ISet {
  weight: number
  reps: number
  notes?: string
}

export interface IWorkoutExercise extends Document {
  workoutId: mongoose.Types.ObjectId
  exerciseId: mongoose.Types.ObjectId
  sets: ISet[]
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const SetSchema = new Schema({
  weight: { type: Number, required: true },
  reps: { type: Number, required: true },
  notes: { type: String }
})

const WorkoutExerciseSchema: Schema = new Schema(
  {
    workoutId: { type: Schema.Types.ObjectId, ref: "Workout", required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise", required: true },
    sets: [SetSchema],
    notes: { type: String }
  },
  { timestamps: true },
)

// Create a compound index to ensure unique combinations of workout and exercise
WorkoutExerciseSchema.index({ workoutId: 1, exerciseId: 1 }, { unique: true })

export default mongoose.models.WorkoutExercise || 
  mongoose.model<IWorkoutExercise>("WorkoutExercise", WorkoutExerciseSchema) 