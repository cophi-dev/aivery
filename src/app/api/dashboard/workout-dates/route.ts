import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionsInLastNDays } from '@/lib/dashboard-logic';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get workouts from the last 30 days for streak calculation
    const recentWorkouts = await getSessionsInLastNDays(30);
    
    // Extract unique workout dates (YYYY-MM-DD format)
    const workoutDates = recentWorkouts.map(workout => {
      const workoutDate = new Date(workout.date);
      return format(workoutDate, 'yyyy-MM-dd');
    });

    // Remove duplicates (in case there are multiple workouts on the same day)
    const uniqueDates = Array.from(new Set(workoutDates));

    return NextResponse.json({ dates: uniqueDates });

  } catch (error) {
    console.error('Error fetching workout dates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workout dates' }, 
      { status: 500 }
    );
  }
} 