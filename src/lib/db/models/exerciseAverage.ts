import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IExerciseAverage extends Document {
  userId: mongoose.Types.ObjectId;
  exerciseId: mongoose.Types.ObjectId;
  type: string; // 'reps', 'weight', 'volume', etc.
  rollingAvg30d: number;
  rollingAvg90d: number;
  lastUpdated: Date;
}

const ExerciseAverageSchema: Schema<IExerciseAverage> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true, index: true },
  type: { type: String, required: true },
  rollingAvg30d: { type: Number, required: true, default: 0 },
  rollingAvg90d: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

ExerciseAverageSchema.index({ userId: 1, exerciseId: 1, type: 1 }, { unique: true });

const ExerciseAverageModel: Model<IExerciseAverage> =
  mongoose.models.ExerciseAverage || mongoose.model<IExerciseAverage>('ExerciseAverage', ExerciseAverageSchema);

export default ExerciseAverageModel; 