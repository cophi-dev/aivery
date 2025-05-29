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
    return "Today is perfect for starting your fitness journey!";
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
    
    // Try system message to force direct response
    const userMessage = `${recentData.totalWorkouts} workouts in 3 days: ${recentData.workoutTypes.join(', ')}. ${recentData.hasWorkoutToday ? 'Already worked out today!' : 'No workout today yet.'}`;

    // Use the specific insight model configuration from env
    const provider = (process.env.LLM_PROVIDER_INSIGHT as LLMProvider) || (process.env.LLM_PROVIDER as LLMProvider) || 'grok';
    const model = process.env.LLM_MODEL_INSIGHT || 'grok-3-mini-latest';
    
    console.log('[INSIGHT/TODAY] Using provider:', provider, 'model:', model);
    
    const response = await callLLM({
      provider,
      model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a supportive fitness buddy. Reply with ONLY one encouraging message under 100 characters. No explanations, no reasoning, just the message.' 
        },
        { 
          role: 'user', 
          content: userMessage 
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: false,
      fallbackResponse: recentData.totalWorkouts > 0 
        ? `${recentData.totalWorkouts} workouts recently - you're building great momentum!`
        : "Today is a perfect day to start your fitness journey!"
    });

    console.log('[INSIGHT/TODAY] LLM response received:', JSON.stringify(response, null, 2));

    // Extract message - handle both content and reasoning
    let message = "Stay consistent with your fitness goals.";
    
    if (response.choices?.[0]?.message?.content?.trim()) {
      message = response.choices[0].message.content.trim();
      console.log('[INSIGHT/TODAY] Using direct content:', message);
    } else if (response.choices?.[0]?.message?.reasoning_content) {
      // If still in reasoning mode, try to extract the final message
      const reasoning = response.choices[0].message.reasoning_content;
      console.log('[INSIGHT/TODAY] Still in reasoning mode, extracting final message...');
      console.log('[INSIGHT/TODAY] Reasoning content:', reasoning);
      
      // Look for the actual encouraging message at the end of reasoning
      // Often Grok puts the final answer at the end
      const sentences = reasoning.split(/[.!?]/);
      const lastSentences = sentences.slice(-5); // Get last 5 sentences
      
      const goodMessage = lastSentences.find((s: string) => {
        const clean = s.trim();
        return clean.length > 10 && clean.length < 100 && 
               clean.toLowerCase().includes('workout') &&
               !clean.includes('characters') &&
               !clean.includes('token') &&
               !clean.includes('need to') &&
               (clean.toLowerCase().includes('great') ||
                clean.toLowerCase().includes('awesome') ||
                clean.toLowerCase().includes('keep') ||
                clean.toLowerCase().includes('way') ||
                clean.toLowerCase().includes('love') ||
                clean.toLowerCase().includes('nice'));
      });
      
      if (goodMessage) {
        message = goodMessage.trim() + '!';
        console.log('[INSIGHT/TODAY] Extracted from reasoning end:', message);
      } else {
        // Use smart message generator based on user data
        message = generateSmartMessage(recentData);
        console.log('[INSIGHT/TODAY] Using smart fallback:', message);
      }
    } else {
      // Use smart message generator for any LLM failure
      message = generateSmartMessage(recentData);
      console.log('[INSIGHT/TODAY] Using smart message due to LLM failure:', message);
    }

    console.log('[INSIGHT/TODAY] Final message:', message);
    return NextResponse.json({ message });
    
  } catch (error) {
    console.error('[INSIGHT/TODAY] Error generating daily insight:', error);
    return NextResponse.json({
      message: "Every day is a new opportunity for progress."
    });
  }
} 