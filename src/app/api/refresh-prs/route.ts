import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateExercisePRs, updateUserWorkoutSummaries } from '@/lib/workout-actions';
import { revalidatePath } from 'next/cache';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Update all PRs for the user
    await updateExercisePRs(userId);
    await updateUserWorkoutSummaries(userId);
    
    // Revalidate relevant paths
    revalidatePath('/dashboard');
    revalidatePath('/workouts');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Personal records refreshed successfully' 
    });
  } catch (error) {
    console.error('Error refreshing PRs:', error);
    return NextResponse.json({ 
      error: 'Failed to refresh personal records', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 