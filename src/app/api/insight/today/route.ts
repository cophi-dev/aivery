import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserWorkoutsByDateRange } from '@/lib/db/repositories/workoutRepository';
import { callLLM, LLMProvider } from '@/lib/services/llm';
import type { WorkoutData } from '@/types/db';

// Ensure the route is always dynamic
export const dynamic = 'force-dynamic';

// Helper to get recent user workout data
async function getRecentUserData(userId: string) {
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  
  try {
    const workouts = await getUserWorkoutsByDateRange(userId, threeDaysAgo, today);
    
    // Calculate basic stats
    const totalWorkouts = workouts.length;
    const workoutTypes = Array.from(new Set(workouts.map(w => w.type)));
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalVolume = workouts.reduce((sum, w) => sum + (w.calculatedVolume || 0), 0);
    
    // Check for streak (simplified)
    const hasWorkoutToday = workouts.some(w => {
      const workoutDate = new Date(w.date);
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      return workoutDate >= todayStart;
    });
    
    return {
      totalWorkouts,
      workoutTypes,
      totalDuration: Math.round(totalDuration / 60), // minutes
      totalVolume: Math.round(totalVolume),
      hasWorkoutToday,
      lastWorkout: workouts.length > 0 ? {
        type: workouts[0].type,
        date: workouts[0].date,
        duration: Math.round((workouts[0].duration || 0) / 60)
      } : null
    };
  } catch (error) {
    console.error('Error fetching recent user data:', error);
    return {
      totalWorkouts: 0,
      workoutTypes: [],
      totalDuration: 0,
      totalVolume: 0,
      hasWorkoutToday: false,
      lastWorkout: null
    };
  }
}

// Helper to generate smart encouraging messages based on user data
function generateSmartMessage(data: any): string {
  const { totalWorkouts, workoutTypes, hasWorkoutToday } = data;
  
  if (totalWorkouts === 0) {
    return "Welcome! Once you log your first few workouts, I'll share trends and helpful nudges here.";
  }
  
  if (hasWorkoutToday) {
    const typeText = workoutTypes.length > 1 ? 'mixed training' : workoutTypes[0];
    return `Already crushed ${typeText} today - you're on fire! 🔥`;
  }
  
  // No workout today but has recent activity
  if (totalWorkouts >= 4) {
    const types = workoutTypes.join(' & ');
    return `${totalWorkouts} ${types} sessions in 3 days - keep the momentum going!`;
  } else if (totalWorkouts >= 2) {
    const types = workoutTypes.join(' & ');
    return `Great ${types} progress this week - time to add today's session!`;
  } else {
    return `You've got this - ready to build on yesterday's progress?`;
  }
}

// Better message extraction from reasoning content
function extractMessageFromReasoning(reasoning: string): string | null {
  try {
    // Look for common patterns in reasoning that indicate the final message
    const patterns = [
      /["']([^"']{10,80}!)["']/g, // Quoted messages ending with !
      /(?:message|say|response|reply):\s*["']?([^"'\n]{10,80}!)["']?/gi,
      /(?:encourage|motivate).*?["']([^"']{10,80})["']/gi,
      /^([A-Z][^.!?]{10,80}[!.])$/gm // Standalone sentences
    ];
    
    for (const pattern of patterns) {
      const matches = Array.from(reasoning.matchAll(pattern));
      for (const match of matches) {
        const candidate = match[1]?.trim();
        if (candidate && 
            candidate.length >= 10 && 
            candidate.length <= 80 &&
            !candidate.toLowerCase().includes('token') &&
            !candidate.toLowerCase().includes('character') &&
            !candidate.toLowerCase().includes('system') &&
            !candidate.toLowerCase().includes('reasoning')) {
          return candidate;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[INSIGHT/TODAY] Error extracting from reasoning:', error);
    return null;
  }
}

export async function GET(req: Request) {
  console.log('[INSIGHT/TODAY] API called at:', new Date().toISOString());
  
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.log('[INSIGHT/TODAY] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    console.log('[INSIGHT/TODAY] Fetching data for user:', userId);
    
    const recentData = await getRecentUserData(userId);
    console.log('[INSIGHT/TODAY] Recent data:', JSON.stringify(recentData, null, 2));
    
    // Always use the smart message generator for now to avoid LLM issues
    const message = generateSmartMessage(recentData);
    console.log('[INSIGHT/TODAY] Using smart message:', message);
    
    return NextResponse.json({ message });
    
  } catch (error) {
    console.error('[INSIGHT/TODAY] Error generating daily insight:', error);
    return NextResponse.json({
      message: "Every day is a new opportunity for progress."
    });
  }
} 