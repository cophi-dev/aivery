import dbConnect from '@/lib/db/mongodb'; // Use path alias
import ExerciseModel from '@/lib/db/models/exercise'; // Use path alias
import type { ExerciseData } from '@/types/db'; // Use path alias

// Define the exercises to add
// Using singular, title-case names for consistency
const exercisesToSeed: Omit<ExerciseData, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Kettlebell Swing',
    description: 'A dynamic hinge movement exercise.',
    muscleGroups: ['hamstrings', 'glutes', 'back', 'core'],
    category: 'strength',
    equipment: 'kettlebell', // Now a string
    instructions: // Now a string with newlines
      '1. Stand with feet shoulder-width apart, kettlebell on the floor slightly in front.\n' +
      '2. Hinge at hips, grab kettlebell with both hands.\n' +
      '3. Hike the kettlebell back between legs, then explosively drive hips forward.\n' +
      '4. Swing the kettlebell up to chest height, keeping arms relatively straight.\n' +
      '5. Let the kettlebell swing back down under control, hinging at the hips.',
    // Removed images/videos as they are not in ExerciseData type
  },
  {
    name: 'Push-up', // Consistent with 'Pull-up'
    description: 'A fundamental bodyweight exercise for upper body strength.',
    muscleGroups: ['chest', 'shoulders', 'triceps', 'core'],
    category: 'strength',
    equipment: 'bodyweight', // Now a string
    instructions: // Now a string with newlines
      '1. Start in a high plank position, hands slightly wider than shoulders.\n' +
      '2. Keep body straight from head to heels.\n' +
      '3. Lower chest towards the ground by bending elbows.\n' +
      '4. Push back up to the starting position.',
  },
  {
    name: 'Horse Stance',
    description: 'An isometric stance exercise common in martial arts.',
    muscleGroups: ['quadriceps', 'glutes', 'adductors', 'core'],
    category: 'strength',
    equipment: 'bodyweight', // Now a string
    instructions: // Now a string with newlines
      '1. Stand with feet much wider than shoulder-width, toes pointing slightly outward or forward.\n' +
      '2. Lower hips as if sitting back into a chair, keeping back straight and chest up.\n' +
      '3. Aim for thighs to be parallel to the ground.\n' +
      '4. Hold the position.',
  },
  // Add more exercises here if desired
];

async function seedDatabase() {
  console.log('Connecting to database...');
  await dbConnect(); // Connect first
  console.log('Database connected.');

  let exercisesAdded = 0; // Declare variables
  let exercisesSkipped = 0;

  try { // Start try block AFTER variable declarations and connection
    console.log('Starting seeding process...');
    const exercisesToAdd = [];

    for (const exerciseData of exercisesToSeed) {
      const existingExercise = await ExerciseModel.findOne({ name: exerciseData.name }).lean();
      if (!existingExercise) {
        console.log(`- Preparing to add: ${exerciseData.name}`);
        // Ensure we only pass fields defined in the seed data (Omit _id, createdAt, updatedAt)
        exercisesToAdd.push(exerciseData);
      } else {
        console.log(`- Skipping (already exists): ${exerciseData.name}`);
        exercisesSkipped++;
      }
    }

    if (exercisesToAdd.length > 0) {
      console.log(`Inserting ${exercisesToAdd.length} new exercises...`);
      // Pass the validated array to insertMany
      const result = await ExerciseModel.insertMany(exercisesToAdd);
      exercisesAdded = result.length;
      console.log(`Successfully added ${exercisesAdded} exercises.`);
    } else {
      console.log('No new exercises to add.');
    }

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Now exercisesAdded and exercisesSkipped are in scope
    console.log('Seeding process finished.');
    console.log(`Total added: ${exercisesAdded}`);
    console.log(`Total skipped: ${exercisesSkipped}`);
    process.exit(0);
  }
}

seedDatabase(); 