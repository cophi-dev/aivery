import mongoose, { Schema, type Document } from "mongoose"

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  image?: string
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
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    image: { type: String },
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
  },
  { timestamps: true },
)

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema)

