import dbConnect from '../src/lib/db/mongodb.ts';
import ExerciseModel from '../src/lib/db/models/exercise.ts';
import seedExercises from '../src/lib/db/seed/seedExercises.ts';

// Remove the old exercisesToSeed array, as we now use seedExercises

async function seedDatabase() {
  console.log('Connecting to database...');
  await dbConnect(); // Connect first
  console.log('Database connected.');

  let exercisesAdded = 0;
  let exercisesSkipped = 0;

  try {
    console.log('Starting seeding process...');
    const exercisesToAdd = [];

    for (const exerciseData of seedExercises) {
      const existingExercise = await ExerciseModel.findOne({ name: exerciseData.name }).lean();
      if (!existingExercise) {
        console.log(`- Preparing to add: ${exerciseData.name}`);
        exercisesToAdd.push(exerciseData);
      } else {
        console.log(`- Skipping (already exists): ${exerciseData.name}`);
        exercisesSkipped++;
      }
    }

    if (exercisesToAdd.length > 0) {
      console.log(`Inserting ${exercisesToAdd.length} new exercises...`);
      const result = await ExerciseModel.insertMany(exercisesToAdd);
      exercisesAdded = result.length;
      console.log(`Successfully added ${exercisesAdded} exercises.`);
    } else {
      console.log('No new exercises to add.');
    }

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    console.log('Seeding process finished.');
    console.log(`Total added: ${exercisesAdded}`);
    console.log(`Total skipped: ${exercisesSkipped}`);
    process.exit(0);
  }
}

seedDatabase(); 