import dbConnect from '@/lib/db/mongoose';
import DailyInsightModel, { IDailyInsight } from '@/lib/db/models/dailyInsight';
import { Types } from 'mongoose';
import { DailyInsightData } from '@/types/db';
import { toClientData } from '@/lib/db/utils';

/**
 * Finds the latest daily insight for a user on a specific date.
 *
 * @param userId The ID of the user.
 * @param date The date for which to find the insight (should be start of day UTC).
 * @returns The sanitized insight data or null if not found.
 */
export async function findLatestInsightForUserAndDate(
  userId: string,
  date: Date
): Promise<DailyInsightData | null> {
  await dbConnect();
  console.log(`[DailyInsightRepo] Finding insight for User ${userId} on Date ${date.toISOString()}`);

  // Ensure date is at the start of the day UTC for consistent matching
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(startOfDay.getUTCDate() + 1);

  try {
    const insight = await DailyInsightModel.findOne({
      userId: new Types.ObjectId(userId),
      date: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    })
    .sort({ generatedAt: -1 }) // Get the most recently generated one for that day
    .lean();

    if (insight) {
        console.log(`[DailyInsightRepo] Found insight ID: ${insight._id}`);
        return toClientData<DailyInsightData>(insight as IDailyInsight);
    }
    console.log(`[DailyInsightRepo] No insight found.`);
    return null;
  } catch (error) {
    console.error('[DailyInsightRepo] Error finding insight:', error);
    throw new Error('Failed to fetch daily insight from database.');
  }
}

/**
 * Creates or updates a daily insight for a user on a specific date.
 *
 * @param insightData The data for the insight to save.
 * @returns The sanitized, saved insight data.
 */
export async function createOrUpdateInsight(
  insightData: Omit<DailyInsightData, '_id' | 'createdAt' | 'updatedAt' | 'generatedAt'>
): Promise<DailyInsightData> {
  await dbConnect();
  console.log(`[DailyInsightRepo] Creating/Updating insight for User ${insightData.userId} on Date ${insightData.date.toISOString()}`);

  // Ensure date is start of day UTC
  const startOfDay = new Date(insightData.date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const filter = {
    userId: new Types.ObjectId(insightData.userId),
    date: startOfDay, // Match based on the start of the day
  };

  const update = {
    ...insightData,
    userId: new Types.ObjectId(insightData.userId), // Ensure userId is ObjectId
    date: startOfDay, // Ensure date is start of day
    generatedAt: new Date(), // Set generation timestamp
  };

  try {
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    const savedInsight = await DailyInsightModel.findOneAndUpdate(filter, update, options).lean();

    if (!savedInsight) {
        console.error('[DailyInsightRepo] Failed to save/update insight, findOneAndUpdate returned null.');
        throw new Error('Database operation failed to return the saved document.');
    }

    console.log(`[DailyInsightRepo] Saved/Updated insight ID: ${savedInsight._id}`);
    return toClientData<DailyInsightData>(savedInsight as IDailyInsight);
  } catch (error) {
    console.error('[DailyInsightRepo] Error saving insight:', error);
    if (error instanceof Error && error.message.includes('Database operation failed')) {
        throw error;
    }
    throw new Error('Failed to save daily insight to database.');
  }
}