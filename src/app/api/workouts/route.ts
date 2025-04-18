import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getWorkoutsByUserId } from '@/lib/db/repositories/workoutRepository';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * GET /api/workouts - Fetch workouts for the current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[API /workouts] Fetching workouts for user: ${session.user.id}`);
    // Fetch workouts using the same repository function used by the page
    // Note: Consider adding pagination query parameters here later (e.g., ?limit=50&skip=0)
    const workouts = await getWorkoutsByUserId(session.user.id); 
    console.log(`[API /workouts] Fetched ${workouts.length} workouts.`);

    return NextResponse.json(workouts);

  } catch (error) {
    console.error("[API /workouts] Error fetching workouts:", error);
    return NextResponse.json(
        { error: "Failed to fetch workouts" }, 
        { status: 500 }
    );
  }
} 