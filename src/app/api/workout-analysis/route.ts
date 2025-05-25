import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import WorkoutModel from '@/lib/db/models/workout';
import WorkoutExerciseModel from '@/lib/db/models/workoutExercise';
import ExerciseModel from '@/lib/db/models/exercise';
import ExercisePRModel from '@/lib/db/models/exercisePR';
import { Types } from 'mongoose';

export const dynamic = "force-dynamic";

// Standard muscle group categories for analysis
const MUSCLE_GROUPS = {
  // Upper body - push dominant
  'chest': ['chest', 'pectorals', 'pecs'],
  'shoulders': ['shoulders', 'deltoids', 'delts'],
  'triceps': ['triceps'],
  
  // Upper body - pull dominant
  'back': ['back', 'lats', 'trapezius', 'traps', 'rhomboids'],
  'biceps': ['biceps'],
  'forearms': ['forearms', 'grip'],
  
  // Core
  'core': ['core', 'abs', 'abdominals', 'obliques'],
  
  // Lower body
  'quadriceps': ['quadriceps', 'quads'],
  'hamstrings': ['hamstrings', 'hams'],
  'glutes': ['glutes', 'gluteus maximus'],
  'calves': ['calves', 'gastrocnemius', 'soleus'],
  
  // Other
  'mobility': ['mobility', 'flexibility'],
  'cardiovascular': ['cardiovascular', 'cardio']
};

async function getMuscleGroupStats(userId: string, daysToAnalyze = 30) {
  await dbConnect();
  
  // Calculate date range (last N days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysToAnalyze);
  
  // Get all workouts within date range
  const rawWorkouts = await WorkoutModel.find({
    userId: new Types.ObjectId(userId),
    date: { $gte: startDate }
  }).select('_id date type').lean();
  
  if (!rawWorkouts || rawWorkouts.length === 0) {
    return { error: 'No recent workouts found' };
  }
  
  // Map raw workouts to a properly typed structure
  const workouts = rawWorkouts.map(w => ({
    _id: w._id as Types.ObjectId,
    date: w.date as Date,
    type: w.type as string | undefined
  }));
  
  const workoutIds = workouts.map(w => w._id);
  
  // Define interfaces for type safety
  interface ExerciseInfo {
    _id: Types.ObjectId;
    name: string;
    muscleGroups?: string[];
    secondaryMuscles?: string[];
    category?: string;
  }
  
  interface WorkoutExerciseInfo {
    _id: Types.ObjectId;
    workoutId: Types.ObjectId;
    exerciseId?: ExerciseInfo;
    sets?: any[];
  }
  
  // Get all workout exercises from these workouts
  const rawWorkoutExercises = await WorkoutExerciseModel.find({
    workoutId: { $in: workoutIds }
  }).populate({
    path: 'exerciseId',
    model: ExerciseModel,
    select: 'name muscleGroups secondaryMuscles category'
  }).lean();
  
  // Map to properly typed structure
  const workoutExercises = rawWorkoutExercises.map(we => ({
    _id: we._id as Types.ObjectId,
    workoutId: we.workoutId as Types.ObjectId,
    exerciseId: we.exerciseId as ExerciseInfo | undefined,
    sets: we.sets as any[] | undefined
  })) as WorkoutExerciseInfo[];
  
  // Get all PRs for this user
  const exercisePRs = await ExercisePRModel.find({
    userId: new Types.ObjectId(userId)
  }).lean();
  
  // Process data to get frequency by muscle group
  const muscleFrequency: Record<string, number> = {};
  const exerciseFrequency: Record<string, number> = {};
  const exerciseLastWorked: Record<string, Date> = {};
  const prsByExercise: Record<string, any[]> = {};
  
  // Initialize muscle frequency counters
  Object.keys(MUSCLE_GROUPS).forEach(group => {
    muscleFrequency[group] = 0;
  });
  
  // Track cardio workouts
  const cardioWorkouts = workouts.filter(w => 
    w.type === 'running' || w.type === 'cycling' || w.type === 'swimming' || w.type === 'cardio'
  ).length;
  
  if (cardioWorkouts > 0) {
    muscleFrequency['cardiovascular'] = cardioWorkouts;
  }
  
  // Process workout exercises
  workoutExercises.forEach(we => {
    const exercise = we.exerciseId;
    if (!exercise) return;
    
    const exerciseName = exercise.name;
    
    // Track exercise frequency
    exerciseFrequency[exerciseName] = (exerciseFrequency[exerciseName] || 0) + 1;
    
    // Find matching workout to get date
    const workout = workouts.find(w => w._id.toString() === we.workoutId.toString());
    if (workout?.date) {
      // Track last time this exercise was performed
      const workoutDate = new Date(workout.date);
      if (!exerciseLastWorked[exerciseName] || workoutDate > exerciseLastWorked[exerciseName]) {
        exerciseLastWorked[exerciseName] = workoutDate;
      }
    }
    
    // Process primary muscle groups
    if (exercise.muscleGroups && exercise.muscleGroups.length > 0) {
      exercise.muscleGroups.forEach((muscle: string) => {
        // Map to standardized muscle group
        let matched = false;
        Object.entries(MUSCLE_GROUPS).forEach(([group, synonyms]) => {
          if (synonyms.some(s => muscle.toLowerCase().includes(s.toLowerCase()))) {
            muscleFrequency[group] += 1;
            matched = true;
          }
        });
        
        // If no match found, create a custom category
        if (!matched) {
          const key = muscle.toLowerCase();
          muscleFrequency[key] = (muscleFrequency[key] || 0) + 1;
        }
      });
    }
    
    // Process secondary muscle groups (with less weight)
    if (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0) {
      exercise.secondaryMuscles.forEach((muscle: string) => {
        // Map to standardized muscle group (with 0.5 weight for secondary muscles)
        Object.entries(MUSCLE_GROUPS).forEach(([group, synonyms]) => {
          if (synonyms.some(s => muscle.toLowerCase().includes(s.toLowerCase()))) {
            muscleFrequency[group] += 0.5;
          }
        });
      });
    }
  });
  
  // Process PRs by exercise
  exercisePRs.forEach(pr => {
    const exerciseName = pr.exerciseName;
    if (!prsByExercise[exerciseName]) {
      prsByExercise[exerciseName] = [];
    }
    prsByExercise[exerciseName].push({
      value: pr.value,
      unit: pr.unit,
      type: pr.type,
      date: pr.date
    });
  });
  
  // Calculate which muscle groups are potentially neglected
  const sortedMuscleGroups = Object.entries(muscleFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([group, frequency]) => ({ 
      group, 
      frequency, 
      neglected: frequency < 2 // Consider "neglected" if worked less than 2 times
    }));
  
  // Prepare the response
  return {
    timeframe: {
      days: daysToAnalyze,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      totalWorkouts: workouts.length
    },
    muscleGroups: sortedMuscleGroups,
    exercises: Object.entries(exerciseFrequency).map(([name, frequency]) => ({
      name,
      frequency,
      lastWorked: exerciseLastWorked[name]?.toISOString() || null,
      prs: prsByExercise[name] || []
    })),
    neglectedMuscleGroups: sortedMuscleGroups
      .filter(mg => mg.neglected)
      .map(mg => mg.group),
    mostWorked: sortedMuscleGroups
      .filter(mg => !mg.neglected)
      .slice(0, 3)
      .map(mg => mg.group)
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get days parameter from URL, default to 30 if not provided
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    
    const analysis = await getMuscleGroupStats(userId, days);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing workouts:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze workouts', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 