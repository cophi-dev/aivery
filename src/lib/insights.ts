import type { WeeklyStats } from './stats';

export interface SmartNudge {
  message: string;
  type: 'achievement' | 'encouragement' | 'suggestion' | 'celebration';
  priority: number; // 1-5, higher is more important
  emoji?: string;
}

/**
 * Generates smart nudges based on weekly stats to provide personalized insights
 */
export function getSmartNudges(stats: WeeklyStats, previousStats?: WeeklyStats): SmartNudge[] {
  const nudges: SmartNudge[] = [];

  // Celebration nudges for achievements
  if (stats.workouts >= 5) {
    nudges.push({
      message: "You're crushing it! 5+ workouts this week — keep the flow going.",
      type: 'celebration',
      priority: 5,
      emoji: '🔥'
    });
  }

  if (stats.distance > 15) {
    nudges.push({
      message: `Great endurance! You've covered ${stats.distance.toFixed(1)} km this week.`,
      type: 'achievement',
      priority: 4,
      emoji: '🏃‍♂️'
    });
  }

  if (stats.volume > 20) {
    nudges.push({
      message: "You're building real strength. Impressive training volume this week!",
      type: 'achievement',
      priority: 4,
      emoji: '💪'
    });
  }

  // Progress-based nudges (compare with previous week if available)
  if (previousStats) {
    const workoutIncrease = stats.workouts - previousStats.workouts;
    const volumeIncrease = stats.volume - previousStats.volume;
    const durationIncrease = stats.duration - previousStats.duration;

    if (workoutIncrease >= 2) {
      nudges.push({
        message: `Fantastic consistency! You increased your workout frequency by ${workoutIncrease} sessions.`,
        type: 'celebration',
        priority: 5,
        emoji: '📈'
      });
    }

    if (volumeIncrease > 5) {
      nudges.push({
        message: `Strength gains incoming! You lifted ${volumeIncrease.toFixed(1)} tons more than last week.`,
        type: 'achievement',
        priority: 4,
        emoji: '⚡'
      });
    }

    if (durationIncrease > 60) {
      nudges.push({
        message: `Endurance building! You added ${Math.round(durationIncrease)} minutes to your training this week.`,
        type: 'achievement',
        priority: 4,
        emoji: '⏱️'
      });
    }
  }

  // Encouragement nudges for lower activity
  if (stats.workouts === 0) {
    nudges.push({
      message: "Every journey starts with a single step. Ready to log your first workout?",
      type: 'encouragement',
      priority: 3,
      emoji: '🌟'
    });
  } else if (stats.workouts >= 1 && stats.workouts <= 2) {
    nudges.push({
      message: "Great start! A few more sessions this week will build excellent momentum.",
      type: 'encouragement',
      priority: 3,
      emoji: '🎯'
    });
  }

  if (stats.duration < 60 && stats.workouts > 0) {
    nudges.push({
      message: "Just getting started this week. Let's add a bit more movement tomorrow?",
      type: 'suggestion',
      priority: 2,
      emoji: '🚀'
    });
  }

  // Weekly milestone nudges
  if (stats.workouts === 3) {
    nudges.push({
      message: "Halfway to an amazing week! 3 workouts down, momentum building.",
      type: 'encouragement',
      priority: 3,
      emoji: '🎪'
    });
  }

  if (stats.workouts === 7) {
    nudges.push({
      message: "Perfect week! 7 workouts shows incredible dedication.",
      type: 'celebration',
      priority: 5,
      emoji: '👑'
    });
  }

  // Special combination nudges
  if (stats.distance > 10 && stats.volume > 15) {
    nudges.push({
      message: "Complete athlete! You're excelling in both cardio and strength training.",
      type: 'celebration',
      priority: 5,
      emoji: '🏆'
    });
  }

  // Consistency nudges
  if (previousStats && stats.workouts >= 3 && previousStats.workouts >= 3) {
    nudges.push({
      message: "Consistency champion! Two strong weeks in a row builds lasting habits.",
      type: 'achievement',
      priority: 4,
      emoji: '⚡'
    });
  }

  // Fallback encouragement
  if (nudges.length === 0) {
    nudges.push({
      message: "Stay consistent, one step at a time. Every workout counts!",
      type: 'encouragement',
      priority: 1,
      emoji: '💫'
    });
  }

  // Sort by priority (highest first) and return top nudges
  return nudges.sort((a, b) => b.priority - a.priority);
}

/**
 * Gets the best nudge to display (highest priority)
 */
export function getBestNudge(stats: WeeklyStats, previousStats?: WeeklyStats): SmartNudge {
  const nudges = getSmartNudges(stats, previousStats);
  return nudges[0] || {
    message: "Keep moving forward, one workout at a time!",
    type: 'encouragement',
    priority: 1,
    emoji: '✨'
  };
}

/**
 * Gets multiple nudges for a richer insight experience
 */
export function getTopNudges(stats: WeeklyStats, previousStats?: WeeklyStats, count: number = 2): SmartNudge[] {
  const nudges = getSmartNudges(stats, previousStats);
  return nudges.slice(0, count);
} 