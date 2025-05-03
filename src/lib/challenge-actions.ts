"use server";

import { revalidatePath } from 'next/cache';
import { PrismaClient, ChallengeStatus, ChallengeType, ChallengeMetric } from '@prisma/client';
import type { Challenge } from '@prisma/client';
import { Types, Document } from 'mongoose';
import UserModel from '@/lib/db/models/user';
import ExercisePRModel, { IExercisePR } from '@/lib/db/models/exercisePR';
import type { IUser } from '@/lib/db/models/user';
import { getCurrentUser } from '@/lib/auth'; // Assuming this helper exists

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
    // --- Fetch Data ---
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
    historyCutoff.setDate(new Date().getDate() - 90);
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: userId, date: { gte: historyCutoff } },
      select: { date: true, type: true, distance: true, duration: true,
        exercises: { select: { exercise: { select: { name: true, category: true } } } }
      }
    });
    
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
          const runningWorkouts = recentWorkouts.filter(w => w.type?.toLowerCase() === 'running' || w.type?.toLowerCase() === 'run');
          const distancesMeters = runningWorkouts.map(w => w.distance ?? 0); 
          const totalDistanceMetersLast90d = distancesMeters.reduce((sum, dist) => sum + dist, 0);
          const avgMonthlyDistanceMeters = totalDistanceMetersLast90d / 3;
          const goalMonthlyDistanceMeters = Math.max(5000, Math.round((avgMonthlyDistanceMeters * 1.1) / 1000) * 1000); 
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyDistance, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalMonthlyDistanceMeters / 1000}km This Month`,
              description: `Accumulate ${goalMonthlyDistanceMeters / 1000}km of running distance in ${new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })}.`,
              goalValue: goalMonthlyDistanceMeters / 1000, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Monthly Distance challenge:", e); }
      // --- Monthly Volume ---
      try {
          const goalMonthlyVolume = 10000; 
          addChallenge({
              userId: userId, type: ChallengeType.MonthlyVolume, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Volume, unit: 'kg', title: `Lift ${goalMonthlyVolume}kg Total Volume`,
              description: `Accumulate ${goalMonthlyVolume}kg of total lifting volume this month.`,
              goalValue: goalMonthlyVolume, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Monthly Volume challenge:", e); }
      // --- Workout Frequency ---
      try {
          const uniqueWorkoutDaysLast90d = new Set(recentWorkouts.map(w => w.date.toISOString().split('T')[0])).size;
          const avgMonthlyFrequency = Math.max(4, Math.round(uniqueWorkoutDaysLast90d / 3)); 
          const goalFrequency = Math.min(20, avgMonthlyFrequency + 2); 
          addChallenge({
              userId: userId, type: ChallengeType.WorkoutFrequency, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Sessions, unit: 'sessions', title: `Complete ${goalFrequency} Workouts`,
              description: `Log ${goalFrequency} workout sessions this month.`,
              goalValue: goalFrequency, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Workout Frequency challenge:", e); }
      // --- Consistency Streak ---
      try {
           const goalConsistency = 12; 
           addChallenge({
                userId: userId, type: ChallengeType.ConsistencyStreak, status: ChallengeStatus.NotStarted,
                metric: ChallengeMetric.Days, unit: 'days', title: `Workout on ${goalConsistency} Days`,
                description: `Log workouts on ${goalConsistency} different days this month.`,
                goalValue: goalConsistency, startValue: 0, currentValue: 0,
                month: currentMonth, year: currentYear, exerciseId: null,
                completedAt: null, relatedWorkoutId: null,
           });
      } catch (e) { console.error("[Challenge Action Gen] Error generating Consistency challenge:", e); }
      // --- Exercise Variety ---
      try {
          const uniqueExercisesUsed = new Set(
              recentWorkouts.flatMap(w => 
                 w.exercises?.map(ex => ex.exercise?.name).filter(Boolean) ?? [] 
              )
          );
          const goalVariety = Math.min(10, uniqueExercisesUsed.size + 2);
          addChallenge({ 
              userId: userId, type: ChallengeType.ExerciseVariety, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Exercises, unit: 'exercises', title: `Perform ${goalVariety} Unique Exercises`,
              description: `Log at least ${goalVariety} different exercises this month.`,
              goalValue: goalVariety, startValue: uniqueExercisesUsed.size, currentValue: uniqueExercisesUsed.size, 
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
            addChallenge({ /* ... challenge data ... */
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
              addChallenge({ /* ... challenge data ... */
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
              addChallenge({ /* ... challenge data ... */
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
               addChallenge({ /* ... challenge data ... */
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
          const goalMonthlyDistanceMeters = Math.max(5000, Math.round((avgMonthlyDistanceMeters * 1.1) / 1000) * 1000); // Min 5km, ~10% increase
          addChallenge({ /* ... challenge data ... */
              userId: userId, type: ChallengeType.MonthlyDistance, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalMonthlyDistanceMeters / 1000}km This Month`,
              description: `Accumulate ${goalMonthlyDistanceMeters / 1000}km of running distance in ${now.toLocaleString('default', { month: 'long' })}.`,
              goalValue: goalMonthlyDistanceMeters / 1000, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Monthly Distance challenge:", e); }

      // --- Monthly Volume ---
      try {
          // Placeholder: Calculate recent average monthly strength volume (requires workout schema access)
          // For now, set a default based on activity level or a fixed goal?
          const goalMonthlyVolume = 10000; // Example: Target 10,000kg volume
          addChallenge({ /* ... challenge data ... */
              userId: userId, type: ChallengeType.MonthlyVolume, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Volume, unit: 'kg', title: `Lift ${goalMonthlyVolume}kg Total Volume`,
              description: `Accumulate ${goalMonthlyVolume}kg of total lifting volume this month.`,
              goalValue: goalMonthlyVolume, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Monthly Volume challenge:", e); }
      
      // --- Workout Frequency ---
      try {
          const uniqueWorkoutDaysLast90d = new Set(recentWorkouts.map(w => w.date.toISOString().split('T')[0])).size;
          const avgMonthlyFrequency = Math.max(4, Math.round(uniqueWorkoutDaysLast90d / 3)); // Min 4 sessions
          const goalFrequency = Math.min(20, avgMonthlyFrequency + 2); // Add 2, cap at 20
          addChallenge({ /* ... challenge data ... */
              userId: userId, type: ChallengeType.WorkoutFrequency, status: ChallengeStatus.NotStarted,
              metric: ChallengeMetric.Sessions, unit: 'sessions', title: `Complete ${goalFrequency} Workouts`,
              description: `Log ${goalFrequency} workout sessions this month.`,
              goalValue: goalFrequency, startValue: 0, currentValue: 0,
              month: currentMonth, year: currentYear, exerciseId: null,
              completedAt: null, relatedWorkoutId: null,
          });
      } catch (e) { console.error("Error generating Workout Frequency challenge:", e); }

      // --- Consistency Streak ---
      try {
           const goalConsistency = 12; // Example: Workout on 12 different days
           addChallenge({ /* ... challenge data ... */
                userId: userId, type: ChallengeType.ConsistencyStreak, status: ChallengeStatus.NotStarted,
                metric: ChallengeMetric.Days, unit: 'days', title: `Workout on ${goalConsistency} Days`,
                description: `Log workouts on ${goalConsistency} different days this month.`,
                goalValue: goalConsistency, startValue: 0, currentValue: 0,
                month: currentMonth, year: currentYear, exerciseId: null,
                completedAt: null, relatedWorkoutId: null,
           });
      } catch (e) { console.error("Error generating Consistency challenge:", e); }

      // --- Exercise Variety ---
      try {
          const uniqueExercisesUsed = new Set(
              recentWorkouts.flatMap(w => 
                 // Use the correct relation name 'exercises'
                 w.exercises?.map(ex => ex.exercise?.name).filter(Boolean) ?? [] 
              )
          );
          const goalVariety = Math.min(10, uniqueExercisesUsed.size + 2); // Add 2, cap at 10 unique exercises
          addChallenge({ /* ... challenge data ... */
              userId: userId, type: ChallengeType.ExerciseVariety, status: ChallengeStatus.NotStarted,
              // Use the correct metric enum
              metric: ChallengeMetric.Exercises, unit: 'exercises', title: `Perform ${goalVariety} Unique Exercises`,
              // Update description to match the metric
              description: `Log at least ${goalVariety} different exercises this month.`,
              goalValue: goalVariety, startValue: uniqueExercisesUsed.size, currentValue: uniqueExercisesUsed.size, // Start/Current based on recent history
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