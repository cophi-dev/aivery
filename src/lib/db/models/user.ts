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
}

const AiPreferencesSchema = new Schema({
  location: { type: String },
  units: { type: String, default: 'metric' },
  trainingPreferences: { type: String },
  fitnessGoals: { type: String },
  dietaryPreferences: { type: String }
}, { _id: false })

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
    planExpiresAt: { type: Date }
  },
  { timestamps: true },
)

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema, "users")

