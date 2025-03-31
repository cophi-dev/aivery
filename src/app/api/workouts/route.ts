import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkoutsByUserId } from '@/lib/db/repositories/workoutRepository';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * GET /api/workouts - Fetch workouts for the current user
 */
export async function GET(req: NextRequest) {
  // Get the session - check if user is authenticated
  const session = await getServerSession(authOptions);
  
  // If no session, return 401 Unauthorized
  if (!session || !session.user) {
    console.log('[API] No valid session - unauthorized access to workouts');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get user ID from session
    const userId = session.user.id;
    console.log(`[API] Fetching workouts for user ${userId}`);
    
    // Get workouts for the user
    const workouts = await getWorkoutsByUserId(userId);
    
    // Return workouts
    return NextResponse.json(workouts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching workouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workouts' },
      { status: 500 }
    );
  }
} 