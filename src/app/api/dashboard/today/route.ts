import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserWorkoutsByDateRange } from '@/lib/db/repositories/workoutRepository';
import type { WorkoutData } from '@/types/db';

// Force dynamic execution and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();
  
  // Define start and end of today
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`[API /dashboard/today] Fetching workouts for user ${userId} for today: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

  try {
    // Use existing repository function
    const todaysWorkouts: WorkoutData[] = await getUserWorkoutsByDateRange(userId, startOfDay, endOfDay);
    console.log(`[API /dashboard/today] Found ${todaysWorkouts.length} workouts for today.`);
    
    return NextResponse.json(todaysWorkouts);

  } catch (error) {
    console.error(`[API /dashboard/today] Error fetching today's workouts:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: "Failed to fetch today's workouts", details: errorMessage }, { status: 500 });
  }
} 