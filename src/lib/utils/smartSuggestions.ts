import { format, differenceInDays } from 'date-fns';
import type { DashboardMetrics } from '@/types/dashboard';
import type { WeeklyStats } from '@/lib/stats';
import type { WorkoutData } from '@/types/db';

export interface Suggestion {
  id: string;
  emoji: string;
  message: string;
  type: 'variety' | 'recovery' | 'volume' | 'consistency' | 'balance' | 'motivation';
  priority: 'high' | 'medium' | 'low';
}

interface SuggestionStats {
  metrics: DashboardMetrics;
  weeklyStats: WeeklyStats;
  recentWorkouts: WorkoutData[];
}

export function generateSuggestions(stats: SuggestionStats): Suggestion[] {
  const { metrics, weeklyStats, recentWorkouts } = stats;
  const allSuggestions: Suggestion[] = [];
  
  // Track which types we've already added to ensure diversity
  const addedTypes = new Set<string>();

  // Helper function to add suggestion if type not already used
  const addUniqueSuggestion = (suggestion: Suggestion) => {
    if (!addedTypes.has(suggestion.type)) {
      allSuggestions.push(suggestion);
      addedTypes.add(suggestion.type);
      return true;
    }
    return false;
  };

  // 1. CRITICAL RECOVERY CHECK (Highest Priority)
  const consecutiveDays = getConsecutiveWorkoutDays(recentWorkouts);
  if (consecutiveDays >= 5) {
    addUniqueSuggestion({
      id: 'urgent-recovery',
      emoji: '🛌',
      message: `${consecutiveDays} consecutive days training. Rest day is essential for recovery.`,
      type: 'recovery',
      priority: 'high'
    });
  }

  // 2. VOLUME SPIKE WARNING (High Priority)
  const volumeChange = metrics.strengthVolumePrevious7Days > 0 
    ? (metrics.strengthVolumeLast7Days - metrics.strengthVolumePrevious7Days) / metrics.strengthVolumePrevious7Days 
    : 0;
    
  if (volumeChange > 0.4 && !addedTypes.has('volume')) {
    addUniqueSuggestion({
      id: 'volume-spike',
      emoji: '⚖️',
      message: `Volume spiked ${Math.round(volumeChange * 100)}%. Focus on recovery and sleep quality.`,
      type: 'volume',
      priority: 'high'
    });
  }

  // 3. WORKOUT BALANCE ANALYSIS (Medium Priority)
  const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
  const strengthVolume = metrics.strengthVolumeLast7Days;
  
  // Only cardio, no strength
  if (totalCardio > 0 && strengthVolume === 0 && weeklyStats.workouts >= 3) {
    addUniqueSuggestion({
      id: 'add-strength',
      emoji: '💪',
      message: 'Add 2 strength sessions weekly to build muscle and prevent imbalances.',
      type: 'variety',
      priority: 'medium'
    });
  }
  // Only strength, no cardio
  else if (strengthVolume > 0 && totalCardio === 0 && weeklyStats.workouts >= 3) {
    addUniqueSuggestion({
      id: 'add-cardio',
      emoji: '❤️',
      message: 'Include cardio for heart health and improved recovery between lifts.',
      type: 'variety',
      priority: 'medium'
    });
  }
  // Running dominance
  else if (totalCardio > 0) {
    const runningRatio = metrics.runningDistanceLast7Days / totalCardio;
    if (runningRatio >= 0.85 && totalCardio > 8) {
      addUniqueSuggestion({
        id: 'vary-cardio',
        emoji: '🚴',
        message: 'Mix in cycling or swimming to prevent running overuse injuries.',
        type: 'variety',
        priority: 'medium'
      });
    }
  }

  // 4. CONSISTENCY PATTERNS (Medium Priority)
  if (weeklyStats.workouts <= 2 && metrics.previousWorkoutCount >= 4) {
    addUniqueSuggestion({
      id: 'consistency-drop',
      emoji: '📈',
      message: 'Workout frequency dropped. Try scheduling 3-4 sessions this week.',
      type: 'consistency',
      priority: 'medium'
    });
  } else if (weeklyStats.workouts === 1 && weeklyStats.duration > 90) {
    addUniqueSuggestion({
      id: 'split-sessions',
      emoji: '📅',
      message: 'Split that long session into 2-3 shorter workouts for better results.',
      type: 'consistency',
      priority: 'medium'
    });
  }

  // 5. PERFORMANCE INSIGHTS (Low-Medium Priority)
  const avgDuration = weeklyStats.workouts > 0 ? weeklyStats.duration / weeklyStats.workouts : 0;
  if (avgDuration > 0) {
    if (avgDuration > 120 && weeklyStats.workouts >= 3) {
      addUniqueSuggestion({
        id: 'long-sessions',
        emoji: '⏱️',
        message: 'Sessions averaging 2+ hours. Consider 60-90 min for sustainability.',
        type: 'balance',
        priority: 'low'
      });
    } else if (avgDuration < 25 && weeklyStats.workouts < 5) {
      addUniqueSuggestion({
        id: 'extend-sessions',
        emoji: '🎯',
        message: 'Short sessions detected. Aim for 30-45 minutes for better adaptations.',
        type: 'balance',
        priority: 'low'
      });
    }
  }

  // 6. POSITIVE MOTIVATION (Always different scenarios)
  if (!addedTypes.has('motivation')) {
    if (weeklyStats.workouts >= 4 && volumeChange >= 0.1) {
      addUniqueSuggestion({
        id: 'crushing-it',
        emoji: '🔥',
        message: `${weeklyStats.workouts} workouts with volume progression. You're crushing it!`,
        type: 'motivation',
        priority: 'low'
      });
    } else if (metrics.workoutCount <= 15 && weeklyStats.workouts >= 2) {
      addUniqueSuggestion({
        id: 'building-habit',
        emoji: '🌱',
        message: 'Habit forming nicely! Consistency beats intensity at this stage.',
        type: 'motivation',
        priority: 'low'
      });
    } else if (weeklyStats.workouts >= 3 && weeklyStats.workouts <= 5) {
      addUniqueSuggestion({
        id: 'sweet-spot',
        emoji: '✨',
        message: `${weeklyStats.workouts} workouts weekly hits the sweet spot for sustainable progress.`,
        type: 'motivation',
        priority: 'low'
      });
    }
  }

  // 7. FALLBACK SUGGESTIONS for edge cases
  if (allSuggestions.length === 0) {
    if (weeklyStats.workouts === 0) {
      allSuggestions.push({
        id: 'get-started',
        emoji: '🚀',
        message: 'Start with 2-3 workouts this week to build momentum.',
        type: 'consistency',
        priority: 'medium'
      });
    } else {
      allSuggestions.push({
        id: 'keep-going',
        emoji: '💫',
        message: 'Keep the momentum going! Track your next session for insights.',
        type: 'motivation',
        priority: 'low'
      });
    }
  }

  // Ensure we have exactly 2 different suggestions
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const sortedSuggestions = allSuggestions
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  // Take top 2, ensuring they're different types
  const finalSuggestions = [];
  const usedTypes = new Set();
  
  for (const suggestion of sortedSuggestions) {
    if (!usedTypes.has(suggestion.type) && finalSuggestions.length < 2) {
      finalSuggestions.push(suggestion);
      usedTypes.add(suggestion.type);
    }
  }

  // If we still need more suggestions and have fewer than 2, add from remaining
  if (finalSuggestions.length < 2 && sortedSuggestions.length > finalSuggestions.length) {
    for (const suggestion of sortedSuggestions) {
      if (!finalSuggestions.find(s => s.id === suggestion.id) && finalSuggestions.length < 2) {
        finalSuggestions.push(suggestion);
      }
    }
  }

  return finalSuggestions;
}

function getConsecutiveWorkoutDays(workouts: WorkoutData[]): number {
  if (workouts.length === 0) return 0;
  
  // Sort workouts by date (most recent first)
  const sortedWorkouts = workouts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Get unique workout dates
  const workoutDates = Array.from(new Set(
    sortedWorkouts.map(w => format(new Date(w.date), 'yyyy-MM-dd'))
  )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let consecutive = 0;
  const today = new Date();

  for (let i = 0; i < workoutDates.length; i++) {
    const workoutDate = new Date(workoutDates[i]);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    
    const daysDiff = Math.abs(differenceInDays(workoutDate, expectedDate));
    
    if (daysDiff === 0) {
      consecutive++;
    } else {
      break;
    }
  }
  
  return consecutive;
} 