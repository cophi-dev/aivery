import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { DailyInsightData as BaseDailyInsightData } from '@/types/db'; // Renamed for clarity

// Interface for the Mongoose Document
interface IDailyInsight extends Document {
  userId: Types.ObjectId; // Override from string to Types.ObjectId
  date: Date;
  title: string;
  description: string;
  insightText: string;
  generatedAt: Date;
  lastWorkoutTimestamp?: Date | null; // Already optional and Date in BaseDailyInsightData
  // createdAt and updatedAt are added by timestamps: true
}

// Mongoose Schema
const DailyInsightSchema: Schema<IDailyInsight> = new Schema( // Schema uses the final document interface
  {
    userId: {
      type: Schema.Types.ObjectId, // Correct type for Mongoose schema
      ref: 'User', // Reference to the User model
      required: true,
    },
    date: {
      type: Date, // Store the date the insight applies to (YYYY-MM-DD, start of day UTC)
      required: true,
    },
    title: {
      type: String, // Title from dailyContentConfig
      required: true,
    },
    description: {
      type: String, // Description from dailyContentConfig
      required: true,
    },
    insightText: { // This field is in DailyInsightData, ensure it's included
      type: String, // The generated AI insight
      required: true,
    },
    generatedAt: {
      type: Date, // Timestamp when the insight was generated
      required: true,
      default: Date.now,
    },
    lastWorkoutTimestamp: {
        type: Date, // Timestamp of the latest workout considered for this insight
        required: false, // May not always be present if no workouts found
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    collection: 'dailyInsights', // Explicitly set collection name
  }
);

// Add indexes for efficient querying
DailyInsightSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyInsightSchema.index({ userId: 1 });

// Create the model
// Check if the model already exists before defining it
const DailyInsightModel =
  (mongoose.models.DailyInsight as Model<IDailyInsight>) ||
  mongoose.model<IDailyInsight>('DailyInsight', DailyInsightSchema);

export default DailyInsightModel;
export type { IDailyInsight }; 