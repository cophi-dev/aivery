import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs'; // Changed from bcrypt to bcryptjs
import { subMonths, eachWeekOfInterval, startOfWeek, endOfWeek, addDays, formatISO } from 'date-fns'; // Date utility functions
import mongoose from 'mongoose'; // <-- Import Mongoose
import WorkoutExerciseModel from '../src/lib/db/models/workoutExercise'; // <-- Import Mongoose model
import connectDB from '../src/lib/db/mongoose'; // <-- Import DB connection function

const prisma = new PrismaClient();

// Helper to get random integer
function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to simulate slight progress over time (0-1, where 1 is latest date)
function getProgressFactor(currentDate: Date, startDate: Date, endDate: Date): number {
    const totalDuration = endDate.getTime() - startDate.getTime();
    if (totalDuration <= 0) return 0.5; // Avoid division by zero, return neutral factor
    const elapsedDuration = currentDate.getTime() - startDate.getTime();
    return Math.max(0, Math.min(1, elapsedDuration / totalDuration)); // Clamp between 0 and 1
}

async function main() {
  console.log(`Start seeding ...`);

  // Connect Mongoose
  console.log('[SEED] Connecting Mongoose...');
  await connectDB();
  console.log('[SEED] Mongoose connected.');

  // --- !! CLEAR ALL DATA FIRST !! ---
  console.log('[SEED] Clearing ALL previous data via Prisma...');
  console.log('[SEED] Clearing WorkoutExercise records...');
  await prisma.workoutExercise.deleteMany({});
  console.log('[SEED] Clearing Workout records...');
  await prisma.workout.deleteMany({});
  console.log('[SEED] Clearing UserPreferences records...');
  await prisma.userPreferences.deleteMany({});
  console.log('[SEED] Clearing User records...');
  await prisma.user.deleteMany({});
  console.log('[SEED] Clearing Exercise records...');
  await prisma.exercise.deleteMany({});
  console.log('[SEED] Finished clearing data.');
  // --- END CLEAR --- 

  // --- Seed Exercises --- 
  console.log('Seeding exercises via Prisma...');
  const gymExercisesData: Prisma.ExerciseCreateManyInput[] = [
    { name: 'Bench Press', category: 'strength', muscleGroups: ['chest', 'shoulders', 'triceps'], equipment: ['barbell', 'bench'] },
    { name: 'Squat', category: 'strength', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], equipment: ['barbell', 'rack'] },
    { name: 'Deadlift', category: 'strength', muscleGroups: ['back', 'glutes', 'hamstrings', 'quadriceps'], equipment: ['barbell'] },
    { name: 'Overhead Press', category: 'strength', muscleGroups: ['shoulders', 'triceps'], equipment: ['barbell'] },
    { name: 'Barbell Row', category: 'strength', muscleGroups: ['back', 'biceps'], equipment: ['barbell'] },
    { name: 'Lat Pulldown', category: 'strength', muscleGroups: ['back', 'biceps'], equipment: ['cable machine'] },
    { name: 'Dumbbell Bench Press', category: 'strength', muscleGroups: ['chest', 'shoulders', 'triceps'], equipment: ['dumbbell', 'bench'] },
    { name: 'Dumbbell Row', category: 'strength', muscleGroups: ['back', 'biceps'], equipment: ['dumbbell', 'bench'] },
    { name: 'Leg Press', category: 'strength', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], equipment: ['leg press machine'] },
    { name: 'Bicep Curl', category: 'strength', muscleGroups: ['biceps'], equipment: ['dumbbell', 'barbell', 'cable machine'] },
    { name: 'Triceps Extension', category: 'strength', muscleGroups: ['triceps'], equipment: ['dumbbell', 'cable machine'] },
  ];
  await prisma.exercise.createMany({ data: gymExercisesData });

  // Strength - Bodyweight
  const bodyweightExercisesData: Prisma.ExerciseCreateManyInput[] = [
    { name: 'Push-up', category: 'strength', muscleGroups: ['chest', 'shoulders', 'triceps'], equipment: ['bodyweight'] },
    { name: 'Air Squat', category: 'strength', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], equipment: ['bodyweight'] },
    { name: 'Pull-up', category: 'strength', muscleGroups: ['back', 'biceps'], equipment: ['pull-up bar', 'bodyweight'] },
    { name: 'Chin-up', category: 'strength', muscleGroups: ['back', 'biceps'], equipment: ['pull-up bar', 'bodyweight'] },
    { name: 'Lunge', category: 'strength', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], equipment: ['bodyweight'] },
    { name: 'Plank', category: 'strength', muscleGroups: ['core'], equipment: ['bodyweight'] },
    { name: 'Burpee', category: 'strength', muscleGroups: ['full body'], equipment: ['bodyweight'] },
    { name: 'Sit-up', category: 'strength', muscleGroups: ['core'], equipment: ['bodyweight'] },
    { name: 'Dip', category: 'strength', muscleGroups: ['chest', 'shoulders', 'triceps'], equipment: ['dip station', 'bench', 'bodyweight'] },
  ];
  await prisma.exercise.createMany({ data: bodyweightExercisesData });

  // Cardio
  const cardioExercisesData: Prisma.ExerciseCreateManyInput[] = [
    { name: 'Running', category: 'cardio', muscleGroups: ['legs', 'cardiovascular'], equipment: [] },
    { name: 'Cycling', category: 'cardio', muscleGroups: ['legs', 'cardiovascular'], equipment: ['bicycle', 'stationary bike'] },
    { name: 'Swimming', category: 'cardio', muscleGroups: ['full body', 'cardiovascular'], equipment: ['pool'] },
    { name: 'Rowing', category: 'cardio', muscleGroups: ['back', 'legs', 'core', 'cardiovascular'], equipment: ['rowing machine'] },
    { name: 'Elliptical', category: 'cardio', muscleGroups: ['legs', 'glutes', 'cardiovascular'], equipment: ['elliptical machine'] },
    { name: 'Jumping Jacks', category: 'cardio', muscleGroups: ['full body', 'cardiovascular'], equipment: ['bodyweight'] },
    { name: 'Stair Climbing', category: 'cardio', muscleGroups: ['legs', 'glutes', 'cardiovascular'], equipment: ['stairs', 'stair climber machine'] },
    { name: 'Hiking', category: 'cardio', muscleGroups: ['legs', 'glutes', 'core', 'cardiovascular'], equipment: [] },
  ];
  await prisma.exercise.createMany({ data: cardioExercisesData });
  console.log('Finished seeding exercises.');

  // --- Seed Demo User --- 
  console.log('Creating/finding demo user via Prisma...');
  const demoEmail = 'demo@example.com';
  const demoPasswordHash = await hash('password123', 10); 

  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {}, // No updates needed if user exists
    create: {
      email: demoEmail,
      name: 'Demo User',
      password: demoPasswordHash, 
    },
  });
  console.log(`Upserted demo user: ${demoUser.email} (ID: ${demoUser.id})`);

  // --- Clear Existing Demo Workouts (Prisma) ---
  console.log(`Clearing existing workouts for demo user ${demoUser.id} via Prisma...`);
  const existingWorkouts = await prisma.workout.findMany({ where: { userId: demoUser.id }, select: { id: true } });
  const existingWorkoutIds = existingWorkouts.map(w => w.id);

  if (existingWorkoutIds.length > 0) {
    console.log(`Found ${existingWorkoutIds.length} existing workouts to clear.`);
    const existingWorkoutExercises = await prisma.workoutExercise.findMany({
      where: { workoutId: { in: existingWorkoutIds } },
      select: { id: true }
    });
    const existingWorkoutExerciseIds = existingWorkoutExercises.map(we => we.id);

    const deletedWorkoutExercises = await prisma.workoutExercise.deleteMany({ where: { workoutId: { in: existingWorkoutIds } } });
    console.log(`Deleted ${deletedWorkoutExercises.count} associated workout exercises.`);

    const deletedWorkouts = await prisma.workout.deleteMany({ where: { userId: demoUser.id } });
    console.log(`Deleted ${deletedWorkouts.count} demo user workouts.`);
  } else {
      console.log('No existing workouts found for demo user.');
  }

  // --- Seed Historical Workouts ---
  console.log('Seeding historical workouts for demo user...');

  // Fetch exercise IDs needed for workout generation
  const exercises = {
    run: await prisma.exercise.findUnique({ where: { name: 'Running' } }),
    cycle: await prisma.exercise.findUnique({ where: { name: 'Cycling' } }),
    bench: await prisma.exercise.findUnique({ where: { name: 'Bench Press' } }),
    squat: await prisma.exercise.findUnique({ where: { name: 'Squat' } }),
    deadlift: await prisma.exercise.findUnique({ where: { name: 'Deadlift' } }),
    pushup: await prisma.exercise.findUnique({ where: { name: 'Push-up' } }),
    pullup: await prisma.exercise.findUnique({ where: { name: 'Pull-up' } }),
    row: await prisma.exercise.findUnique({ where: { name: 'Barbell Row' } }),
    plank: await prisma.exercise.findUnique({ where: { name: 'Plank' } }),
  };

  // Ensure all required exercises were found
  const requiredExercises = Object.values(exercises);
  if (requiredExercises.some(ex => !ex)) {
    console.error('Could not find all required exercises for seeding workouts. Aborting.');
    // Log which ones are missing
    Object.entries(exercises).forEach(([key, value]) => {
        if (!value) console.error(`Missing exercise: ${key}`);
    });
    process.exit(1); // Exit if essential exercises aren't found
  }

  const endDate = new Date();
  const startDate = subMonths(endDate, 6);
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
  console.log(`DEBUG: Processing ${weeks.length} weeks`); // DEBUG Log

  let workoutCount = 0;

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart);
    const numWorkoutsThisWeek = getRandomInt(2, 4); // 2-4 workouts per week

    for (let i = 0; i < numWorkoutsThisWeek; i++) {
      const workoutDate = addDays(weekStart, getRandomInt(0, 6)); // Random day within the week
      if (workoutDate > endDate) continue; // Don't create future workouts

      const progress = getProgressFactor(workoutDate, startDate, endDate);
      const workoutType = Math.random() > 0.4 ? 'strength' : 'cardio'; // ~60% strength, 40% cardio

      workoutCount++; // Increment counter early for naming/notes

      let createdWorkout: Awaited<ReturnType<typeof prisma.workout.create>>;

      if (workoutType === 'strength') {
          const duration = getRandomInt(2700, 4500); // 45-75 mins
          const calories = Math.round(duration / 60 * 8 + (progress * 50)); // Base calories + progress bonus
          const intensity = ['Medium', 'High'][getRandomInt(0, 1)] as 'Medium' | 'High'; // Correctly typed intensity
          
          // Select exercises for this workout
          const selectedExercises = [exercises.squat!, exercises.bench!, exercises.deadlift!, exercises.pullup!, exercises.row!].sort(() => 0.5 - Math.random()).slice(0, getRandomInt(3, 4)); // Pick 3-4 exercises

          // 1. Create the Workout record (Prisma)
          createdWorkout = await prisma.workout.create({
              data: {
                  userId: demoUser.id,
                  name: `Strength Training ${formatISO(workoutDate, { representation: 'date' })}`,
                  date: workoutDate,
                  type: 'strength',
                  duration: duration,
                  intensity: intensity,
                  notes: `Session ${workoutCount}. Intensity: ${intensity}. Progress factor: ${progress.toFixed(2)}`,
                  calories: calories,
              }
          });
          console.log(`Created workout ${createdWorkout.id} (${createdWorkout.name}) via Prisma`);

          // 2. Create WorkoutExercises and embedded Sets (MONGOOSE)
          for (let index = 0; index < selectedExercises.length; index++) {
              const ex = selectedExercises[index];
              
              // Calculate sets data first
              const setsToEmbed = []; // Define type based on Mongoose schema if needed
              const numSets = 3;
              for (let s = 0; s < numSets; s++) {
                  let baseWeight = 0;
                  let baseReps = 0;
                  if (ex.name === 'Squat') { baseWeight = 50 + (40 * progress); baseReps = 5 + (3 * progress); }
                  else if (ex.name === 'Bench Press') { baseWeight = 40 + (30 * progress); baseReps = 6 + (4 * progress); }
                  else if (ex.name === 'Deadlift') { baseWeight = 60 + (50 * progress); baseReps = 3 + (2 * progress); }
                  else if (ex.name === 'Pull-up') { baseWeight = 0; baseReps = 3 + (5 * progress); } // Bodyweight
                  else if (ex.name === 'Barbell Row') { baseWeight = 30 + (20 * progress); baseReps = 8 + (4 * progress); }
                  else { baseWeight = 20 + (10*progress); baseReps = 10 + (2*progress); } // Default fallback

                  const weight = Math.max(0, Math.round(baseWeight + getRandomInt(-5, 5) / 2) * 2.5); 
                  const reps = Math.max(1, Math.round(baseReps + getRandomInt(-1, 1)));

                  setsToEmbed.push({ 
                      order: s, 
                      weight: weight > 0 ? weight : undefined, 
                      reps: reps 
                  });
              }
              
              // Create WorkoutExercise WITH embedded sets using MONGOOSE
              const createdWorkoutExercise = await WorkoutExerciseModel.create({
                  // Use Mongoose ObjectId for user ID
                  userId: new mongoose.Types.ObjectId(demoUser.id), 
                  // Prisma returns string ID, convert if necessary or ensure compatibility
                  // Mongoose schema expects ObjectId, Prisma ID is string. Convert.
                  workoutId: new mongoose.Types.ObjectId(createdWorkout.id), 
                  exerciseId: new mongoose.Types.ObjectId(ex.id),
                  order: index,
                  sets: setsToEmbed // Directly embed the array
              });
              console.log(`  Created WorkoutExercise ${createdWorkoutExercise._id} for ${ex.name} with ${setsToEmbed.length} embedded sets via Mongoose`);
          }

      } else { // Cardio
          const isRun = Math.random() > 0.5;
          const duration = getRandomInt(1200, 3600); // 20-60 mins
          const baseDistance = isRun ? (3000 + 5000 * progress) : (10000 + 15000 * progress); // Meters
          const distance = Math.round(baseDistance + getRandomInt(-500, 500));
          const calories = Math.round(duration / 60 * 10 - (progress * 50));
          const intensity = ['Low', 'Medium', 'High'][getRandomInt(0, 2)] as 'Low' | 'Medium' | 'High';
          const avgPace = distance > 0 ? (duration / 60) / (distance / 1000) : undefined; // min/km

          // 1. Create the Workout Record (Prisma)
          createdWorkout = await prisma.workout.create({
              data: {
                  userId: demoUser.id,
                  name: isRun ? `Cardio Run ${formatISO(workoutDate, { representation: 'date' })}` : `Cardio Cycle ${formatISO(workoutDate, { representation: 'date' })}`,
                  date: workoutDate,
                  type: isRun ? 'running' : 'cycling', // Use Prisma enum values
                  duration: duration,
                  intensity: intensity,
                  distance: distance, // Save top-level distance
                  notes: `Cardio session ${workoutCount}. Type: ${isRun ? 'Run' : 'Cycle'}.`,
                  calories: calories,
                  cardioDetails: { // Use nested create for CardioDetails
                      create: {
                          distance: distance, 
                          duration: duration, 
                          pace: avgPace ? parseFloat(avgPace.toFixed(2)) : undefined, // Ensure pace is number or undefined
                          heartRate: { // Use nested create for HeartRate
                              create: { 
                                  average: Math.round(140 + (30 * progress) + getRandomInt(-5, 5)) // Ensure integer
                              } 
                          } 
                      }
                  }
              }
          });
           console.log(`Created workout ${createdWorkout.id} (${createdWorkout.name}) via Prisma`);

          // 2. Create the WorkoutExercise record (can still use Prisma, no sets)
          const exerciseForCardio = isRun ? exercises.run! : exercises.cycle!;
          const createdWorkoutExercise = await prisma.workoutExercise.create({
              data: {
                  workoutId: createdWorkout.id,
                  exerciseId: exerciseForCardio.id,
              }
          });
          console.log(`  Created WorkoutExercise ${createdWorkoutExercise.id} for ${exerciseForCardio.name} via Prisma`);
      }
    }
  }

  console.log(`Seeded ${workoutCount} historical workouts.`);

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect(); // <-- Disconnect Mongoose
    console.log('[SEED] Disconnected Prisma and Mongoose.');
  }); 