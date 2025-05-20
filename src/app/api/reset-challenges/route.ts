import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, ChallengeStatus } from '@prisma/client';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

/**
 * POST /api/reset-challenges
 * Resets challenge progress after workouts are deleted.
 * This endpoint will:
 * 1. Find all active challenges for the current user and month
 * 2. Reset their currentValue to match startValue (or 0)
 * 3. Reset status to NotStarted
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[reset-challenges] Processing reset request');
    
    // Get authenticated user from session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('[reset-challenges] No authenticated user');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Get current month/year for challenges
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
    const currentYear = now.getFullYear();
    
    console.log(`[reset-challenges] Resetting challenges for user ${userId} for ${currentYear}-${currentMonth}`);

    // Find all active challenges for the current month
    const challenges = await prisma.challenge.findMany({
      where: { 
        userId: userId, 
        year: currentYear, 
        month: currentMonth
      }
    });
    
    if (challenges.length === 0) {
      console.log(`[reset-challenges] No challenges found for user ${userId}`);
      return NextResponse.json({
        success: true,
        message: 'No challenges found to reset',
        resetCount: 0
      });
    }
    
    console.log(`[reset-challenges] Found ${challenges.length} challenges to reset`);
    
    // Reset each challenge
    const resetPromises = challenges.map(challenge => {
      return prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          // Reset currentValue to startValue (or 0 if startValue is null)
          currentValue: challenge.startValue ?? 0,
          // Reset status to NotStarted
          status: ChallengeStatus.NotStarted,
          // Clear completion data
          completedAt: null,
          relatedWorkoutId: null
        }
      });
    });
    
    // Execute all update operations
    await Promise.all(resetPromises);
    
    console.log(`[reset-challenges] Successfully reset ${challenges.length} challenges`);
    
    return NextResponse.json({
      success: true,
      message: `Reset ${challenges.length} challenges`,
      resetCount: challenges.length
    });
    
  } catch (error) {
    console.error('[reset-challenges] Error resetting challenges:', error);
    return NextResponse.json(
      { error: 'Failed to reset challenges. Please try again.' },
      { status: 500 }
    );
  }
} 