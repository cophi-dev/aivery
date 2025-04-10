import { NextResponse } from 'next/server';
import { fetchWorkouts } from '@/lib/workout-actions';
import { getCurrentUser } from "@/lib/auth";

// Ensure this route is never cached
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log("[API Route /api/dashboard-workouts] Received GET request");
  try {
    // Optional: Add authentication check here if needed, 
    // although fetchWorkouts already checks internally.
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("[API Route /api/dashboard-workouts] Unauthorized access attempt.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log("[API Route /api/dashboard-workouts] Calling fetchWorkouts...");
    const workouts = await fetchWorkouts(); // fetchWorkouts handles user filtering
    console.log(`[API Route /api/dashboard-workouts] fetchWorkouts returned ${workouts.length} workouts.`);
    
    // Add date range information for debugging
    if (workouts.length > 0) {
      const dates = workouts.map(w => w.date).sort();
      console.log(`[API Route /api/dashboard-workouts] Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      
      // Check for recent workouts (from April 2025)
      const recentWorkouts = workouts.filter(w => w.date && w.date.includes('2025-04'));
      console.log(`[API Route /api/dashboard-workouts] Recent workouts (April 2025): ${recentWorkouts.length}`);
      
      // Check for workouts in the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const last7DaysWorkouts = workouts.filter(w => w.date && w.date >= oneWeekAgoStr);
      console.log(`[API Route /api/dashboard-workouts] Workouts in last 7 days (>= ${oneWeekAgoStr}): ${last7DaysWorkouts.length}`);
    }
    
    // Return the workouts as JSON
    return NextResponse.json({ workouts });

  } catch (error) {
    console.error("[API Route /api/dashboard-workouts] Error fetching dashboard workouts:", error);
    // Return a generic error response
    return NextResponse.json({ error: 'Failed to fetch dashboard workout data' }, { status: 500 });
  }
} 