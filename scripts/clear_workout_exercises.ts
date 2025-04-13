import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear the WorkoutExercise collection...');

  try {
    const { count } = await prisma.workoutExercise.deleteMany({});
    console.log(`Successfully deleted ${count} WorkoutExercise records.`);
  } catch (error) {
    console.error('Error clearing WorkoutExercise table:', error);
    process.exit(1); // Exit with error code
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from database.');
  }
}

main()
  .then(() => {
    process.exit(0); // Exit successfully
  })
  .catch((e) => {
    console.error(e);
    process.exit(1); // Exit with error code
  }); 