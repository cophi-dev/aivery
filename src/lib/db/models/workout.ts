import mongoose, { Schema, type Document } from "mongoose"

interface ISet {
  weight: number
  reps: number
}

interface IExercise {
  name: string
  sets: ISet[]
}

interface ILap {
  number: number
  distance: number
  duration: number
  pace?: number
}

interface IHeartRateData {
  average: number
  max: number
  zones?: {
    easy: number
    moderate: number
    hard: number
    peak: number
  }
}

interface ICardioDetails {
  distance: number
  duration: number
  pace?: number
  elevationGain?: number
  heartRate?: IHeartRateData
  laps?: ILap[]
  poolLength?: number
  strokeType?: string
  bikeType?: string
  power?: {
    average: number
    max: number
  }
}

export interface IWorkout extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  date: Date
  duration: number
  intensity: "Low" | "Medium" | "High"
  type: "strength" | "running" | "swimming" | "cycling" | "hiit" | "flexibility" | "other"
  volume?: number
  distance?: number
  calories?: number
  exercises?: IExercise[]
  cardioDetails?: ICardioDetails
  notes?: string
  completed?: boolean
  completedAt?: Date
  source?: "manual" | "garmin" | "coros" | "strava" | "apple" | "ai"
  sourceId?: string
  createdAt: Date
  updatedAt: Date
}

const SetSchema = new Schema({
  weight: { type: Number, required: true },
  reps: { type: Number, required: true },
})

const ExerciseSchema = new Schema({
  name: { type: String, required: true },
  sets: [SetSchema],
})

const LapSchema = new Schema({
  number: { type: Number, required: true },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  pace: { type: Number },
})

const HeartRateZonesSchema = new Schema({
  easy: { type: Number },
  moderate: { type: Number },
  hard: { type: Number },
  peak: { type: Number },
})

const HeartRateDataSchema = new Schema({
  average: { type: Number, required: true },
  max: { type: Number, required: true },
  zones: { type: HeartRateZonesSchema },
})

const PowerDataSchema = new Schema({
  average: { type: Number, required: true },
  max: { type: Number, required: true },
})

const CardioDetailsSchema = new Schema({
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  pace: { type: Number },
  elevationGain: { type: Number },
  heartRate: { type: HeartRateDataSchema },
  laps: [LapSchema],
  poolLength: { type: Number },
  strokeType: { type: String },
  bikeType: { type: String },
  power: { type: PowerDataSchema },
})

const WorkoutSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    date: { type: Date, required: true },
    duration: { type: Number, required: true },
    intensity: { type: String, enum: ["Low", "Medium", "High"], required: true },
    type: {
      type: String,
      enum: ["strength", "running", "swimming", "cycling", "hiit", "flexibility", "other"],
      required: true,
    },
    volume: { type: Number },
    distance: { type: Number },
    calories: { type: Number },
    exercises: [ExerciseSchema],
    cardioDetails: { type: CardioDetailsSchema },
    notes: { type: String },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    source: { type: String, enum: ["manual", "garmin", "coros", "strava", "apple", "ai"], default: "manual" },
    sourceId: { type: String },
  },
  { timestamps: true },
)

export default mongoose.models.Workout || mongoose.model<IWorkout>("Workout", WorkoutSchema)

