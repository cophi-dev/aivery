import mongoose, { Schema, type Document } from "mongoose"

// Define specific types for clarity
type ExerciseCategory = "strength" | "cardio" | "flexibility" | "other"
type ExerciseLevel = "beginner" | "intermediate" | "advanced"

export interface IExercise extends Document {
  name: string
  aliases?: string[]
  description?: string
  primaryMuscles: string[]
  secondaryMuscles?: string[]
  category: ExerciseCategory
  level?: ExerciseLevel
  equipment?: string[]
  instructions: string[]
  tips?: string[]
  images?: string[]
  videos?: string[]
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  trackMaxReps?: boolean
  userId?: mongoose.Types.ObjectId
}

const ExerciseSchema: Schema<IExercise> = new Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], required: false },
    description: { type: String, required: false },
    primaryMuscles: { type: [String], required: true },
    secondaryMuscles: { type: [String], required: false },
    category: {
      type: String,
      enum: ["strength", "cardio", "flexibility", "other"],
      default: "strength",
      required: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: false,
    },
    equipment: { type: [String], required: false },
    instructions: { type: [String], required: true },
    tips: { type: [String], required: false },
    images: { type: [String], required: false },
    videos: { type: [String], required: false },
    tags: { type: [String], default: [], index: true },
    trackMaxReps: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true },
)

// Indexing for common search fields
ExerciseSchema.index({ primaryMuscles: 1 })
ExerciseSchema.index({ category: 1 })
ExerciseSchema.index({ equipment: 1 })
ExerciseSchema.index({ tags: 1 })

export default mongoose.models.Exercise as mongoose.Model<IExercise> ||
  mongoose.model<IExercise>("Exercise", ExerciseSchema) 