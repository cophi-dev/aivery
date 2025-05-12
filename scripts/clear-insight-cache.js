import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Load environment variables from .env.local
config({ 
  path: resolve(rootDir, '.env.local'),
  override: true 
});

// Also load from .env if it exists (for defaults)
config({ 
  path: resolve(rootDir, '.env'),
  override: false 
});

// Add this after loading env
const userId = process.env.INSIGHT_USER_ID; // Set this in your .env.local if you want to filter by user

// Define models inline since we can't import them directly in ESM
const ActivityInsightSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  periodType: String,
  periodStartDate: Date,
  insightData: mongoose.Schema.Types.Mixed,
  generatedAt: Date,
  lastWorkoutTimestamp: Date
});

const DailyInsightSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  date: Date,
  title: String,
  description: String,
  insightText: String,
  generatedAt: Date,
  lastWorkoutTimestamp: Date
});

const ActivityInsightModel = mongoose.models.ActivityInsight || mongoose.model('ActivityInsight', ActivityInsightSchema);
const DailyInsightModel = mongoose.models.DailyInsight || mongoose.model('DailyInsight', DailyInsightSchema);

async function clearInsightCache() {
  try {
    console.log('Environment check:');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set (starts with: ' + process.env.MONGODB_URI.substring(0, 20) + '...)' : 'Not set');
    
    console.log('\nConnecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Clearing ActivityInsight cache...');
    const activityResult = await ActivityInsightModel.deleteMany({});
    console.log(`Deleted ${activityResult.deletedCount} activity insights`);

    // Print all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in DB:', collections.map(c => c.name));

    // Print count before deletion
    const countBefore = await DailyInsightModel.countDocuments({});
    console.log('DailyInsight count before:', countBefore);

    // Try deleting with Mongoose
    const resultMongoose = await DailyInsightModel.deleteMany({});
    console.log('Deleted (Mongoose):', resultMongoose.deletedCount);

    // Print count after Mongoose deletion
    const countAfterMongoose = await DailyInsightModel.countDocuments({});
    console.log('DailyInsight count after Mongoose delete:', countAfterMongoose);

    // Try deleting with raw driver as fallback
    const resultRaw = await mongoose.connection.db.collection('dailyInsights').deleteMany({});
    console.log('Deleted (raw):', resultRaw.deletedCount);

    // Print count after raw driver deletion
    const countAfterRaw = await DailyInsightModel.countDocuments({});
    console.log('DailyInsight count after raw delete:', countAfterRaw);

    console.log('\nSuccessfully cleared insight cache!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error clearing insight cache:', error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting from MongoDB:', disconnectError);
    }
    process.exit(1);
  }
}

clearInsightCache(); 