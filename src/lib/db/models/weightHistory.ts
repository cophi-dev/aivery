import mongoose, { Schema, type Document } from "mongoose"

export interface IWeightHistory extends Document {
  userId: string
  weight: number
  date: Date
  note?: string
}

const WeightHistorySchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    weight: { type: Number, required: true },
    date: { type: Date, required: true },
    note: { type: String },
  },
  { timestamps: true }
)

// Create an index on userId and date for efficient queries
WeightHistorySchema.index({ userId: 1, date: -1 })

export default mongoose.models.WeightHistory || mongoose.model<IWeightHistory>("WeightHistory", WeightHistorySchema) 