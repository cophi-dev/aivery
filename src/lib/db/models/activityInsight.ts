import mongoose, { Schema, Document, Model, models, Types } from 'mongoose';

// Define the structure for the stored insight data
interface InsightData {
    highlight: string;
    positiveTrends?: string[];
    negativeTrends?: string[];
    milestones?: string[];
}

// Interface for the ActivityInsight document
export interface IActivityInsight extends Document {
    userId: Types.ObjectId;
    periodType: 'weekly' | 'monthly'; // Add more types if needed
    periodStartDate: Date;
    insightData: InsightData;
    generatedAt: Date;
    lastWorkoutTimestamp: Date | null; // Timestamp of the latest workout factored in
}

const ActivityInsightSchema = new Schema<IActivityInsight>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    periodType: {
        type: String,
        enum: ['weekly', 'monthly'],
        required: true,
        index: true,
    },
    periodStartDate: {
        type: Date,
        required: true,
        index: true,
    },
    insightData: {
        type: Schema.Types.Mixed, // Store the raw JSON object
        required: true,
    },
    generatedAt: {
        type: Date,
        default: Date.now,
    },
    lastWorkoutTimestamp: {
        type: Date,
        default: null, // Default to null if no workout factored in
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
});

// Compound index for efficient querying
ActivityInsightSchema.index({ userId: 1, periodType: 1, periodStartDate: 1 });

const ActivityInsightModel:
    Model<IActivityInsight> =
    models.ActivityInsight ||
    mongoose.model<IActivityInsight>('ActivityInsight', ActivityInsightSchema);

export default ActivityInsightModel; 