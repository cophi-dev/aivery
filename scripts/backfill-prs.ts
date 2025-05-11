const { updateExercisePRs } = require('../src/lib/workout-actions');
const dbConnect = require('../src/lib/db/mongodb').default;
const User = require('../src/lib/db/models/user').default;
const { Types } = require('mongoose');

async function backfillPRs() {
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
    process.exit(0);
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

backfillPRs(); 