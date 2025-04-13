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
    
    // Return all workouts to let the metrics calculation handle the filtering
    return NextResponse.json({ workouts });

  } catch (error) {
    console.error("[API Route /api/dashboard-workouts] Error fetching dashboard workouts:", error);
    // Return a generic error response
    return NextResponse.json({ error: 'Failed to fetch dashboard workout data' }, { status: 500 });
  }
} 