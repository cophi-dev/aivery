import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear ALL seedable data (Users, Exercises, Workouts, Sets)...');

  // Delete dependent records first (in correct order)
  console.log('Clearing Set records...');
  const { count: setCount } = await prisma.set.deleteMany({});
  console.log(`Deleted ${setCount} Set records.`);
  
  console.log('Clearing WorkoutExercise records...');
  const { count: weCount } = await prisma.workoutExercise.deleteMany({});
  console.log(`Deleted ${weCount} WorkoutExercise records.`);
  
  console.log('Clearing Workout records...');
  const { count: wCount } = await prisma.workout.deleteMany({});
  console.log(`Deleted ${wCount} Workout records.`);

  console.log('Clearing Exercise records...');
  const { count: eCount } = await prisma.exercise.deleteMany({});
  console.log(`Deleted ${eCount} Exercise records.`);

  // Optionally clear ALL users, or just the demo user
  // For a full reset before seeding, clearing all users might be desired
  console.log('Clearing User records (including demo user)...');
  const { count: uCount } = await prisma.user.deleteMany({}); 
  console.log(`Deleted ${uCount} User records.`);
  // Alternatively, to only delete the demo user:
  /*
  const demoEmail = 'demo@example.com';
  try {
    console.log(`Attempting to delete demo user: ${demoEmail}...`);
    const deletedUser = await prisma.user.delete({
      where: { email: demoEmail },
    });
    console.log(`Successfully deleted demo user: ${deletedUser.email}`);
  } catch (error: any) {
    if (error.code === 'P2025') { // Record to delete does not exist.
      console.log(`Demo user ${demoEmail} not found.`);
    } else {
      console.error('Error deleting demo user:', error);
    }
  }
  */

  // Clear preferences if needed (depends on User deletion)
  if (uCount > 0) { // Only clear if users were deleted
      console.log('Clearing UserPreferences records...');
      const { count: pCount } = await prisma.userPreferences.deleteMany({});
      console.log(`Deleted ${pCount} UserPreferences records.`);
  }

  console.log('Clearing finished.');
}

main()
  .catch((e) => {
    console.error('Error during clearing process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 