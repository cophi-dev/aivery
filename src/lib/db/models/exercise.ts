import mongoose, { Schema, type Document } from "mongoose"

export interface IExercise extends Document {
  name: string
  description?: string
  muscleGroups: string[]
  category: "strength" | "cardio" | "flexibility"
  equipment?: string[]
  instructions?: string
  createdAt: Date
  updatedAt: Date
  trackMaxReps?: boolean
  userId: mongoose.Types.ObjectId
  apiDescription: string
  apiGifUrl: string
}

const ExerciseSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    muscleGroups: { type: [String], required: true },
    category: { 
      type: String, 
      enum: ["strength", "cardio", "flexibility"], 
      default: "strength", 
      required: true 
    },
    equipment: { type: [String] },
    instructions: { type: String },
    trackMaxReps: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    apiDescription: { type: String, required: false },
    apiGifUrl: { type: String, required: false },
  },
  { timestamps: true },
)

export default mongoose.models.Exercise || mongoose.model<IExercise>("Exercise", ExerciseSchema) 