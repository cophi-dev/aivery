#!/usr/bin/env ts-node
import dbConnect from '../src/lib/db/mongodb.ts';
import ExerciseModel from '../src/lib/db/models/exercise.ts';

// Core essential exercises organized by category
const coreExercises = [
  // === STRENGTH - CHEST ===
  {
    name: 'Bench Press',
    description: 'A compound upper-body exercise where weight is pressed upward while lying on a bench',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    category: 'strength',
    level: 'beginner',
    equipment: ['barbell', 'bench'],
    instructions: [
      'Lie back on a flat bench with feet firmly on the ground',
      'Grip the barbell with hands slightly wider than shoulder-width',
      'Lower the bar to your mid-chest with control',
      'Press the bar back up to the starting position',
      'Keep your core tight and maintain proper form throughout'
    ]
  },
  {
    name: 'Push-Up',
    description: 'A classic bodyweight exercise that targets the upper body',
    muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
    category: 'strength',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Start in a plank position with hands slightly wider than shoulder-width',
      'Keep your body in a straight line from head to heels',
      'Lower your body until your chest nearly touches the floor',
      'Push back up to the starting position',
      'Maintain core engagement throughout the movement'
    ]
  },
  {
    name: 'Dumbbell Press',
    description: 'An upper-body exercise using dumbbells pressed upward while lying on a bench',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    category: 'strength',
    level: 'beginner',
    equipment: ['dumbbells', 'bench'],
    instructions: [
      'Lie on a bench with a dumbbell in each hand',
      'Start with dumbbells at chest level, palms facing forward',
      'Press dumbbells upward until arms are extended',
      'Lower back to starting position with control'
    ]
  },
  {
    name: 'Dips',
    description: 'A bodyweight exercise targeting chest, shoulders, and triceps',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    category: 'strength',
    level: 'intermediate',
    equipment: ['dip bars', 'bodyweight'],
    instructions: [
      'Grip the parallel bars and support your body weight',
      'Lower your body by bending your elbows',
      'Descend until shoulders are below elbows',
      'Push back up to the starting position'
    ]
  },

  // === STRENGTH - BACK ===
  {
    name: 'Deadlift',
    description: 'A compound exercise that targets multiple muscle groups by lifting a loaded barbell off the ground',
    muscleGroups: ['back', 'glutes', 'hamstrings', 'core'],
    category: 'strength',
    level: 'intermediate',
    equipment: ['barbell', 'weight plates'],
    instructions: [
      'Stand with feet hip-width apart, barbell over mid-foot',
      'Bend at hips and knees, grip bar just outside legs',
      'Keep back straight and chest up',
      'Lift bar by straightening hips and knees simultaneously',
      'Return bar to floor with controlled movement'
    ]
  },
  {
    name: 'Pull-Up',
    description: 'An upper body compound pulling exercise performed by hanging from a bar',
    muscleGroups: ['back', 'biceps', 'shoulders'],
    category: 'strength',
    level: 'intermediate',
    equipment: ['pull-up bar', 'bodyweight'],
    instructions: [
      'Grip pull-up bar with hands wider than shoulder-width',
      'Hang with arms fully extended, legs off the ground',
      'Pull your body upward until chin clears the bar',
      'Lower with control to starting position'
    ]
  },
  {
    name: 'Bent Over Row',
    description: 'A compound exercise targeting the back muscles by pulling weight toward the torso',
    muscleGroups: ['back', 'biceps', 'shoulders'],
    category: 'strength',
    level: 'beginner',
    equipment: ['barbell', 'dumbbells'],
    instructions: [
      'Stand with feet shoulder-width apart, knees slightly bent',
      'Bend forward at the hips, keeping back straight',
      'Pull weight toward lower ribcage',
      'Lower with control and repeat'
    ]
  },
  {
    name: 'Lat Pulldown',
    description: 'A machine-based pulling exercise targeting the latissimus dorsi',
    muscleGroups: ['back', 'biceps'],
    category: 'strength',
    level: 'beginner',
    equipment: ['cable machine'],
    instructions: [
      'Sit at the lat pulldown machine with thighs secured',
      'Grip the bar wider than shoulder-width',
      'Pull the bar down to your upper chest',
      'Control the weight back to starting position'
    ]
  },

  // === STRENGTH - LEGS ===
  {
    name: 'Squat',
    description: 'A compound lower body exercise where you lower your body by bending your knees and hips',
    muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'],
    category: 'strength',
    level: 'beginner',
    equipment: ['barbell', 'squat rack'],
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower your body by bending knees and hips, as if sitting in a chair',
      'Keep chest up, back straight, and knees over toes',
      'Descend until thighs are parallel to floor',
      'Return to standing position by pushing through heels'
    ]
  },
  {
    name: 'Lunge',
    description: 'A unilateral lower body exercise that works one leg at a time',
    muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'calves'],
    category: 'strength',
    level: 'beginner',
    equipment: ['bodyweight', 'dumbbells'],
    instructions: [
      'Stand with feet together',
      'Step forward with one leg into a lunge position',
      'Lower your back knee toward the floor',
      'Push through front heel to return to starting position',
      'Repeat on other leg'
    ]
  },
  {
    name: 'Leg Press',
    description: 'A machine-based lower body exercise where weight is pushed away with the legs',
    muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
    category: 'strength',
    level: 'beginner',
    equipment: ['leg press machine'],
    instructions: [
      'Sit on the leg press machine with feet shoulder-width on platform',
      'Release safety catches and lower platform by bending knees',
      'Press weight back up by extending legs (without locking knees)',
      'Control platform back to starting position'
    ]
  },
  {
    name: 'Romanian Deadlift',
    description: 'A hip-hinge movement that primarily targets the hamstrings and glutes',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
    category: 'strength',
    level: 'intermediate',
    equipment: ['barbell', 'dumbbells'],
    instructions: [
      'Stand holding weight with feet hip-width apart',
      'Hinge at the hips, pushing them back',
      'Lower weight while keeping legs relatively straight',
      'Feel stretch in hamstrings, then return to standing'
    ]
  },

  // === STRENGTH - SHOULDERS ===
  {
    name: 'Overhead Press',
    description: 'A compound upper-body exercise where weight is pressed upward from shoulder level',
    muscleGroups: ['shoulders', 'triceps', 'core'],
    category: 'strength',
    level: 'beginner',
    equipment: ['barbell', 'dumbbells'],
    instructions: [
      'Stand with feet shoulder-width apart',
      'Start with weight at shoulder height',
      'Press weight upward until arms are fully extended',
      'Lower with control to starting position'
    ]
  },
  {
    name: 'Lateral Raise',
    description: 'An isolation exercise targeting the middle deltoid muscles',
    muscleGroups: ['shoulders'],
    category: 'strength',
    level: 'beginner',
    equipment: ['dumbbells'],
    instructions: [
      'Stand with feet shoulder-width apart, dumbbells at sides',
      'Raise arms out to sides until parallel to floor',
      'Maintain slight bend in elbows throughout movement',
      'Lower with control and repeat'
    ]
  },

  // === STRENGTH - ARMS ===
  {
    name: 'Bicep Curl',
    description: 'An isolation exercise targeting the biceps muscles',
    muscleGroups: ['biceps'],
    category: 'strength',
    level: 'beginner',
    equipment: ['dumbbells', 'barbell'],
    instructions: [
      'Stand with feet shoulder-width apart, weights in hands',
      'Keep elbows close to sides',
      'Curl weights toward shoulders',
      'Lower with control to starting position'
    ]
  },
  {
    name: 'Tricep Extension',
    description: 'An isolation exercise targeting the triceps muscles',
    muscleGroups: ['triceps'],
    category: 'strength',
    level: 'beginner',
    equipment: ['dumbbells', 'cable machine'],
    instructions: [
      'Stand or sit with weight held overhead',
      'Keep upper arms close to head',
      'Lower weight behind head by bending elbows',
      'Extend arms back up to starting position'
    ]
  },

  // === STRENGTH - CORE ===
  {
    name: 'Plank',
    description: 'An isometric core exercise that promotes stability and strength',
    muscleGroups: ['core', 'shoulders'],
    category: 'strength',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Start in forearm plank position, elbows under shoulders',
      'Keep body in a straight line from head to heels',
      'Engage core and hold position',
      'Maintain normal breathing throughout'
    ]
  },
  {
    name: 'Crunch',
    description: 'A classic abdominal exercise that strengthens core muscles',
    muscleGroups: ['core'],
    category: 'strength',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Lie on back with knees bent, feet flat on floor',
      'Place hands behind head or across chest',
      'Lift shoulders off ground using core muscles',
      'Lower back down with control'
    ]
  },
  {
    name: 'Russian Twist',
    description: 'A rotational exercise targeting the obliques and core muscles',
    muscleGroups: ['core', 'obliques'],
    category: 'strength',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Sit on floor with knees bent, feet elevated slightly',
      'Lean back slightly to engage core',
      'Twist torso to one side, then the other',
      'Keep core engaged throughout the movement'
    ]
  },

  // === CARDIO ===
  {
    name: 'Running',
    description: 'A high-impact cardiovascular exercise that improves endurance',
    muscleGroups: ['legs', 'cardiovascular'],
    category: 'cardio',
    level: 'beginner',
    equipment: ['running shoes'],
    instructions: [
      'Maintain proper posture with slight forward lean',
      'Land midfoot with each step, rolling to forefoot',
      'Keep arms at 90-degree angles, swinging naturally',
      'Breathe regularly and maintain consistent pace'
    ]
  },
  {
    name: 'Cycling',
    description: 'A low-impact cardiovascular exercise performed on a bicycle',
    muscleGroups: ['legs', 'cardiovascular'],
    category: 'cardio',
    level: 'beginner',
    equipment: ['bicycle', 'stationary bike'],
    instructions: [
      'Adjust seat height so legs are nearly straight at bottom of pedal stroke',
      'Maintain neutral spine position',
      'Pedal with smooth, consistent cadence',
      'Use appropriate resistance for your fitness level'
    ]
  },
  {
    name: 'Swimming',
    description: 'A full-body, low-impact cardiovascular exercise',
    muscleGroups: ['full body', 'cardiovascular'],
    category: 'cardio',
    level: 'beginner',
    equipment: ['pool'],
    instructions: [
      'Choose appropriate stroke for your skill level',
      'Focus on smooth, efficient movements',
      'Breathe rhythmically with your stroke pattern',
      'Maintain consistent pace throughout workout'
    ]
  },
  {
    name: 'Jumping Jacks',
    description: 'A full-body cardio exercise that raises heart rate quickly',
    muscleGroups: ['full body', 'cardiovascular'],
    category: 'cardio',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Start standing with feet together and arms at sides',
      'Jump feet out wider than shoulders while raising arms overhead',
      'Jump feet back together while lowering arms',
      'Repeat at a quick, consistent pace'
    ]
  },
  {
    name: 'Burpee',
    description: 'A high-intensity full-body exercise combining squat, plank, and jump',
    muscleGroups: ['full body', 'cardiovascular'],
    category: 'cardio',
    level: 'intermediate',
    equipment: ['bodyweight'],
    instructions: [
      'Start in standing position',
      'Drop into squat and place hands on floor',
      'Jump feet back into plank position',
      'Do a push-up (optional)',
      'Jump feet back to squat, then jump up with arms overhead'
    ]
  },

  // === FLEXIBILITY ===
  {
    name: 'Hamstring Stretch',
    description: 'A stretch targeting the muscles at the back of the thigh',
    muscleGroups: ['hamstrings'],
    category: 'flexibility',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Sit on floor with one leg extended, other leg bent',
      'Reach toward extended foot, keeping back straight',
      'Hold for 20-30 seconds, feeling stretch in hamstring',
      'Repeat on other side'
    ]
  },
  {
    name: 'Quad Stretch',
    description: 'A stretch targeting the muscles at the front of the thigh',
    muscleGroups: ['quadriceps'],
    category: 'flexibility',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Stand on one leg (hold onto something for balance if needed)',
      'Bend the other knee, bringing foot toward buttocks',
      'Hold foot with hand on the same side',
      'Hold for 20-30 seconds, repeat on other side'
    ]
  },
  {
    name: 'Shoulder Stretch',
    description: 'A stretch to improve shoulder flexibility and mobility',
    muscleGroups: ['shoulders'],
    category: 'flexibility',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Bring one arm across your body',
      'Use other arm to gently pull the stretched arm closer',
      'Hold for 20-30 seconds',
      'Repeat on other side'
    ]
  },
  {
    name: 'Child\'s Pose',
    description: 'A relaxing yoga pose that stretches the back and hips',
    muscleGroups: ['back', 'hips'],
    category: 'flexibility',
    level: 'beginner',
    equipment: ['bodyweight'],
    instructions: [
      'Start on hands and knees',
      'Sit back on your heels',
      'Extend arms forward and lower forehead to floor',
      'Hold and breathe deeply'
    ]
  }
];

async function seedCoreExercises() {
  console.log('🏋️  Starting core exercise seeding...');
  
  try {
    // Connect to database
    await dbConnect();
    console.log('✅ Connected to database');

    let added = 0;
    let skipped = 0;
    let updated = 0;

    for (const exercise of coreExercises) {
      try {
        // Check if exercise already exists
        const existingExercise = await ExerciseModel.findOne({ name: exercise.name });
        
        if (existingExercise) {
          console.log(`⏭️  Skipping "${exercise.name}" - already exists`);
          skipped++;
        } else {
          // Create new exercise
          await ExerciseModel.create(exercise);
          console.log(`✅ Added "${exercise.name}"`);
          added++;
        }
      } catch (error) {
        console.error(`❌ Error processing "${exercise.name}":`, error);
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Added: ${added} exercises`);
    console.log(`⏭️  Skipped: ${skipped} exercises (already existed)`);
    console.log(`❌ Updated: ${updated} exercises`);
    console.log('🎉 Core exercise seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the seeding function
seedCoreExercises(); 