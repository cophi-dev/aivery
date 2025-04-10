// Simple repair script with direct MongoDB connection
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable not found in .env file");
  process.exit(1);
}

// Define Schemas
const workoutSchema = new mongoose.Schema({
  userId: String,
  name: String,
  date: Date,
  type: String,
  exercises: Array, // Old field that contained embedded exercises
  duration: Number,
  distance: Number,
  cardioDetails: Object,
  createdAt: Date,
  updatedAt: Date
});

const exerciseSchema = new mongoose.Schema({
  name: String,
  category: String,
  createdAt: Date,
  updatedAt: Date
});

const workoutExerciseSchema = new mongoose.Schema({
  userId: String,
  workoutId: mongoose.Schema.Types.ObjectId,
  exerciseId: mongoose.Schema.Types.ObjectId,
  sets: Array,
  order: Number,
  notes: String,
  duration: Number,
  distance: Number,
  createdAt: Date,
  updatedAt: Date
});

// Create models
const WorkoutModel = mongoose.model('Workout', workoutSchema);
const ExerciseModel = mongoose.model('Exercise', exerciseSchema);
const WorkoutExerciseModel = mongoose.model('WorkoutExercise', workoutExerciseSchema);

async function repairWorkoutExercises() {
  try {
    console.log("Starting workout exercise repair process...");
    
    // Connect to database
    console.log("Connecting to MongoDB:", MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");
    
    // Get all workouts
    const workouts = await WorkoutModel.find({});
    console.log(`Found ${workouts.length} total workouts to check`);
    
    let repaired = 0;
    let skipped = 0;
    
    for (const workout of workouts) {
      try {
        // Check if workout already has workout exercises
        const existingExercises = await WorkoutExerciseModel.countDocuments({ workoutId: workout._id });
        
        if (existingExercises > 0) {
          console.log(`Workout ${workout._id} already has ${existingExercises} workout exercises. Skipping.`);
          skipped++;
          continue;
        }
        
        console.log(`Processing workout ${workout._id} (${workout.type}) from ${workout.date}`);
        
        // Process based on workout type
        if (workout.type === 'strength' || workout.type === 'gym' || workout.type === 'home_strength') {
          // Look for embedded exercises array from old schema
          const oldExercises = workout.exercises || [];
          console.log(`Workout ${workout._id} has ${oldExercises.length} old exercises to migrate`);
          
          if (oldExercises.length === 0) {
            console.log(`No exercises found for strength workout ${workout._id}. Creating placeholder.`);
            // Create a generic "Strength Training" exercise if no specific ones exist
            let exercise = await ExerciseModel.findOne({ name: "Strength Training" });
            if (!exercise) {
              exercise = await ExerciseModel.create({
                name: "Strength Training",
                category: 'strength',
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log(`Created new generic strength exercise`);
            }
            
            await WorkoutExerciseModel.create({
              userId: workout.userId,
              workoutId: workout._id,
              exerciseId: exercise._id,
              sets: [],
              order: 0,
              createdAt: workout.createdAt,
              updatedAt: workout.updatedAt
            });
            console.log(`Created generic workout exercise for strength workout ${workout._id}`);
            repaired++;
            continue;
          }
          
          for (let i = 0; i < oldExercises.length; i++) {
            const oldEx = oldExercises[i];
            
            // Find or create canonical exercise
            let exerciseId;
            if (oldEx.exerciseId) {
              exerciseId = oldEx.exerciseId;
            } else if (oldEx.name) {
              // Try to find by name
              let exercise = await ExerciseModel.findOne({ name: oldEx.name });
              if (!exercise) {
                // Create new canonical exercise if needed
                exercise = await ExerciseModel.create({
                  name: oldEx.name,
                  category: 'strength',
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
                console.log(`Created new canonical exercise: ${oldEx.name}`);
              }
              exerciseId = exercise._id;
            } else {
              console.log(`Skipping exercise with no name or ID in workout ${workout._id}`);
              continue;
            }
            
            // Create workout exercise
            await WorkoutExerciseModel.create({
              userId: workout.userId,
              workoutId: workout._id,
              exerciseId: exerciseId,
              sets: oldEx.sets || [],
              order: i,
              notes: oldEx.notes,
              createdAt: workout.createdAt || new Date(),
              updatedAt: workout.updatedAt || new Date()
            });
            console.log(`Created workout exercise for ${oldEx.name || 'unnamed'} in workout ${workout._id}`);
          }
          repaired++;
          
        } else if (['run', 'running', 'cycling', 'swim', 'swimming', 'walk', 'walking', 'hike'].includes(workout.type)) {
          // Create cardio workout exercise
          // First, find a matching exercise (e.g., "Running", "Cycling")
          const exerciseType = workout.type.replace('running', 'run').replace('cycling', 'cycle');
          const capitalizedType = exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1);
          const alternativeType = capitalizedType + (capitalizedType.endsWith('e') ? '' : 'ing');
          
          // Try to find by various name formats
          let exercise = await ExerciseModel.findOne({ 
            $or: [
              { name: capitalizedType },
              { name: alternativeType },
              { name: capitalizedType.toLowerCase() },
              { name: alternativeType.toLowerCase() }
            ]
          });
          
          if (!exercise) {
            // Create if not found
            exercise = await ExerciseModel.create({
              name: alternativeType, // Use the -ing form by default
              category: 'cardio',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            console.log(`Created new cardio exercise: ${alternativeType}`);
          }
          
          // Create workout exercise for cardio
          await WorkoutExerciseModel.create({
            userId: workout.userId,
            workoutId: workout._id,
            exerciseId: exercise._id,
            duration: workout.duration || 0,
            distance: workout.distance || (workout.cardioDetails?.distance) || 0,
            order: 0,
            sets: [],
            createdAt: workout.createdAt || new Date(),
            updatedAt: workout.updatedAt || new Date()
          });
          console.log(`Created workout exercise for ${exercise.name} in workout ${workout._id}`);
          repaired++;
        } else {
          console.log(`Skipping workout ${workout._id} with unrecognized type: ${workout.type}`);
          skipped++;
        }
      } catch (err) {
        console.error(`Error processing workout ${workout._id}:`, err);
        skipped++;
      }
    }
    
    console.log(`\nRepair complete. ${repaired} workouts repaired. ${skipped} workouts skipped.`);
    
  } catch (error) {
    console.error("Error in repair script:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  }
}

// Run the function
repairWorkoutExercises()
  .then(() => {
    console.log("Finished repair script!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error in repair script:", err);
    process.exit(1);
  }); 