import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Assuming authOptions are defined here
import mongoose, { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb'; // Use default import

// Import all necessary models
import User from '@/lib/db/models/user';
import Account from '@/lib/db/models/account';
import Session from '@/lib/db/models/session';
import Integration from '@/lib/db/models/integration';
import Workout from '@/lib/db/models/workout';
import WorkoutExercise from '@/lib/db/models/workoutExercise';
import SetModel from '@/lib/db/models/set'; // Named it SetModel to avoid conflict with Set class
import ExercisePR from '@/lib/db/models/exercisePR';
import WeightHistory from '@/lib/db/models/weightHistory';
// Assuming a Preferences model exists and is structured similarly
// import Preferences from '@/lib/db/models/preferences'; // Uncomment if you have this model

const DB_NAME = process.env.DB_NAME || 'aivery'; // Use environment variable or default
const PREFERENCES_COLLECTION = 'preferences'; // As used in stravaService

export async function DELETE(request: Request) {
  try {
    await connectToDatabase();
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const userId = new Types.ObjectId(session.user.id);
    console.log(`Initiating account deletion for user: ${userId}`);

    // Use a MongoDB transaction for atomicity (optional but recommended)
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // 1. Delete Workout Sets (indirectly related via WorkoutExercise)
      // Find all WorkoutExercises for the user to get their IDs
      const userWorkoutExercises = await WorkoutExercise.find({ userId: userId }, { _id: 1 }).session(mongoSession).lean();
      const workoutExerciseIds = userWorkoutExercises.map(we => we._id);
      if (workoutExerciseIds.length > 0) {
        console.log(`Deleting ${workoutExerciseIds.length} sets linked to user's workout exercises...`);
        await SetModel.deleteMany({ workoutExerciseId: { $in: workoutExerciseIds } }).session(mongoSession);
      }

      // 2. Delete WorkoutExercises
      console.log(`Deleting WorkoutExercises for user ${userId}...`);
      await WorkoutExercise.deleteMany({ userId: userId }).session(mongoSession);

      // 3. Delete Workouts
      console.log(`Deleting Workouts for user ${userId}...`);
      await Workout.deleteMany({ userId: userId }).session(mongoSession);

      // 4. Delete Exercise PRs
      console.log(`Deleting ExercisePRs for user ${userId}...`);
      await ExercisePR.deleteMany({ userId: userId }).session(mongoSession);

      // 5. Delete Weight History
      console.log(`Deleting WeightHistory for user ${userId}...`);
      await WeightHistory.deleteMany({ userId: userId }).session(mongoSession);

      // 6. Delete Integrations (Strava, etc.)
      console.log(`Deleting Integrations for user ${userId}...`);
      await Integration.deleteMany({ userId: userId }).session(mongoSession);

      // 7. Delete Preferences (using direct collection access if no model)
      console.log(`Deleting Preferences for user ${userId}...`);
      if (!mongoose.connection || !mongoose.connection.db) {
        throw new Error('Database connection not available for deleting preferences.');
      }
      const preferencesCollection = mongoose.connection.db.collection(PREFERENCES_COLLECTION);
      await preferencesCollection.deleteMany({ userId: userId }, { session: mongoSession });
      // If you have a Preferences model:
      // await Preferences.deleteMany({ userId: userId }).session(mongoSession);

      // 8. Delete Sessions (log the user out)
      console.log(`Deleting Sessions for user ${userId}...`);
      await Session.deleteMany({ userId: userId }).session(mongoSession);

      // 9. Delete Accounts (OAuth links, etc.)
      console.log(`Deleting Accounts for user ${userId}...`);
      await Account.deleteMany({ userId: userId }).session(mongoSession);

      // 10. Delete the User document itself
      console.log(`Deleting User document for user ${userId}...`);
      const userDeletionResult = await User.deleteOne({ _id: userId }).session(mongoSession);

      if (userDeletionResult.deletedCount === 0) {
        throw new Error(`User document not found for deletion: ${userId}`);
      }

      // Commit the transaction
      await mongoSession.commitTransaction();
      console.log(`Successfully deleted account and all associated data for user: ${userId}`);

      return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });

    } catch (error) {
      // If any operation fails, abort the transaction
      await mongoSession.abortTransaction();
      console.error(`Error during account deletion transaction for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ message: 'Account deletion failed', error: errorMessage }, { status: 500 });
    } finally {
      // End the session
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error processing account deletion request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Internal server error', error: errorMessage }, { status: 500 });
  }
} 