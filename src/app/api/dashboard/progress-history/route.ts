import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionsInLastNDays } from '@/lib/dashboard-logic';
import { startOfWeek, endOfWeek, subWeeks, format, eachWeekOfInterval } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get data for the last 12 weeks
    const weeks = 12;
    const endDate = new Date();
    const startDate = subWeeks(endDate, weeks - 1);
    
    // Get all weeks in the interval
    const weekDates = eachWeekOfInterval({ 
      start: startDate, 
      end: endDate 
    }, { weekStartsOn: 1 }); // Start week on Monday

    // Fetch all workouts for the period
    const allWorkouts = await getSessionsInLastNDays(weeks * 7);

    // Group workouts by week and calculate stats
    const weeklyData = weekDates.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Filter workouts for this week
      const weekWorkouts = allWorkouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        return workoutDate >= weekStart && workoutDate <= weekEnd;
      });

      // Calculate weekly stats
      const weekStats = {
        week: format(weekStart, 'MMM dd'),
        weekStart: weekStart.toISOString(),
        workouts: weekWorkouts.length,
        duration: weekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0), // in minutes
        distance: weekWorkouts.reduce((sum, w) => {
          // Normalize distance to km (consistent with other components)
          let distance = w.cardioDetails?.distance || w.distance || 0;
          if (distance > 100) distance = distance / 1000; // Convert meters to km
          return sum + distance;
        }, 0), // in km
        volume: weekWorkouts.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0) // in kg
      };

      return weekStats;
    });

    return NextResponse.json({ weeklyData });

  } catch (error) {
    console.error('Error fetching progress history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress history' }, 
      { status: 500 }
    );
  }
} 