import { WorkoutData } from '@/types/db';
import { getUserWorkoutsByDateRange } from '@/lib/db/repositories/workoutRepository';
import { ExercisePRData, ExerciseData } from '@/types/db';
// import { getExercisePRsForPeriod } from '@/lib/db/repositories/exercisePRRepository'; // Assuming this exists - Commented for now
// import { getExercisesByIds } from '@/lib/db/repositories/exerciseRepository'; // Assuming this exists - Commented for now

export type WeeklyAggregates = {
  totalVolumeKg: number;
  totalCardioMinutes: number; // Duration in minutes
  workoutCount: number;
};

// Helper to get the start of a given day (UTC)
const getStartOfDayUTC = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Helper to get the end of a given day (UTC)
const getEndOfDayUTC = (date: Date): Date => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * Calculates aggregate workout data for a user for a specific full week (Monday to Sunday).
 * @param userId The ID of the user.
 * @param dateInWeek A date within the target week. The function will find the Monday of this week.
 * @returns Promise<WeeklyAggregates>
 */
export async function calculateFullWeekAggregates(
  userId: string,
  dateInWeek: Date 
): Promise<WeeklyAggregates> {
  const targetDate = new Date(dateInWeek);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0, ..., Sun=6

  const monday = getStartOfDayUTC(targetDate);
  monday.setUTCDate(targetDate.getUTCDate() - adjustedDay);

  const sunday = getEndOfDayUTC(new Date(monday));
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const workoutsInPeriod = await getUserWorkoutsByDateRange(userId, monday, sunday);

  let totalVolumeKg = 0;
  let totalCardioSeconds = 0;
  const cardioTypes = ['running', 'cycling', 'swimming', 'rowing', 'cardio', 'hiit', 'walking'];

  for (const workout of workoutsInPeriod) {
    totalVolumeKg += workout.calculatedVolume || 0;
    if (workout.type && cardioTypes.includes(workout.type.toLowerCase())) {
      totalCardioSeconds += workout.duration || 0; // Assuming duration is in seconds
    }
  }

  return {
    totalVolumeKg,
    totalCardioMinutes: Math.round(totalCardioSeconds / 60),
    workoutCount: workoutsInPeriod.length,
  };
}

/**
 * Calculates aggregate workout data for a user for the current week up to today.
 * Week starts on Monday.
 * @param userId The ID of the user.
 * @param today The current date (or the reference end date for the partial week).
 * @returns Promise<WeeklyAggregates>
 */
export async function calculateCurrentWeekToDateAggregates(
  userId: string,
  today: Date
): Promise<WeeklyAggregates> {
  const currentD = new Date(today);
  const dayOfWeek = currentD.getUTCDay(); 
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 

  const monday = getStartOfDayUTC(currentD);
  monday.setUTCDate(currentD.getUTCDate() - adjustedDay);
  
  const endDate = getEndOfDayUTC(currentD); // End of 'today'

  const workoutsInPeriod = await getUserWorkoutsByDateRange(userId, monday, endDate);

  let totalVolumeKg = 0;
  let totalCardioSeconds = 0;
  const cardioTypes = ['running', 'cycling', 'swimming', 'rowing', 'cardio', 'hiit', 'walking'];

  for (const workout of workoutsInPeriod) {
    totalVolumeKg += workout.calculatedVolume || 0;
    if (workout.type && cardioTypes.includes(workout.type.toLowerCase())) {
      totalCardioSeconds += workout.duration || 0; // Assuming duration is in seconds
    }
  }

  return {
    totalVolumeKg,
    totalCardioMinutes: Math.round(totalCardioSeconds / 60),
    workoutCount: workoutsInPeriod.length,
  };
}

export type FormattedRepPREntry = {
  exerciseName: string;
  reps: number;
  date: Date;
  exerciseId?: string; // Made optional, include if needed by caller
};

/**
 * Fetches and formats new rep PRs for a user within a given period.
 * (Currently uses MOCK DATA - real implementation is commented out pending repository creation)
 * @param userId 
 * @param startDate 
 * @param endDate 
 * @returns 
 */
export async function getFormattedNewRepPRsForPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<FormattedRepPREntry[]> {
  
  // MOCK IMPLEMENTATION 
  if (userId === 'triggerMockPRs') { 
    console.warn("[user-period-metrics] Using MOCKED PR data for getFormattedNewRepPRsForPeriod");
    return [
      { exerciseName: 'Mock Bench Press', reps: 10, date: new Date(new Date(endDate).setDate(endDate.getDate()-1)), exerciseId: 'mockExercise1' },
      { exerciseName: 'Mock Squat', reps: 5, date: new Date(new Date(endDate).setDate(endDate.getDate()-2)), exerciseId: 'mockExercise2' },
    ];
  }

  /* // ACTUAL IMPLEMENTATION - Commented out until dependencies (exercisePRRepository, getExercisesByIds) are available
  // Ensure ExercisePRData and ExerciseData types are correctly defined in @/types/db.ts
  // Ensure getExercisePRsForPeriod and getExercisesByIds are implemented in their respective repositories.
  
  const prs: ExercisePRData[] = await getExercisePRsForPeriod(userId, startDate, endDate);
  const repPRs = prs.filter(pr => pr.type === 'reps' && typeof pr.value === 'number' && pr.value > 0 && pr.exerciseId);

  if (repPRs.length === 0) {
    return [];
  }

  const exerciseIdsAsString: string[] = repPRs.map(pr => pr.exerciseId.toString());
  const exercises: ExerciseData[] = await getExercisesByIds(exerciseIdsAsString); 
  const exerciseMap = new Map(exercises.map((ex: ExerciseData) => [ex._id.toString(), ex.name]));

  return repPRs.map((pr: ExercisePRData) => ({
    exerciseName: exerciseMap.get(pr.exerciseId.toString()) || 'Unknown Exercise',
    reps: pr.value as number, 
    date: new Date(pr.date),
    exerciseId: pr.exerciseId.toString(),
  }));
  */
 return []; // Default: Return empty array if not using mock and real implementation is commented
} 