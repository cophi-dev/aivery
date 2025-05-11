import { NextRequest, NextResponse } from "next/server";
import { updateExercisePRs } from "@/lib/workout-actions";
import dbConnect from "@/lib/db/mongodb";
import User from "@/lib/db/models/user";

export async function POST(request: NextRequest) {
  try {
    console.log('Connecting to database...');
    await dbConnect();

    console.log('Fetching all users...');
    const users = await User.find().select('_id').lean();
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      const userId = user._id.toString();
      console.log(`Processing user ${userId}...`);
      try {
        await updateExercisePRs(userId);
        console.log(`Completed processing PRs for user ${userId}`);
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
      }
    }

    console.log('Backfill complete!');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during backfill:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
} 