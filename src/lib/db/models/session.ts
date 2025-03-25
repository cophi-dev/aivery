import mongoose, { Schema, type Document } from "mongoose"

export interface ISession extends Document {
  userId: string
  expires: Date
  sessionToken: string
}

const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expires: { type: Date, required: true },
    sessionToken: { type: String, required: true, unique: true },
  },
  { timestamps: true }
)

export default mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema) 