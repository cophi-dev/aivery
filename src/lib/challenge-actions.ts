"use server";

import { revalidatePath } from 'next/cache';
import { PrismaClient, ChallengeStatus, ChallengeType, ChallengeMetric } from '@prisma/client';
import type { Challenge } from '@prisma/client';
import { Types, Document } from 'mongoose';
import UserModel from '@/lib/db/models/user';
import ExercisePRModel, { IExercisePR } from '@/lib/db/models/exercisePR';
import type { IUser } from '@/lib/db/models/user';
import { getCurrentUser } from '@/lib/auth'; // Assuming this helper exists
import WorkoutModel from '@/lib/db/models/workout';
import WorkoutExerciseModel from '@/lib/db/models/workoutExercise';
import dbConnect from '@/lib/db/mongodb'; // Ensure this path is correct

const prisma = new PrismaClient();

// Helper function to shuffle an array in place (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Define a type for the plain object returned by lean() for ExercisePR
type LeanExercisePR = Omit<IExercisePR, keyof Document | '__v'> & { 
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  value: number;
  unit: string;
  exerciseName: string;
  date: Date;
  workoutId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

// --- Challenge Generation Logic (Helper for getChallengesForUser) ---
async function generateAndSaveChallenges(userId: string, currentYear: number, currentMonth: number): Promise<Challenge[]> {
    console.log(`[Challenge Action Gen] Generating challenges for ${userId} for ${currentYear}-${currentMonth}`);
    const userObjectId = new Types.ObjectId(userId);

    // --- Fetch Data (User, PRs, Recent History) --- 
    const userDoc = await UserModel.findById(userObjectId).select('personalRecords weight').lean<IUser>();
    const overallPRs = userDoc?.personalRecords || {};
    const userWeight = (typeof userDoc?.weight === 'number' && userDoc.weight > 0) ? userDoc.weight : null;
    const rawExercisePRs = await ExercisePRModel.find({ userId: userObjectId }).lean();
    const exercisePRs: LeanExercisePR[] = rawExercisePRs.map(pr => ({
        _id: pr._id as Types.ObjectId, userId: pr.userId as Types.ObjectId,
        exerciseId: pr.exerciseId as Types.ObjectId, exerciseName: pr.exerciseName as string,
        value: pr.value as number, unit: pr.unit as string, date: pr.date as Date,
        workoutId: pr.workoutId as Types.ObjectId | undefined, createdAt: pr.createdAt as Date,
        updatedAt: pr.updatedAt as Date,
    }));
    const exercisePRMap = exercisePRs.reduce((map, pr) => {
        map[`${pr.exerciseId.toString()}_${pr.unit}`] = pr; 
        return map;
      }, {} as Record<string, LeanExercisePR>);

    // Fetch 90-day history for PR goals (using Prisma)
    const historyCutoff = new Date();
    historyCutoff.setDate(new Date().getDate() - 90);
    const recentWorkoutsPrisma = await prisma.workout.findMany({
      where: { userId: userId, date: { gte: historyCutoff } },
      select: { date: true, type: true, distance: true, duration: true,
        exercises: { select: { exercise: { select: { name: true, category: true } } } }
      }
    });

    // --- <<< NEW: Fetch ALL workouts THIS MONTH for initial values >>> ---
    console.log(`[Challenge Action Gen] Fetching existing workouts for ${currentYear}-${currentMonth}...`);
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    let initialMonthlyDistanceKm = 0;
    let initialMonthlyVolumeKg = 0;
    let initialMonthlySessions = 0;
    const initialMonthlyDays = new Set<string>();
    const initialExerciseIds = new Set<string>();

    try {
        await dbConnect(); // Ensure Mongoose connection
        const workoutsThisMonth = await WorkoutModel.find({
            userId: userObjectId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        })
        .select('_id date type distance calculatedVolume') // Select needed fields, remove workoutExercises
        .lean();

        console.log(`[Challenge Action Gen] Found ${workoutsThisMonth.length} workouts this month.`);

        // --- <<< NEW: Fetch WorkoutExercises separately >>> ---
        if (workoutsThisMonth.length > 0) {
          const workoutIds = workoutsThisMonth.map(w => w._id);
          const workoutExercisesThisMonth = await WorkoutExerciseModel.find({
              workoutId: { $in: workoutIds },
              // Optional: Add date filter here too if WorkoutExercise has date and it's indexed
              // date: { $gte: startOfMonth, $lte: endOfMonth }
          }).select('exerciseId').lean();

          workoutExercisesThisMonth.forEach((ex: any) => {
              if (ex.exerciseId) {
                  initialExerciseIds.add(ex.exerciseId.toString());
              }
          });
          console.log(`[Challenge Action Gen] Found ${workoutExercisesThisMonth.length} workout exercises across these workouts.`);
        }
        // --- <<< END NEW: Fetch WorkoutExercises separately >>> ---

        initialMonthlySessions = workoutsThisMonth.length;

        workoutsThisMonth.forEach((workout: any) => {
            initialMonthlyDays.add(new Date(workout.date).toISOString().split('T')[0]);
            if ((workout.type === 'running' || workout.type === 'run') && workout.distance) {
                initialMonthlyDistanceKm += (workout.distance / 1000); // Convert meters to KM
            }
            if (workout.type === 'strength' && workout.calculatedVolume) {
                initialMonthlyVolumeKg += workout.calculatedVolume;
            }
        });

        console.log(`[Challenge Action Gen] Initial values: Sessions=${initialMonthlySessions}, Days=${initialMonthlyDays.size}, Distance=${initialMonthlyDistanceKm.toFixed(1)}km, Volume=${initialMonthlyVolumeKg}kg, Variety=${initialExerciseIds.size}`);

    } catch (err) {
        console.error("[Challenge Action Gen] Error fetching workouts this month:", err);
        // Proceed with 0 initial values if fetch fails
    }
    // --- <<< END NEW: Fetch workouts THIS MONTH >>> ---
    
    // --- Generate Challenge Data --- 
    const generatedChallengesData: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>[] = [];
    const generatedTypes = new Set<ChallengeType>();
    const addChallenge = (data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>) => {
        if (!generatedTypes.has(data.type) && generatedChallengesData.length < 12) {
            generatedChallengesData.push(data); 
            generatedTypes.add(data.type);
        }
    };
    // [ ... PASTE ALL CHALLENGE GENERATION BLOCKS (Strength, BW, Run, Pace, Monthly, etc.) HERE ... ]
     // --- Strength PRs ---
    const prExercises = ['Bench Press', 'Squat', 'Deadlift'];
    shuffle(prExercises);
    for (const exName of prExercises) {
      try {
        if (generatedTypes.has(ChallengeType.StrengthPR)) break; 
        const exercise = await prisma.exercise.findUnique({ where: { name: exName } });
        if (exercise) { 
          const pr = exercisePRMap[`${exercise.id}_kg`];
          const currentPRValue = pr?.value ?? 0;
          const goalValue = Math.max(currentPRValue + 2.5, Math.round((currentPRValue * 1.025) / 2.5) * 2.5);
          if (goalValue > currentPRValue) {
            addChallenge({
              userId: userId, type: ChallengeType.StrengthPR, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Weight, unit: 'kg', title: `New ${exName} PR`,
              description: `Lift ${goalValue}kg in ${exName}. Your best is ${currentPRValue}kg.`,
              goalValue: goalValue, startValue: currentPRValue, currentValue: currentPRValue,
              month: currentMonth, year: currentYear, exerciseId: exercise.id,
              completedAt: null, relatedWorkoutId: null,
            });
          }
        }
      } catch (e) { console.error(`[Challenge Action Gen] Error generating ${exName} challenge:`, e); }
    }
    // --- Bodyweight Reps ---
    const bwExercises = ['Pull-up', 'Push-up'];
    shuffle(bwExercises); 
     for (const exName of bwExercises) {
       try {
          if (generatedTypes.has(ChallengeType.BodyweightReps)) break;
          const exercise = await prisma.exercise.findUnique({ where: { name: exName } });
          if (exercise) {
              const pr = exercisePRMap[`${exercise.id}_reps`];
              const currentPRValue = pr?.value ?? 0;
              const goalValue = currentPRValue + (currentPRValue > 5 ? 2 : 1); 
              addChallenge({
                  userId: userId, type: ChallengeType.BodyweightReps, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Reps, unit: 'reps', title: `Achieve ${goalValue} ${exName}s`,
                  description: `Complete ${goalValue} consecutive ${exName}s. Your best is ${currentPRValue}.`,
                  goalValue: goalValue, startValue: currentPRValue, currentValue: currentPRValue,
                  month: currentMonth, year: currentYear, exerciseId: exercise.id,
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch(e) { console.error(`[Challenge Action Gen] Error generating ${exName} challenge:`, e); }
     }
      // --- Longest Run ---
      try {
          const currentLongestRun = (typeof overallPRs.longestRun?.value === 'number') ? overallPRs.longestRun.value : 0; 
          const goalLongestRun = Math.round(currentLongestRun * 1.05 * 10) / 10; 
          if (goalLongestRun > currentLongestRun && goalLongestRun >= 1) { 
              addChallenge({
                  userId: userId, type: ChallengeType.LongestSession, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalLongestRun}km`,
                  description: `Complete a single run of ${goalLongestRun}km. Your longest is ${currentLongestRun}km.`,
                  goalValue: goalLongestRun, startValue: currentLongestRun, currentValue: 0, 
                  month: currentMonth, year: currentYear, exerciseId: null, 
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch (e) { console.error("[Challenge Action Gen] Error generating Longest Run challenge:", e); }
       // --- Fastest 5k Pace --- 
       try {
          const currentFastestPace = (typeof overallPRs.fastest5kPace?.value === 'number' && overallPRs.fastest5kPace.value !== Infinity) ? overallPRs.fastest5kPace.value : null; 
          if (currentFastestPace) {
              const goalPace = currentFastestPace * 0.98; 
              const formatPace = (paceSm: number): string => {
                  const paceMinKm = (paceSm * 1000) / 60;
                  const minutes = Math.floor(paceMinKm);
                  const seconds = Math.round((paceMinKm - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
              };
               addChallenge({
                  userId: userId, type: ChallengeType.DistancePace, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Pace, unit: 's/m', title: `Faster 5k Pace`,
                  description: `Beat your 5k pace PR of ${formatPace(currentFastestPace)}. Target: ${formatPace(goalPace)}.`, 
                  goalValue: goalPace, 
                  startValue: currentFastestPace, currentValue: currentFastestPace, 
                  month: currentMonth, year: currentYear, exerciseId: null, 
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch (e) { console.error("[Challenge Action Gen] Error generating Fastest Pace challenge:", e); }
      // --- Monthly Running Distance ---
      try {
          const runningWorkouts = recentWorkoutsPrisma.filter(w => w.type?.toLowerCase() === 'running' || w.type?.toLowerCase() === 'run');
          const distancesMeters = runningWorkouts.map(w => w.distance ?? 0); 
          const totalDistanceMetersLast90d = distancesMeters.reduce((sum, dist) => sum + dist, 0);
          const avgMonthlyDistanceMeters = totalDistanceMetersLast90d / 3;
          const goalMonthlyDistanceMeters = Math.max(5000, Math.round((avgMonthlyDistanceMeters * 1.1) / 1000) * 1000); 
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyDistance, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalMonthlyDistanceMeters / 1000}km This Month`,
              description: `Accumulate ${goalMonthlyDistanceMeters / 1000}km of running distance in ${new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })}.`,
              goalValue: goalMonthlyDistanceMeters / 1000, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlyDistanceKm, 
              currentValue: initialMonthlyDistanceKm, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Monthly Distance challenge:", e); }
      // --- Monthly Volume ---
      try {
          // TODO: Calculate recent average monthly strength volume for a better goal?
          const goalMonthlyVolume = 10000; // Example: Target 10,000kg volume
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyVolume, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Volume, unit: 'kg', title: `Lift ${goalMonthlyVolume}kg Total Volume`,
              description: `Accumulate ${goalMonthlyVolume}kg of total lifting volume this month.`,
              goalValue: goalMonthlyVolume, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlyVolumeKg, 
              currentValue: initialMonthlyVolumeKg, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Monthly Volume challenge:", e); }
      // --- Workout Frequency ---
      try {
          const uniqueWorkoutDaysLast90d = new Set(recentWorkoutsPrisma.map(w => w.date.toISOString().split('T')[0])).size;
          const avgMonthlyFrequency = Math.max(4, Math.round(uniqueWorkoutDaysLast90d / 3)); 
          const goalFrequency = Math.min(20, avgMonthlyFrequency + 2); 
          addChallenge({
              userId: userId, type: ChallengeType.WorkoutFrequency, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Sessions, unit: 'sessions', title: `Complete ${goalFrequency} Workouts`,
              description: `Log ${goalFrequency} workout sessions this month.`,
              goalValue: goalFrequency, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlySessions, 
              currentValue: initialMonthlySessions, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Workout Frequency challenge:", e); }
      // --- Consistency Streak ---
      try {
           // Goal can be dynamic, e.g., based on previous month or avg freq
           const goalConsistency = 12; 
           addChallenge({
                userId: userId, type: ChallengeType.ConsistencyStreak, status: ChallengeStatus.NotStarted,
                metric: ChallengeMetric.Days, unit: 'days', title: `Workout on ${goalConsistency} Days`,
                description: `Log workouts on ${goalConsistency} different days this month.`,
                goalValue: goalConsistency, 
                // <<< Use calculated initial value >>>
                startValue: initialMonthlyDays.size, 
                currentValue: initialMonthlyDays.size, 
                month: currentMonth, year: currentYear, exerciseId: null,
                completedAt: null, relatedWorkoutId: null,
           });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Consistency challenge:", e); }
      // --- Exercise Variety ---
      try {
          // Use 90-day history to set a reasonable goal
          const uniqueExercisesUsed90d = new Set(
              recentWorkoutsPrisma.flatMap(w => 
                 w.exercises?.map((ex: any) => ex.exercise?.name).filter(Boolean) ?? [] 
              )
          );
          const goalVariety = Math.min(15, Math.max(5, uniqueExercisesUsed90d.size + 2)); // Goal based on recent variety
          addChallenge({ 
              userId: userId, type: ChallengeType.ExerciseVariety, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Exercises, unit: 'exercises', title: `Perform ${goalVariety} Unique Exercises`,
              description: `Log at least ${goalVariety} different exercises this month.`,
              goalValue: goalVariety, 
              // <<< Use calculated initial value >>>
              startValue: initialExerciseIds.size, 
              currentValue: initialExerciseIds.size, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Variety challenge:", e); }
    // --- End of Generation Blocks ---

    // --- Save generated challenges --- 
    if (generatedChallengesData.length > 0) {
        console.log(`[Challenge Action Gen] Saving ${generatedChallengesData.length} new challenges...`);
        const dataToCreate = generatedChallengesData.map(c => {
            const { exerciseId, ...rest } = c;
            return exerciseId ? c : rest;
        });
        await prisma.challenge.createMany({ data: dataToCreate });
        console.log(`[Challenge Action Gen] Saved new challenges.`);
        // Refetch challenges after creation to return them
        return prisma.challenge.findMany({
            where: { userId: userId, year: currentYear, month: currentMonth },
            orderBy: { type: 'asc' },
        });
    } else {
        console.warn("[Challenge Action Gen] No challenges were generated.");
        return [];
    }
}

/**
 * Fetches challenges for the current month for the logged-in user.
 * If challenges don't exist, generates and saves them first.
 */
export async function getChallengesForUser(): Promise<Challenge[]> {
    const user = await getCurrentUser();
    if (!user?.id) {
        console.error("[getChallengesForUser] User not authenticated.");
        return []; // Return empty array for unauthorized
    }
    const userId = user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
        console.log(`[getChallengesForUser] Fetching challenges for ${userId} for ${currentYear}-${currentMonth}`);
        let challenges = await prisma.challenge.findMany({
            where: { userId: userId, year: currentYear, month: currentMonth },
            orderBy: { type: 'asc' },
        });

        if (challenges.length === 0) {
            console.log("[getChallengesForUser] No challenges found, generating new set...");
            challenges = await generateAndSaveChallenges(userId, currentYear, currentMonth);
        }
        
        console.log(`[getChallengesForUser] Returning ${challenges.length} challenges.`);
        return challenges;
    } catch (error: any) {
        console.error(`[getChallengesForUser] Error fetching challenges for user ${userId}:`, error);
        return []; // Return empty array on error
    }
}

/**
 * Deletes existing challenges for the current month and generates a new set.
 */
export async function refreshChallengesAction(): Promise<{ success: boolean; message?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.id) {
    console.error("[refreshChallengesAction] User not authenticated.");
    return { success: false, error: 'Unauthorized' };
  }
  const userId = user.id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  console.log(`[refreshChallengesAction] Starting refresh for user ${userId} for ${currentYear}-${currentMonth}`);

  try {
    // --- 1. Delete existing challenges for the month --- 
    console.log(`[refreshChallengesAction] Deleting existing challenges...`);
    const deleteResult = await prisma.challenge.deleteMany({
      where: { userId: userId, year: currentYear, month: currentMonth },
    });
    console.log(`[refreshChallengesAction] Deleted ${deleteResult.count} challenges.`);

    // --- 2. Fetch Data for Generation (Similar to API GET logic) ---
    console.log(`[refreshChallengesAction] Fetching data for new challenge generation...`);
    const userObjectId = new Types.ObjectId(userId);
    const userDoc = await UserModel.findById(userObjectId).select('personalRecords weight').lean<IUser>();
    const overallPRs = userDoc?.personalRecords || {};
    const userWeight = (typeof userDoc?.weight === 'number' && userDoc.weight > 0) ? userDoc.weight : null;
    
    const rawExercisePRs = await ExercisePRModel.find({ userId: userObjectId }).lean();
    const exercisePRs: LeanExercisePR[] = rawExercisePRs.map(pr => ({
        _id: pr._id as Types.ObjectId, userId: pr.userId as Types.ObjectId,
        exerciseId: pr.exerciseId as Types.ObjectId, exerciseName: pr.exerciseName as string,
        value: pr.value as number, unit: pr.unit as string, date: pr.date as Date,
        workoutId: pr.workoutId as Types.ObjectId | undefined, createdAt: pr.createdAt as Date,
        updatedAt: pr.updatedAt as Date,
      }));
    const exercisePRMap = exercisePRs.reduce((map, pr) => {
        map[`${pr.exerciseId.toString()}_${pr.unit}`] = pr; 
        return map;
      }, {} as Record<string, LeanExercisePR>);
      
    const historyCutoff = new Date();
    historyCutoff.setDate(now.getDate() - 90);
    // Assuming Prisma client instance is available
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: userId, date: { gte: historyCutoff } },
      select: { 
        date: true, type: true, distance: true, duration: true,
        // Use the correct relation name 'exercises' from schema.prisma
        exercises: { 
          select: {
            // Select from WorkoutExercise model
            order: true, // Example field if needed
            notes: true, // Example field if needed
            exercise: { // Select details from the related Exercise
              select: { name: true, category: true }
            }
          }
        }
      }
    });
    console.log(`[refreshChallengesAction] Fetched data for generation: ${exercisePRs.length} PRs, ${recentWorkouts.length} recent workouts.`);

    // --- <<< NEW: Fetch ALL workouts THIS MONTH for initial values (Copied from generateAndSaveChallenges) >>> ---
    console.log(`[refreshChallengesAction] Fetching existing workouts for ${currentYear}-${currentMonth}...`);
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    let initialMonthlyDistanceKm = 0;
    let initialMonthlyVolumeKg = 0;
    let initialMonthlySessions = 0;
    const initialMonthlyDays = new Set<string>();
    const initialExerciseIds = new Set<string>();

    try {
        await dbConnect(); // Ensure Mongoose connection
        const workoutsThisMonth = await WorkoutModel.find({
            userId: userObjectId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        })
        .select('_id date type distance calculatedVolume') // Select needed fields, remove workoutExercises
        .lean();

        console.log(`[refreshChallengesAction] Found ${workoutsThisMonth.length} workouts this month.`);

        // --- <<< NEW: Fetch WorkoutExercises separately >>> ---
        if (workoutsThisMonth.length > 0) {
          const workoutIds = workoutsThisMonth.map(w => w._id);
          const workoutExercisesThisMonth = await WorkoutExerciseModel.find({
              workoutId: { $in: workoutIds },
              // Optional: Add date filter here too if WorkoutExercise has date and it's indexed
              // date: { $gte: startOfMonth, $lte: endOfMonth }
          }).select('exerciseId').lean();

          workoutExercisesThisMonth.forEach((ex: any) => {
              if (ex.exerciseId) {
                  initialExerciseIds.add(ex.exerciseId.toString());
              }
          });
          console.log(`[refreshChallengesAction] Found ${workoutExercisesThisMonth.length} workout exercises across these workouts.`);
        }
        // --- <<< END NEW: Fetch WorkoutExercises separately >>> ---

        initialMonthlySessions = workoutsThisMonth.length;

        workoutsThisMonth.forEach((workout: any) => {
            initialMonthlyDays.add(new Date(workout.date).toISOString().split('T')[0]);
            if ((workout.type === 'running' || workout.type === 'run') && workout.distance) {
                initialMonthlyDistanceKm += (workout.distance / 1000); // Convert meters to KM
            }
            if (workout.type === 'strength' && workout.calculatedVolume) {
                initialMonthlyVolumeKg += workout.calculatedVolume;
            }
        });

        console.log(`[refreshChallengesAction] Initial values: Sessions=${initialMonthlySessions}, Days=${initialMonthlyDays.size}, Distance=${initialMonthlyDistanceKm.toFixed(1)}km, Volume=${initialMonthlyVolumeKg}kg, Variety=${initialExerciseIds.size}`);

    } catch (err) {
        console.error("[refreshChallengesAction] Error fetching workouts this month:", err);
        // Proceed with 0 initial values if fetch fails
    }
    // --- <<< END NEW: Fetch workouts THIS MONTH >>> ---

    // --- 3. Generate Challenge Data (Copied & adapted from API GET logic) ---
    const generatedChallengesData: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>[] = [];
    const generatedTypes = new Set<ChallengeType>();
    const addChallenge = (data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>) => {
        if (!generatedTypes.has(data.type) && generatedChallengesData.length < 12) {
          generatedChallengesData.push(data);
          generatedTypes.add(data.type);
        }
    };

    // --- Strength PRs ---
    const prExercises = ['Bench Press', 'Squat', 'Deadlift'];
    shuffle(prExercises);
    for (const exName of prExercises) {
      try {
        if (generatedTypes.has(ChallengeType.StrengthPR)) break; 
        const exercise = await prisma.exercise.findUnique({ where: { name: exName } });
        if (exercise) { 
          const pr = exercisePRMap[`${exercise.id}_kg`];
          const currentPRValue = pr?.value ?? 0;
          const goalValue = Math.max(currentPRValue + 2.5, Math.round((currentPRValue * 1.025) / 2.5) * 2.5);
          if (goalValue > currentPRValue) {
            addChallenge({
              userId: userId, type: ChallengeType.StrengthPR, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Weight, unit: 'kg', title: `New ${exName} PR`,
              description: `Lift ${goalValue}kg in ${exName}. Your best is ${currentPRValue}kg.`,
              goalValue: goalValue, startValue: currentPRValue, currentValue: currentPRValue,
              month: currentMonth, year: currentYear, exerciseId: exercise.id,
              completedAt: null, relatedWorkoutId: null,
            });
          }
        }
      } catch (e) { console.error(`Error generating ${exName} challenge:`, e); }
    }
    
    // --- Bodyweight Reps ---
    const bwExercises = ['Pull-up', 'Push-up'];
    shuffle(bwExercises); 
     for (const exName of bwExercises) {
       try {
          if (generatedTypes.has(ChallengeType.BodyweightReps)) break;
          const exercise = await prisma.exercise.findUnique({ where: { name: exName } });
          if (exercise) {
              const pr = exercisePRMap[`${exercise.id}_reps`];
              const currentPRValue = pr?.value ?? 0;
              const goalValue = currentPRValue + (currentPRValue > 5 ? 2 : 1); 
              addChallenge({
                  userId: userId, type: ChallengeType.BodyweightReps, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Reps, unit: 'reps', title: `Achieve ${goalValue} ${exName}s`,
                  description: `Complete ${goalValue} consecutive ${exName}s. Your best is ${currentPRValue}.`,
                  goalValue: goalValue, startValue: currentPRValue, currentValue: currentPRValue,
                  month: currentMonth, year: currentYear, exerciseId: exercise.id,
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch(e) { console.error(`Error generating ${exName} challenge:`, e); }
     }
      
      // --- Longest Run ---
      try {
          const currentLongestRun = (typeof overallPRs.longestRun?.value === 'number') ? overallPRs.longestRun.value : 0; 
          const goalLongestRun = Math.round(currentLongestRun * 1.05 * 10) / 10; 
          if (goalLongestRun > currentLongestRun && goalLongestRun >= 1) { 
              addChallenge({
                  userId: userId, type: ChallengeType.LongestSession, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalLongestRun}km`,
                  description: `Complete a single run of ${goalLongestRun}km. Your longest is ${currentLongestRun}km.`,
                  goalValue: goalLongestRun, startValue: currentLongestRun, currentValue: 0, 
                  month: currentMonth, year: currentYear, exerciseId: null, 
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch (e) { console.error("Error generating Longest Run challenge:", e); }

       // --- Fastest 5k Pace --- 
       try {
          const currentFastestPace = (typeof overallPRs.fastest5kPace?.value === 'number' && overallPRs.fastest5kPace.value !== Infinity) ? overallPRs.fastest5kPace.value : null; 
          if (currentFastestPace) {
              const goalPace = currentFastestPace * 0.98; 
              const formatPace = (paceSm: number): string => {
                  const paceMinKm = (paceSm * 1000) / 60;
                  const minutes = Math.floor(paceMinKm);
                  const seconds = Math.round((paceMinKm - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
              };
               addChallenge({
                  userId: userId, type: ChallengeType.DistancePace, status: ChallengeStatus.NotStarted,
                  metric: ChallengeMetric.Pace, unit: 's/m', title: `Faster 5k Pace`,
                  description: `Beat your 5k pace PR of ${formatPace(currentFastestPace)}. Target: ${formatPace(goalPace)}.`, 
                  goalValue: goalPace, 
                  startValue: currentFastestPace, currentValue: currentFastestPace, 
                  month: currentMonth, year: currentYear, exerciseId: null, 
                  completedAt: null, relatedWorkoutId: null,
              });
          }
      } catch (e) { console.error("Error generating Fastest Pace challenge:", e); }
      
      // --- Monthly Running Distance ---
      try {
          const runningWorkouts = recentWorkouts.filter(w => w.type?.toLowerCase() === 'running' || w.type?.toLowerCase() === 'run');
          const distancesMeters = runningWorkouts.map(w => w.distance ?? 0); 
          const totalDistanceMetersLast90d = distancesMeters.reduce((sum, dist) => sum + dist, 0);
          const avgMonthlyDistanceMeters = totalDistanceMetersLast90d / 3;
          const goalMonthlyDistanceMeters = Math.max(5000, Math.round((avgMonthlyDistanceMeters * 1.1) / 1000) * 1000); 
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyDistance, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalMonthlyDistanceMeters / 1000}km This Month`,
              description: `Accumulate ${goalMonthlyDistanceMeters / 1000}km of running distance in ${now.toLocaleString('default', { month: 'long' })}.`,
              goalValue: goalMonthlyDistanceMeters / 1000, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlyDistanceKm, 
              currentValue: initialMonthlyDistanceKm, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Monthly Distance challenge:", e); }

      // --- Monthly Volume ---
      try {
          const goalMonthlyVolume = 10000; 
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyVolume, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Volume, unit: 'kg', title: `Lift ${goalMonthlyVolume}kg Total Volume`,
              description: `Accumulate ${goalMonthlyVolume}kg of total lifting volume this month.`,
              goalValue: goalMonthlyVolume, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlyVolumeKg, 
              currentValue: initialMonthlyVolumeKg, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Monthly Volume challenge:", e); }
      
      // --- Workout Frequency ---
      try {
          const uniqueWorkoutDaysLast90d = new Set(recentWorkouts.map(w => w.date.toISOString().split('T')[0])).size;
          const avgMonthlyFrequency = Math.max(4, Math.round(uniqueWorkoutDaysLast90d / 3)); 
          const goalFrequency = Math.min(20, avgMonthlyFrequency + 2);
          addChallenge({
              userId: userId, type: ChallengeType.WorkoutFrequency, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Sessions, unit: 'sessions', title: `Complete ${goalFrequency} Workouts`,
              description: `Log ${goalFrequency} workout sessions this month.`,
              goalValue: goalFrequency, 
              // <<< Use calculated initial value >>>
              startValue: initialMonthlySessions, 
              currentValue: initialMonthlySessions, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Workout Frequency challenge:", e); }

      // --- Consistency Streak ---
      try {
           const goalConsistency = 12; 
           addChallenge({
                userId: userId, type: ChallengeType.ConsistencyStreak, status: ChallengeStatus.NotStarted,
                metric: ChallengeMetric.Days, unit: 'days', title: `Workout on ${goalConsistency} Days`,
                description: `Log workouts on ${goalConsistency} different days this month.`,
                goalValue: goalConsistency, 
                // <<< Use calculated initial value >>>
                startValue: initialMonthlyDays.size, 
                currentValue: initialMonthlyDays.size, 
                month: currentMonth, year: currentYear, exerciseId: null,
                completedAt: null, relatedWorkoutId: null,
           });
      } catch (e) { console.error("Error generating Consistency challenge:", e); }

      // --- Exercise Variety ---
      try {
          const uniqueExercisesUsed = new Set(
              recentWorkouts.flatMap(w => 
                 w.exercises?.map(ex => ex.exercise?.name).filter(Boolean) ?? [] 
              )
          );
          const goalVariety = Math.min(15, Math.max(5, uniqueExercisesUsed.size + 2)); 
          addChallenge({
              userId: userId, type: ChallengeType.ExerciseVariety, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Exercises, unit: 'exercises', title: `Perform ${goalVariety} Unique Exercises`,
              description: `Log at least ${goalVariety} different exercises this month.`,
              goalValue: goalVariety, 
              // <<< Use calculated initial value >>>
              startValue: initialExerciseIds.size, 
              currentValue: initialExerciseIds.size, 
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Variety challenge:", e); }

    // --- 4. Save generated challenges --- 
    if (generatedChallengesData.length > 0) {
        console.log(`[refreshChallengesAction] Creating ${generatedChallengesData.length} new challenges in Prisma...`);
        // Remove exerciseId if null before creating
        const dataToCreate = generatedChallengesData.map(c => {
            const { exerciseId, ...rest } = c;
            return exerciseId ? c : rest;
        });
        // Use Prisma's createMany
        await prisma.challenge.createMany({ data: dataToCreate });
        console.log(`[refreshChallengesAction] Successfully created new challenges.`);
    } else {
        console.warn("[refreshChallengesAction] No challenges were generated.");
    }

    // --- 5. Revalidate the path --- 
    revalidatePath('/challenges');
    console.log('[refreshChallengesAction] Revalidated /challenges path.');

    return { success: true, message: `Refreshed challenges. ${generatedChallengesData.length} new challenges generated.` };

  } catch (error: any) {
    console.error("[refreshChallengesAction] Error refreshing challenges:", error);
    return { success: false, error: error.message || 'Failed to refresh challenges.' };
  }
}

/**
 * Updates challenge progress based on a completed workout.
 * This should be called after a workout is successfully saved.
 */
export async function updateChallengesAfterWorkout(userId: string, workoutData: any): Promise<void> {
  // <<< ADD LOG: Entry point >>>
  console.log(`>>> [updateChallengesAfterWorkout ENTRY] User: ${userId}, Workout ID: ${workoutData?._id}`);
  
  // <<< ADD LOG: Input Data Structure >>>
  console.log(`>>> [updateChallengesAfterWorkout INPUT] workoutData type: ${typeof workoutData}, keys: ${workoutData ? Object.keys(workoutData).join(', ') : 'null/undefined'}`);
  if (workoutData?.workoutExercises && Array.isArray(workoutData.workoutExercises)) {
    console.log(`>>> [updateChallengesAfterWorkout INPUT] workoutExercises count: ${workoutData.workoutExercises.length}`);
    if (workoutData.workoutExercises.length > 0) {
       console.log(`>>> [updateChallengesAfterWorkout INPUT] First exercise keys: ${Object.keys(workoutData.workoutExercises[0]).join(', ')}`);
       console.log(`>>> [updateChallengesAfterWorkout INPUT] First exerciseId keys: ${workoutData.workoutExercises[0].exerciseId ? Object.keys(workoutData.workoutExercises[0].exerciseId).join(', ') : 'null/undefined'}`);
    }
  } else {
    console.log(`>>> [updateChallengesAfterWorkout INPUT] workoutExercises: Not an array or missing.`);
  }
  // <<< END LOGS >>>

  console.log(`[updateChallengesAfterWorkout] Checking challenge progress for user ${userId} after workout ${workoutData._id}`);

  const now = new Date(workoutData.date); // Use workout date for challenge month check
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  try {
    // Fetch active challenges for the current month
    const activeChallenges = await prisma.challenge.findMany({
      where: {
        userId: userId,
        year: currentYear,
        month: currentMonth,
        status: { in: [ChallengeStatus.NotStarted, ChallengeStatus.InProgress] },
      },
      // Include exercise details if needed for comparison
      include: { exercise: true }, 
    });

    if (activeChallenges.length === 0) {
      console.log(`[updateChallengesAfterWorkout] No active challenges found for ${currentYear}-${currentMonth}.`);
      return;
    }

    console.log(`[updateChallengesAfterWorkout] Found ${activeChallenges.length} active challenges to check.`);

    const updatesToMake: { id: string; data: Partial<Challenge> }[] = [];

    // --- Iterate through challenges and check for updates ---
    for (const challenge of activeChallenges) {
        let needsUpdate = false;
        const updateData: Partial<Challenge> = { status: ChallengeStatus.InProgress }; // Assume progress if not completed

        // --- Example: Strength PR Challenge ---
        if (challenge.type === ChallengeType.StrengthPR && challenge.exerciseId && workoutData.type === 'strength' && workoutData.workoutExercises) {
          console.log(`[updateChallengesAfterWorkout] Checking StrengthPR challenge: ${challenge.title}`);
          for (const workoutEx of workoutData.workoutExercises) {
              if (workoutEx.exerciseId?._id?.toString() === challenge.exerciseId.toString()) {
                  // Find the max weight lifted for this exercise in the workout
                  let maxWeightInWorkout = 0;
                  workoutEx.sets?.forEach((set: any) => {
                      if (set.weight > maxWeightInWorkout) {
                          maxWeightInWorkout = set.weight;
                      }
                  });
                  console.log(`[updateChallengesAfterWorkout] Max weight in workout for ${challenge.exercise?.name}: ${maxWeightInWorkout}kg. Current PR: ${challenge.currentValue}kg. Goal: ${challenge.goalValue}kg.`);

                  if (maxWeightInWorkout > (challenge.currentValue ?? challenge.startValue ?? 0)) {
                      updateData.currentValue = maxWeightInWorkout;
                      needsUpdate = true;
                      if (maxWeightInWorkout >= challenge.goalValue) {
                          updateData.status = ChallengeStatus.Completed;
                          updateData.completedAt = now;
                          updateData.relatedWorkoutId = workoutData._id.toString(); // Link completion to workout
                          console.log(`[updateChallengesAfterWorkout] StrengthPR challenge COMPLETED!`);
                      } else {
                          console.log(`[updateChallengesAfterWorkout] StrengthPR challenge progress updated.`);
                      }
                  }
              }
          }
        }
        
        // --- Example: Bodyweight Reps Challenge ---
        if (challenge.type === ChallengeType.BodyweightReps && challenge.exerciseId && workoutData.type === 'strength' && workoutData.workoutExercises) {
          console.log(`[updateChallengesAfterWorkout] Checking BodyweightReps challenge: ${challenge.title}`);
          for (const workoutEx of workoutData.workoutExercises) {
            if (workoutEx.exerciseId?._id?.toString() === challenge.exerciseId.toString()) {
              let maxRepsInWorkout = 0;
              workoutEx.sets?.forEach((set: any) => {
                // Assuming bodyweight reps have weight = 0 or null
                if ((set.weight === 0 || set.weight == null) && set.reps > maxRepsInWorkout) {
                  maxRepsInWorkout = set.reps;
                }
              });
              console.log(`[updateChallengesAfterWorkout] Max reps in workout for ${challenge.exercise?.name}: ${maxRepsInWorkout}. Current Best: ${challenge.currentValue}. Goal: ${challenge.goalValue}.`);

              if (maxRepsInWorkout > (challenge.currentValue ?? challenge.startValue ?? 0)) {
                updateData.currentValue = maxRepsInWorkout;
                needsUpdate = true;
                if (maxRepsInWorkout >= challenge.goalValue) {
                    updateData.status = ChallengeStatus.Completed;
                    updateData.completedAt = now;
                    updateData.relatedWorkoutId = workoutData._id.toString();
                    console.log(`[updateChallengesAfterWorkout] BodyweightReps challenge COMPLETED!`);
                } else {
                    console.log(`[updateChallengesAfterWorkout] BodyweightReps challenge progress updated.`);
                }
              }
            }
          }
        }
        
        // --- Example: Longest Run Challenge ---
        if (challenge.type === ChallengeType.LongestSession && challenge.metric === ChallengeMetric.Distance && challenge.unit === 'km' && (workoutData.type === 'running' || workoutData.type === 'run') && workoutData.distance) {
            const workoutDistanceKm = workoutData.distance / 1000; // Assuming workoutData.distance is in meters
            console.log(`[updateChallengesAfterWorkout] Checking LongestRun challenge. Workout distance: ${workoutDistanceKm}km. Goal: ${challenge.goalValue}km.`);
            if (workoutDistanceKm >= challenge.goalValue) {
                updateData.currentValue = workoutDistanceKm; // Update current value to the completing run's distance
                updateData.status = ChallengeStatus.Completed;
                updateData.completedAt = now;
                updateData.relatedWorkoutId = workoutData._id.toString();
                needsUpdate = true;
                console.log(`[updateChallengesAfterWorkout] LongestRun challenge COMPLETED!`);
            } else if (workoutDistanceKm > (challenge.currentValue ?? 0)) {
                 // Optional: Update currentValue even if goal not met, to show longest run this month
                 updateData.currentValue = workoutDistanceKm; 
                 needsUpdate = true;
                 console.log(`[updateChallengesAfterWorkout] LongestRun challenge progress updated (longest this month).`);
            }
        }

        // --- Example: Monthly Running Distance Challenge ---
        if (challenge.type === ChallengeType.MonthlyDistance && challenge.metric === ChallengeMetric.Distance && challenge.unit === 'km' && (workoutData.type === 'running' || workoutData.type === 'run') && workoutData.distance) {
          const workoutDistanceKm = workoutData.distance / 1000; // Assuming workoutData.distance is in meters
          const currentProgress = challenge.currentValue ?? 0;
          const newProgress = currentProgress + workoutDistanceKm;
          console.log(`[updateChallengesAfterWorkout] Checking MonthlyDistance challenge. Added ${workoutDistanceKm}km. New total: ${newProgress}km. Goal: ${challenge.goalValue}km.`);

          updateData.currentValue = newProgress;
          needsUpdate = true;

          if (newProgress >= challenge.goalValue) {
            updateData.status = ChallengeStatus.Completed;
            updateData.completedAt = updateData.completedAt || now; // Only set completion date once
             console.log(`[updateChallengesAfterWorkout] MonthlyDistance challenge COMPLETED!`);
          } else {
             console.log(`[updateChallengesAfterWorkout] MonthlyDistance challenge progress updated.`);
          }
        }
        
        // --- Example: Monthly Volume Challenge ---
        if (challenge.type === ChallengeType.MonthlyVolume && challenge.metric === ChallengeMetric.Volume && challenge.unit === 'kg' && workoutData.type === 'strength' && workoutData.calculatedVolume) {
            const workoutVolumeKg = workoutData.calculatedVolume;
            const currentProgress = challenge.currentValue ?? 0;
            const newProgress = currentProgress + workoutVolumeKg;
            console.log(`[updateChallengesAfterWorkout] Checking MonthlyVolume challenge. Added ${workoutVolumeKg}kg. New total: ${newProgress}kg. Goal: ${challenge.goalValue}kg.`);

            updateData.currentValue = newProgress;
            needsUpdate = true;

            if (newProgress >= challenge.goalValue) {
                updateData.status = ChallengeStatus.Completed;
                updateData.completedAt = updateData.completedAt || now; 
                console.log(`[updateChallengesAfterWorkout] MonthlyVolume challenge COMPLETED!`);
            } else {
                console.log(`[updateChallengesAfterWorkout] MonthlyVolume challenge progress updated.`);
            }
        }
        
        // --- Example: Workout Frequency Challenge ---
        if (challenge.type === ChallengeType.WorkoutFrequency && challenge.metric === ChallengeMetric.Sessions) {
             // Simply increment the count for *any* workout logged this month
             const currentProgress = challenge.currentValue ?? 0;
             const newProgress = currentProgress + 1;
             console.log(`[updateChallengesAfterWorkout] Checking WorkoutFrequency challenge. Incrementing count. New total: ${newProgress} sessions. Goal: ${challenge.goalValue}.`);

             updateData.currentValue = newProgress;
             needsUpdate = true;

             if (newProgress >= challenge.goalValue) {
                updateData.status = ChallengeStatus.Completed;
                updateData.completedAt = updateData.completedAt || now; 
                console.log(`[updateChallengesAfterWorkout] WorkoutFrequency challenge COMPLETED!`);
             } else {
                console.log(`[updateChallengesAfterWorkout] WorkoutFrequency challenge progress updated.`);
             }
        }

        // --- Example: Consistency Streak Challenge (Workout Days) ---
        if (challenge.type === ChallengeType.ConsistencyStreak && challenge.metric === ChallengeMetric.Days) {
             // This one is trickier. We need to know if a workout was *already* logged today for this month's challenge.
             // A simple way is to fetch workouts for the user *today* before this check.
             // For now, we'll assume this function runs *once* per workout save,
             // and we need a way to track unique days *within* the challenge period.
             // Let's fetch distinct workout dates for the month for this user.
             
             const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
             const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

             // Fetch distinct dates of workouts logged *this month* for the user
             // IMPORTANT: This relies on Mongoose WorkoutModel. Ensure connection if needed.
             // Consider moving this fetch outside the loop if performance is an issue.
             const distinctWorkoutDaysThisMonth = await WorkoutModel.distinct('date', {
                 userId: userId,
                 date: { $gte: startOfMonth, $lte: endOfMonth }
             }).then(dates => new Set(dates.map(d => d.toISOString().split('T')[0]))); // Get unique YYYY-MM-DD strings

             const workoutDateString = now.toISOString().split('T')[0];
             const isNewDay = !distinctWorkoutDaysThisMonth.has(workoutDateString);
             
             // Add today's date to the set *after* checking if it was already there
             distinctWorkoutDaysThisMonth.add(workoutDateString); 
             const newProgress = distinctWorkoutDaysThisMonth.size; // Size of the set is the number of unique days

             console.log(`[updateChallengesAfterWorkout] Checking ConsistencyStreak challenge. Workout on ${workoutDateString}. Unique days this month: ${newProgress}. Goal: ${challenge.goalValue}.`);
             
             // Only update if the number of unique days changed OR the status needs updating
             if (newProgress > (challenge.currentValue ?? 0) || (newProgress >= challenge.goalValue && challenge.status !== ChallengeStatus.Completed)) {
                 updateData.currentValue = newProgress;
                 needsUpdate = true;

                 if (newProgress >= challenge.goalValue) {
                     updateData.status = ChallengeStatus.Completed;
                     updateData.completedAt = updateData.completedAt || now; 
                     console.log(`[updateChallengesAfterWorkout] ConsistencyStreak challenge COMPLETED!`);
                 } else {
                     console.log(`[updateChallengesAfterWorkout] ConsistencyStreak challenge progress updated.`);
                 }
             }
        }

        // --- Example: Exercise Variety Challenge ---
        if (challenge.type === ChallengeType.ExerciseVariety && challenge.metric === ChallengeMetric.Exercises && workoutData.workoutExercises) {
             // Similar to consistency, we need the set of unique exercises used *this month*.
             const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
             const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

             // Fetch all WorkoutExercises for the user this month and get distinct exercise IDs
             const workoutExercisesThisMonth = await WorkoutExerciseModel.find({
                 userId: userId,
                 createdAt: { $gte: startOfMonth, $lte: endOfMonth } // Assuming createdAt aligns with workout date month
             }).select('exerciseId').lean();
             
             const distinctExerciseIdsThisMonth = new Set(
                 workoutExercisesThisMonth
                     .map(we => we.exerciseId?.toString())
                     .filter(Boolean) as string[]
             );
             
             // Add exercises from the *current* workout to the set
             workoutData.workoutExercises.forEach((workoutEx: any) => {
                 if (workoutEx.exerciseId?._id) {
                     distinctExerciseIdsThisMonth.add(workoutEx.exerciseId._id.toString());
                 }
             });

             const newProgress = distinctExerciseIdsThisMonth.size;
             console.log(`[updateChallengesAfterWorkout] Checking ExerciseVariety challenge. Unique exercises this month: ${newProgress}. Goal: ${challenge.goalValue}.`);

             // Only update if the count increased or completion status changes
             if (newProgress > (challenge.currentValue ?? 0) || (newProgress >= challenge.goalValue && challenge.status !== ChallengeStatus.Completed)) {
                 updateData.currentValue = newProgress;
                 needsUpdate = true;

                 if (newProgress >= challenge.goalValue) {
                     updateData.status = ChallengeStatus.Completed;
                     updateData.completedAt = updateData.completedAt || now; 
                     console.log(`[updateChallengesAfterWorkout] ExerciseVariety challenge COMPLETED!`);
                 } else {
                     console.log(`[updateChallengesAfterWorkout] ExerciseVariety challenge progress updated.`);
                 }
             }
        }


        // TODO: Add logic for other challenge types (Pace, etc.)

        if (needsUpdate) {
          updatesToMake.push({ id: challenge.id, data: updateData });
        }
    }

    // --- Batch update challenges ---
    if (updatesToMake.length > 0) {
      console.log(`[updateChallengesAfterWorkout] Applying ${updatesToMake.length} challenge updates...`);
      const updatePromises = updatesToMake.map(update =>
        prisma.challenge.update({
          where: { id: update.id },
          data: update.data,
        })
      );
      await Promise.all(updatePromises);
      console.log(`[updateChallengesAfterWorkout] Challenge updates applied successfully.`);
      // Consider revalidating challenges path here if needed immediately,
      // although it's often better to revalidate after the main action completes.
      // revalidatePath('/challenges'); 
    } else {
      console.log(`[updateChallengesAfterWorkout] No challenge updates required for this workout.`);
    }

  } catch (error: any) {
    console.error(`[updateChallengesAfterWorkout] Error updating challenge progress for user ${userId}:`, error);
    // Don't throw error from here, just log it, as challenge update failure shouldn't block workout save.
  }
} 