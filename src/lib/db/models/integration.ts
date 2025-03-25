import mongoose, { Schema, type Document } from "mongoose"

export interface IIntegration extends Document {
  userId: mongoose.Types.ObjectId
  provider: "garmin" | "coros" | "strava" | "apple"
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  lastSynced?: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const IntegrationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: {
      type: String,
      enum: ["garmin", "coros", "strava", "apple"],
      required: true,
    },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    lastSynced: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

// Create a compound index to ensure a user can only have one integration per provider
IntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true })

export default mongoose.models.Integration || mongoose.model<IIntegration>("Integration", IntegrationSchema)

