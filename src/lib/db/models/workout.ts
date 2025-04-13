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

export interface ICardioDetails {
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

// Define schema for individual time-series data points
const RecordSchema = new Schema({
  timestamp: { type: Date, required: true },
  heart_rate: { type: Number },
  distance: { type: Number }, // Cumulative distance in meters
  speed: { type: Number }, // Speed in m/s
  altitude: { type: Number }, // Altitude in meters
  latitude: { type: Number },
  longitude: { type: Number },
  cadence: { type: Number }, // Running cadence (steps/min) or cycling cadence (rpm)
  power: { type: Number } // Power in watts
}, { _id: false }); // Disable _id for subdocuments

export interface IWorkout extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  date: Date
  duration: number // Represents the *total* duration of the workout session
  intensity?: "Low" | "Medium" | "High"
  type: "strength" | "running" | "swimming" | "cycling" | "hiit" | "flexibility" | "walking" | "yoga" | "pilates" | "other" // Overall type, could be derived or set
  // volume?: number // Volume might be better calculated on the fly from WorkoutExercises
  calculatedVolume?: number; // Added field for storing total calculated volume
  distance: number // <-- Uncomment this line
  // calories?: number // Total calories might be better calculated on the fly from WorkoutExercises
  // REMOVED: exercises?: IExercise[] // This is now handled by WorkoutExercise collection
  cardioDetails?: ICardioDetails // Keep for potentially storing *overall* cardio summary if needed, distinct from individual exercise performance
  notes?: string // Overall workout notes
  completed?: boolean
  completedAt?: Date
  source?: "manual" | "garmin" | "coros" | "strava" | "apple" | "ai"
  sourceId?: string
  importedFrom?: string
  importId?: string
  stravaLink?: string
  records?: Array<{ // Time-series data for the whole workout (e.g., from watch)
    timestamp: Date;
    heart_rate?: number;
    distance?: number;
    speed?: number;
    altitude?: number;
    latitude?: number;
    longitude?: number;
    cadence?: number;
    power?: number;
  }>;
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

const LapSchema = new Schema({
  number: { type: Number, required: true },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  pace: { type: Number },
})

const HeartRateZonesSchema = new Schema({
  thresholds: {
    easy: { type: Number },
    moderate: { type: Number },
    hard: { type: Number },
    peak: { type: Number }
  },
  distribution: {
    easy: { type: Number },
    moderate: { type: Number },
    hard: { type: Number },
    peak: { type: Number }
  }
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
  speed: { type: Number },
  maxSpeed: { type: Number },
  elevationGain: { type: Number },
  heartRate: { type: HeartRateDataSchema },
  laps: [LapSchema],
  poolLength: { type: Number },
  strokeType: { type: String },
  bikeType: { type: String },
  power: { type: PowerDataSchema },
  sportDetails: {
    sport: { type: String },
    subSport: { type: String }
  },
  // Add gear information schema
  gearInfo: {
    id: { type: String },
    name: { type: String },
    distance: { type: Number }
  },
  // Add weather information schema
  weather: {
    temperature: { type: Number },
    humidity: { type: Number },
    windSpeed: { type: Number },
    conditions: { type: String }
  },
  // Add Strava-specific additional data
  stravaSpecific: {
    segmentEfforts: { type: Number },
    achievementCount: { type: Number },
    kudosCount: { type: Number },
    athleteWeight: { type: Number },
    commute: { type: Boolean },
    deviceName: { type: String },
    segmentDetails: [{
      id: { type: String },
      name: { type: String },
      distance: { type: Number },
      elapsedTime: { type: Number },
      startDate: { type: String },
      average_heartrate: { type: Number },
      max_heartrate: { type: Number },
      prPowered: { type: Boolean },
      komPowered: { type: Boolean },
      startIndex: { type: Number },
      endIndex: { type: Number }
    }]
  }
})

const WorkoutSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    date: { type: Date, required: true },
    duration: { type: Number, required: true }, // Total duration
    intensity: { type: String, enum: ["Low", "Medium", "High"], required: false },
    type: {
      type: String,
      enum: ["strength", "running", "swimming", "cycling", "hiit", "flexibility", "walking", "yoga", "pilates", "other"],
      required: true,
    },
    // REMOVED: volume: { type: Number },
    calculatedVolume: { type: Number, default: 0 }, // Added field to schema definition
    distance: { type: Number }, // <-- Uncomment this line
    // REMOVED: calories: { type: Number },
    // REMOVED: exercises: [ExerciseSchema], // Removed embedded exercises
    cardioDetails: { type: CardioDetailsSchema }, // Keep overall details if needed
    notes: { type: String },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    source: { type: String, enum: ["manual", "garmin", "coros", "strava", "apple", "ai"], default: "manual" },
    sourceId: { type: String },
    importedFrom: { type: String },
    importId: { type: String },
    stravaLink: { type: String },
    records: [RecordSchema], // Keep time-series data
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Add compound index for uniqueness on source + sourceId per user
WorkoutSchema.index({ userId: 1, source: 1, sourceId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Workout || mongoose.model<IWorkout>("Workout", WorkoutSchema)

