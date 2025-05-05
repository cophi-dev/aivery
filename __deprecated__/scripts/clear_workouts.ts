import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear the Workout collection...');

  // Important: Deleting workouts might require deleting related WorkoutExercise and Set records first
  // depending on your schema relations and cascading rules (which aren't explicitly defined here).
  // For simplicity, let's assume related records are handled or not strictly enforced.
  // If errors occur, we may need to delete WorkoutExercise/Set first.

  console.log('Clearing WorkoutExercise records related to workouts...');
  const { count: weCount } = await prisma.workoutExercise.deleteMany({});
  console.log(`Deleted ${weCount} WorkoutExercise records.`);

  // Note: If Set records have a direct relation to Workout (unlikely based on schema), clear them too.
  // Since Set relates to WorkoutExercise, clearing WorkoutExercise should be sufficient if relations cascade or aren't enforced.

  console.log('Clearing Workout records...');
  const { count } = await prisma.workout.deleteMany({});
  console.log(`Successfully deleted ${count} workouts.`);
}

main()
  .catch((e) => {
    console.error('Error clearing workouts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 