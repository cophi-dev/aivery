import mongoose, { Schema, type Document } from "mongoose"

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  image?: string
  nickname?: string
  height?: number
  weight?: number
  age?: number
  gender?: string
  activityLevel?: string
  goals?: string[]
  workouts?: string[]
  plans?: string[]
  accounts?: string[]
  sessions?: string[]
  emailVerified?: Date
  createdAt: Date
  updatedAt: Date
  aiPreferences?: {
    location?: string
    units?: string
    trainingPreferences?: string
    fitnessGoals?: string
    dietaryPreferences?: string
  }
  tier: 'free' | 'premium' | 'expert'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeSubscriptionStatus?: string
  planExpiresAt?: Date

  // New Summary Fields
  performanceSummary?: {
    overallTotals?: {
      distance?: number; // km
      duration?: number; // seconds
      volume?: number;   // kg (for strength)
      count?: number;    // number of workouts
    };
    lastWorkoutDate?: Date;
  };
  personalRecords?: {
    longestRun?: { value: number; date: Date }; // km
    fastest5kPace?: { value: number; date: Date }; // seconds per meter
    maxStrengthVolume?: { value: number; date: Date }; // kg
  };

  // New Rate Limiting Fields
  dailyGrokTokenUsage?: number
  lastGrokUsageReset?: Date
}

const AiPreferencesSchema = new Schema({
  location: { type: String },
  units: { type: String, default: 'metric' },
  trainingPreferences: { type: String },
  fitnessGoals: { type: String },
  dietaryPreferences: { type: String }
}, { _id: false })

// --- NEW SCHEMAS for Summaries ---
const OverallTotalsSchema = new Schema({
  distance: { type: Number, default: 0 }, // km
  duration: { type: Number, default: 0 }, // seconds
  volume: { type: Number, default: 0 },   // kg (for strength)
  count: { type: Number, default: 0 },    // number of workouts
}, { _id: false })

const PerformanceSummarySchema = new Schema({
  overallTotals: { type: OverallTotalsSchema, default: () => ({}) },
  lastWorkoutDate: { type: Date }
}, { _id: false })

const RecordSchema = new Schema({
  value: { type: Number },
  date: { type: Date }
}, { _id: false })

const PersonalRecordsSchema = new Schema({
  longestRun: { type: RecordSchema },        // km
  fastest5kPace: { type: RecordSchema },    // seconds per meter
  maxStrengthVolume: { type: RecordSchema } // kg
}, { _id: false })
// --- END NEW SCHEMAS ---

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { 
      type: String,
      required: true,
      select: false  // Don't include password by default in queries
    },
    image: { type: String },
    nickname: { type: String },
    height: { type: Number },
    weight: { type: Number },
    age: { type: Number },
    gender: { type: String },
    activityLevel: { type: String },
    goals: [{ type: String }],
    workouts: [{ type: Schema.Types.ObjectId, ref: 'Workout' }],
    plans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    emailVerified: { type: Date },
    accounts: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
    sessions: [{ type: Schema.Types.ObjectId, ref: 'Session' }],
    aiPreferences: { type: AiPreferencesSchema },
    tier: {
      type: String,
      enum: ['free', 'premium', 'expert'],
      default: 'free'
    },
    stripeCustomerId: {
      type: String,
      unique: true,
      sparse: true // Allows multiple nulls while enforcing uniqueness for actual values
    },
    stripeSubscriptionId: {
      type: String,
      unique: true,
      sparse: true
    },
    stripeSubscriptionStatus: { type: String }, // e.g., 'active', 'canceled', 'past_due'
    planExpiresAt: { type: Date },

    // --- Add New Summary Fields to Schema ---
    performanceSummary: { 
      type: PerformanceSummarySchema,
      default: () => ({})
    },
    personalRecords: {
      type: PersonalRecordsSchema,
      default: () => ({})
    },
    // --- End New Summary Fields ---

    // --- Add New Rate Limiting Fields ---
    dailyGrokTokenUsage: {
      type: Number,
      default: 0
    },
    lastGrokUsageReset: {
      type: Date
    }
    // --- End New Rate Limiting Fields ---
  },
  { timestamps: true },
)

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema, "users")

