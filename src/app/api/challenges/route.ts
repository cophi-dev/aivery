import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Types, Document } from 'mongoose'; // Import Document
import { authOptions } from '@/lib/auth';
// Simplify Prisma import - rely on TS resolution from instance
import { PrismaClient, ChallengeStatus, ChallengeType, ChallengeMetric } from '@prisma/client'; 
// Use Prisma namespace for types/enums if direct import fails
import type { Challenge } from '@prisma/client';
import UserModel from '@/lib/db/models/user'; 
import ExercisePRModel, { IExercisePR } from '@/lib/db/models/exercisePR'; 
import type { IUser } from '@/lib/db/models/user'; 

// Remove local interface definition, use Prisma's generated type
/*
interface Challenge {
  id: string;
  title: string;
  description: string;
  goal: number | string;
  currentValue: number | string;
  unit?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Failed';
}
*/

const prisma = new PrismaClient();

// Helper function to shuffle an array in place (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Define a type for the plain object returned by lean() for ExercisePR
// Ensure all required fields from IExercisePR (excluding Document props) are here
type LeanExercisePR = Omit<IExercisePR, keyof Document | '__v'> & { 
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  value: number; // Ensure required fields are non-optional
  unit: string;
  exerciseName: string;
  date: Date; 
  workoutId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  type: 'weight' | 'reps' | 'daily_reps' | 'volume'; // Add the required type field
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
  const currentYear = now.getFullYear();

  try {
    // Check if challenges exist (using Prisma Challenge model)
    let challenges = await prisma.challenge.findMany({
      where: { userId: userId, year: currentYear, month: currentMonth },
      orderBy: { type: 'asc' },
    });

    if (challenges.length === 0) {
      console.log(`[Challenges API] Generating challenges for ${userId} for ${currentYear}-${currentMonth}`);

      // --- Fetch Data for Generation ---
      // Removed await dbConnect(); - Mongoose likely handles connection globally

      // 1. Fetch User document (for overall PRs & weight) using Mongoose
      const userObjectId = new Types.ObjectId(userId);
      // Ensure IUser includes personalRecords structure if needed
      const userDoc = await UserModel.findById(userObjectId).select('personalRecords weight').lean<IUser>(); 
      const overallPRs = userDoc?.personalRecords || {};
      const userWeight = (typeof userDoc?.weight === 'number' && userDoc.weight > 0) ? userDoc.weight : null;
      console.log(`[Challenges API] Fetched User Doc. Overall PRs Keys: ${Object.keys(overallPRs || {}).join(', ')}`);

      // 2. Fetch ALL Exercise PRs using Mongoose ExercisePRModel
      // Cast the result of lean() to the LeanExercisePR type
      const rawExercisePRs = await ExercisePRModel.find({ userId: userObjectId }).lean();
      // Explicitly map to LeanExercisePR type for safety
      const exercisePRs: LeanExercisePR[] = rawExercisePRs.map(pr => ({
        _id: pr._id as Types.ObjectId,
        userId: pr.userId as Types.ObjectId,
        exerciseId: pr.exerciseId as Types.ObjectId,
        exerciseName: pr.exerciseName as string,
        value: pr.value as number,
        unit: pr.unit as string,
        type: pr.type as 'weight' | 'reps' | 'daily_reps' | 'volume', // Add the required type field
        date: pr.date as Date,
        workoutId: pr.workoutId as Types.ObjectId | undefined,
        createdAt: pr.createdAt as Date,
        updatedAt: pr.updatedAt as Date,
      }));
      
      const exercisePRMap = exercisePRs.reduce((map, pr) => {
        map[`${pr.exerciseId.toString()}_${pr.unit}`] = pr; 
        return map;
      }, {} as Record<string, LeanExercisePR>); 
      console.log(`[Challenges API] Fetched and mapped ${exercisePRs.length} Exercise PR documents.`);

      // 3. Fetch recent workout history (e.g., last 90 days) using Prisma
      const historyCutoff = new Date();
      historyCutoff.setDate(now.getDate() - 90);
      const recentWorkouts = await prisma.workout.findMany({
        where: {
          userId: userId,
          date: { gte: historyCutoff }
        },
        select: { 
          date: true, type: true, distance: true, duration: true, 
          // calculatedVolume: true, // Removed - Not in schema?
          exercises: { 
            select: {
              exercise: {
                select: { name: true, category: true }
              }
            }
          }
        }
      });
      console.log(`[Challenges API] Fetched ${recentWorkouts.length} workouts from last 90 days.`);

      // --- Generate Challenge Data --- 
      const generatedChallengesData: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>[] = [];
      const generatedTypes = new Set<ChallengeType>(); // Track generated types

      const addChallenge = (data: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'exercise' | 'relatedWorkout'>) => {
        if (!generatedTypes.has(data.type) && generatedChallengesData.length < 12) { // Limit total challenges
          generatedChallengesData.push(data);
          generatedTypes.add(data.type);
        } else {
          console.log(`[Challenges API] Skipping challenge type (duplicate or limit reached): ${data.type}`);
        }
      };
      
       // --- Strength PRs --- (Pick one)
      const prExercises = ['Bench Press', 'Squat', 'Deadlift'];
      shuffle(prExercises); // Shuffle the list before iterating
      for (const exName of prExercises) {
        try {
          // Limit to one Strength PR challenge total for variety
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

      // --- Bodyweight Reps --- (Pick one)
      const bwExercises = ['Pull-up', 'Push-up'];
      shuffle(bwExercises); // Shuffle the list before iterating
       for (const exName of bwExercises) {
         try {
            // Limit to one Bodyweight challenge total
            if (generatedTypes.has(ChallengeType.BodyweightReps)) break;

            const exercise = await prisma.exercise.findUnique({ where: { name: exName } });
            if (exercise) {
                const pr = exercisePRMap[`${exercise.id}_reps`];
                const currentPRValue = pr?.value ?? 0;
                const goalValue = currentPRValue + (currentPRValue > 5 ? 2 : 1); // Add 1 or 2 reps goal
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
            const goalLongestRun = Math.round(currentLongestRun * 1.05 * 10) / 10; // ~5% increase
            if (goalLongestRun > currentLongestRun && goalLongestRun >= 1) { // Min goal 1km
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
            const currentFastestPace = (typeof overallPRs.fastest5kPace?.value === 'number' && overallPRs.fastest5kPace.value !== Infinity) ? overallPRs.fastest5kPace.value : null; // Pace in s/m
            if (currentFastestPace) {
                const goalPace = currentFastestPace * 0.98; // Target 2% faster pace
                const formatPace = (paceSm: number): string => {
                    const paceMinKm = (paceSm * 1000) / 60;
                    const minutes = Math.floor(paceMinKm);
                    const seconds = Math.round((paceMinKm - minutes) * 60);
                    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
                };
                 addChallenge({
                    userId: userId, type: ChallengeType.DistancePace, status: ChallengeStatus.NotStarted,
                    metric: ChallengeMetric.Pace, unit: 's/m', title: `Faster 5k Pace`,
                    description: `Beat your 5k pace PR of ${formatPace(currentFastestPace)}. Target: ${formatPace(goalPace)}.`, // Store pace goal in s/m
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
            // Add Logging:
            console.log(`[MonthlyDistance Calc] Running Workouts (last 90d): ${runningWorkouts.length}`);
            // Ensure distance is treated as meters
            const distancesMeters = runningWorkouts.map(w => w.distance ?? 0);
            console.log(`[MonthlyDistance Calc] Distances (m): ${distancesMeters}`); 
            
            const totalDistanceMetersLast90d = distancesMeters.reduce((sum, dist) => sum + dist, 0);
            console.log(`[MonthlyDistance Calc] totalDistanceMetersLast90d: ${totalDistanceMetersLast90d}`); // Log total
            
            const avgMonthlyDistanceMeters = totalDistanceMetersLast90d / 3;
            console.log(`[MonthlyDistance Calc] avgMonthlyDistanceMeters: ${avgMonthlyDistanceMeters}`); // Log average
            
            // Calculate goal in METERS, round to nearest 5km (5000m), minimum 10km (10000m)
            const goalDistanceMeters = Math.max(10000, Math.ceil((avgMonthlyDistanceMeters * 1.1) / 5000) * 5000);
            console.log(`[MonthlyDistance Calc] Calculated Goal (m): ${goalDistanceMeters}`); 
            
            // Convert goal to KM for storage and display
            const goalDistanceKm = Math.round(goalDistanceMeters / 100) / 10; // Convert to km, round to 1 decimal place
            console.log(`[MonthlyDistance Calc] Final Goal (km): ${goalDistanceKm}`); 

             addChallenge({
                userId: userId, type: ChallengeType.MonthlyDistance, status: ChallengeStatus.NotStarted,
                metric: ChallengeMetric.Distance, unit: 'km', title: `Run ${goalDistanceKm}km Total`,
                description: `Accumulate ${goalDistanceKm}km running distance this month.`,
                goalValue: goalDistanceKm, // Store goal in KM
                startValue: 0, currentValue: 0,
                month: currentMonth, year: currentYear, exerciseId: null,
                completedAt: null, relatedWorkoutId: null,
             });
        } catch(e) { console.error("Error generating Monthly Distance challenge:", e); }

        // --- Monthly Lifting Volume --- (Skipped - calculatedVolume not available) 
        /* try {
            const strengthWorkouts = recentWorkouts.filter(w => w.type?.toLowerCase() === 'strength');
            const totalVolumeLast90d = strengthWorkouts.reduce((sum, w) => sum + (w.calculatedVolume ?? 0), 0);
            const avgMonthlyVolume = totalVolumeLast90d / 3;
            const goalVolume = Math.max(1000, Math.ceil((avgMonthlyVolume * 1.1) / 1000) * 1000); 
            if (avgMonthlyVolume > 0 || strengthWorkouts.length > 0) { 
                 addChallenge({
                    userId: userId, type: ChallengeType.MonthlyVolume, status: ChallengeStatus.NotStarted,
                    metric: ChallengeMetric.Volume, unit: 'kg', title: `Lift ${goalVolume}kg Total Volume`,
                    description: `Accumulate ${goalVolume}kg total lifting volume (sets*reps*weight) this month.`,
                    goalValue: goalVolume, startValue: 0, currentValue: 0,
                    month: currentMonth, year: currentYear, exerciseId: null,
                    completedAt: null, relatedWorkoutId: null,
                 });
             }
        } catch(e) { console.error("Error generating Monthly Volume challenge:", e); } */

        // --- Workout Frequency --- 
        try {
            const workoutsLastCalendarMonth = recentWorkouts.filter(w => { 
                 const workoutDate = new Date(w.date);
                 const prevMonth = (now.getMonth() === 0) ? 11 : now.getMonth() - 1;
                 const yearOfPrevMonth = (now.getMonth() === 0) ? now.getFullYear() - 1 : now.getFullYear();
                 return workoutDate.getMonth() === prevMonth && workoutDate.getFullYear() === yearOfPrevMonth;
            }).length;
            const goalFrequency = Math.max(4, Math.min(20, Math.ceil(workoutsLastCalendarMonth * 1.1) + 1)); // ~10% increase + 1, min 4, max 20
             addChallenge({
                 userId: userId, type: ChallengeType.WorkoutFrequency, status: ChallengeStatus.NotStarted,
                 metric: ChallengeMetric.Sessions, unit: 'sessions', title: `Complete ${goalFrequency} Workouts`,
                 description: `Log ${goalFrequency} workouts this month. (Last month: ${workoutsLastCalendarMonth})`,
                 goalValue: goalFrequency, startValue: 0, currentValue: 0,
                 month: currentMonth, year: currentYear, exerciseId: null,
                 completedAt: null, relatedWorkoutId: null,
             });
        } catch(e) { console.error("Error generating Frequency challenge:", e); }

         // --- Exercise Category Variety --- 
         try {
             const categoriesUsedLast90d = new Set<string>();
             recentWorkouts.forEach(w => {
                 w.exercises?.forEach(ex => {
                     if (ex.exercise?.category) {
                         categoriesUsedLast90d.add(ex.exercise.category.toLowerCase());
                     }
                 });
             });
             const goalCategories = categoriesUsedLast90d.size + 1; 
             if (categoriesUsedLast90d.size > 0 && categoriesUsedLast90d.size < 5) { // Only if some history exists and not already doing everything
                addChallenge({
                    userId: userId, type: ChallengeType.ExerciseVariety, status: ChallengeStatus.NotStarted,
                    metric: ChallengeMetric.Exercises, unit: 'categories', title: `Explore ${goalCategories} Exercise Categories`,
                    description: `Log workouts from ${goalCategories} different categories (e.g., strength, cardio, flexibility). You used ${categoriesUsedLast90d.size} recently.`,
                    goalValue: goalCategories, startValue: categoriesUsedLast90d.size, currentValue: 0, 
                    month: currentMonth, year: currentYear, exerciseId: null,
                    completedAt: null, relatedWorkoutId: null,
                });
             }
         } catch(e) { console.error("Error generating Variety challenge:", e); }

         // --- Workout Days this Month --- 
         try {
             const workoutDaysLastMonth = new Set(recentWorkouts
                 .filter(w => { 
                     const workoutDate = new Date(w.date);
                     const prevMonth = (now.getMonth() === 0) ? 11 : now.getMonth() - 1;
                     const yearOfPrevMonth = (now.getMonth() === 0) ? now.getFullYear() - 1 : now.getFullYear();
                     return workoutDate.getMonth() === prevMonth && workoutDate.getFullYear() === yearOfPrevMonth;
                 })
                 .map(w => new Date(w.date).toISOString().split('T')[0]) 
             ).size;
             const goalDays = Math.max(4, Math.min(25, Math.ceil(workoutDaysLastMonth * 1.1))); // ~10% increase, min 4, max 25
             addChallenge({
                 userId: userId, type: ChallengeType.ConsistencyStreak, // Re-using this type for simplicity
                 status: ChallengeStatus.NotStarted,
                 metric: ChallengeMetric.Days, unit: 'days', title: `Workout on ${goalDays} Different Days`,
                 description: `Log workouts on ${goalDays} separate days this month. (Last month: ${workoutDaysLastMonth} days)`,
                 goalValue: goalDays, startValue: 0, currentValue: 0,
                 month: currentMonth, year: currentYear, exerciseId: null,
                 completedAt: null, relatedWorkoutId: null,
             });
        } catch(e) { console.error("Error generating Workout Days challenge:", e); }
        
        // Ensure minimum number of challenges if possible? (Optional)
        // if (generatedChallengesData.length < 5) { /* Maybe add some generic ones */ }

        // --- Save Generated Challenges (using Prisma) ---
        if (generatedChallengesData.length > 0) {
            console.log(`[Challenges API] Saving ${generatedChallengesData.length} generated challenges...`);
            try {
                 await prisma.challenge.createMany({
                     data: generatedChallengesData,
                 });
                // Re-fetch challenges
                challenges = await prisma.challenge.findMany({
                    where: { userId: userId, year: currentYear, month: currentMonth },
                    orderBy: { type: 'asc' },
                });
                console.log(`[Challenges API] Successfully saved and re-fetched ${challenges.length} challenges.`);
            } catch (dbError) { 
                 console.error(`[Challenges API] Error saving generated challenges to Prisma:`, dbError);
                 return NextResponse.json({ error: 'Failed to save generated challenges' }, { status: 500 });
            }
        } else {
             console.log("[Challenges API] No challenges were generated based on current data/logic.");
        }
    } else {
         console.log(`[Challenges API] Found ${challenges.length} existing challenges for ${userId} for ${currentYear}-${currentMonth}.`);
    }

    // Return challenges
    return NextResponse.json(challenges);

  } catch (error) {
    console.error(`[Challenges API] Error processing challenges for user ${userId}:`, error);
    return NextResponse.json({ error: 'Failed to process challenges' }, { status: 500 });
  }
}

// --- DELETE Handler --- 
export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    console.log(`[Challenges API DELETE] Attempting to delete challenges for user ${userId} for ${currentYear}-${currentMonth}`);

    try {
        const deleteResult = await prisma.challenge.deleteMany({
            where: {
                userId: userId,
                year: currentYear,
                month: currentMonth,
            },
        });

        console.log(`[Challenges API DELETE] Deleted ${deleteResult.count} challenges for user ${userId}.`);

        // Revalidate the challenges path cache on the client-side if needed
        // This might not be strictly necessary if the client refetches immediately
        // revalidatePath('/challenges'); // Need to import from next/cache

        return NextResponse.json({ message: `Deleted ${deleteResult.count} challenges.` }, { status: 200 });

    } catch (error) {
        console.error(`[Challenges API DELETE] Error deleting challenges for user ${userId}:`, error);
        return NextResponse.json({ error: 'Failed to delete challenges' }, { status: 500 });
    }
}

// Optional: Add POST handler later if needed for creating/updating challenges manually 