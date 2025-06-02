import { format, subDays, startOfDay } from 'date-fns';

/**
 * Calculate the current workout streak based on session dates
 * @param dates Array of workout dates in string format (YYYY-MM-DD)
 * @returns Number of consecutive days with workouts (including today if there's a workout)
 */
export function getCurrentStreak(dates: string[]): number {
  const today = startOfDay(new Date());
  let streak = 0;

  // Convert dates to Set for faster lookup
  const dateSet = new Set(dates);

  for (let i = 0; i < 30; i++) {
    const day = subDays(today, i);
    const dayString = format(day, 'yyyy-MM-dd');
    
    if (dateSet.has(dayString)) {
      streak += 1;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Get motivational message based on streak length
 * @param streak Current streak number
 * @returns Object with emoji and message
 */
export function getStreakMessage(streak: number): { emoji: string; message: string } {
  if (streak === 0) {
    return {
      emoji: '🎯',
      message: 'Ready to start a new streak?'
    };
  }
  
  if (streak === 1) {
    return {
      emoji: '✨',
      message: '1-day streak – great start!'
    };
  }
  
  if (streak === 2) {
    return {
      emoji: '🌟',
      message: '2-day streak – building momentum!'
    };
  }
  
  if (streak >= 3 && streak <= 6) {
    return {
      emoji: '🔥',
      message: `${streak}-day streak – you're on a roll!`
    };
  }
  
  if (streak >= 7 && streak <= 13) {
    return {
      emoji: '💪',
      message: `${streak}-day streak – unstoppable!`
    };
  }
  
  if (streak >= 14 && streak <= 20) {
    return {
      emoji: '🚀',
      message: `${streak}-day streak – legendary consistency!`
    };
  }
  
  if (streak >= 21) {
    return {
      emoji: '👑',
      message: `${streak}-day streak – fitness royalty!`
    };
  }
  
  return {
    emoji: '🔥',
    message: `${streak}-day streak – incredible!`
  };
} 