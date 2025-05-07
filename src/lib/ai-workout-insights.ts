"use server"

import { WorkoutExerciseData, Set } from "@/types/db"

/**
 * Generate insights about an exercise based on previous workout data
 * 
 * @param exerciseHistory The previous workout history for an exercise
 * @returns An object containing insights and suggestions
 */
export async function generateExerciseInsights(exerciseHistory: WorkoutExerciseData[]): Promise<{
  insight: string;
  suggestion: string;
  progressMetrics: {
    weightChange: number;
    weightChangePercent: number;
    repsChange: number;
    volumeChange: number;
    volumeChangePercent: number;
  };
}> {
  // Default response if not enough data
  const defaultResponse = {
    insight: "No previous workout data available for this exercise.",
    suggestion: "Focus on proper form and start with moderate weights.",
    progressMetrics: {
      weightChange: 0,
      weightChangePercent: 0,
      repsChange: 0,
      volumeChange: 0,
      volumeChangePercent: 0
    }
  }
  
  // Need at least one workout to provide insights
  if (!exerciseHistory || exerciseHistory.length === 0) {
    return defaultResponse
  }
  
  // Sort by date (newest first)
  const sortedHistory = [...exerciseHistory].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  
  // Only one workout history entry
  if (sortedHistory.length === 1) {
    return {
      insight: `You've done this exercise once before on ${formatDate(sortedHistory[0].createdAt)}.`,
      suggestion: "Try to match or slightly increase your previous weight or reps.",
      progressMetrics: {
        weightChange: 0,
        weightChangePercent: 0,
        repsChange: 0,
        volumeChange: 0,
        volumeChangePercent: 0
      }
    }
  }
  
  // Calculate metrics from last two workouts
  const latest = sortedHistory[0]
  const previous = sortedHistory[1]
  
  const latestMetrics = calculateWorkoutMetrics(latest.sets)
  const previousMetrics = calculateWorkoutMetrics(previous.sets)
  
  // Calculate changes
  const weightChange = latestMetrics.avgWeight - previousMetrics.avgWeight
  const weightChangePercent = (weightChange / previousMetrics.avgWeight) * 100
  
  const repsChange = latestMetrics.avgReps - previousMetrics.avgReps
  
  const volumeChange = latestMetrics.totalVolume - previousMetrics.totalVolume
  const volumeChangePercent = (volumeChange / previousMetrics.totalVolume) * 100
  
  // Generate insights based on data
  let insight = ""
  let suggestion = ""
  
  // Weight changes
  if (Math.abs(weightChange) < 0.5) {
    insight = "You maintained consistent weights in your last workout."
  } else if (weightChange > 0) {
    insight = `You increased weights by ${weightChange.toFixed(1)} kg (${weightChangePercent.toFixed(1)}%) in your last workout.`
  } else {
    insight = `You decreased weights by ${Math.abs(weightChange).toFixed(1)} kg (${Math.abs(weightChangePercent).toFixed(1)}%) in your last workout.`
  }
  
  // Volume changes
  if (volumeChange > 0) {
    insight += ` Overall volume increased by ${volumeChangePercent.toFixed(1)}%.`
  } else if (volumeChange < 0) {
    insight += ` Overall volume decreased by ${Math.abs(volumeChangePercent).toFixed(1)}%.`
  } else {
    insight += " Total workout volume stayed the same."
  }
  
  // Make suggestions based on data
  if (weightChange >= 2.5 || weightChangePercent >= 10) {
    suggestion = "Great progress! Consider focusing on maintaining good form at this new weight level."
  } else if (weightChange <= -2.5 || weightChangePercent <= -10) {
    suggestion = "You used less weight in your last workout. If this was intentional for form or recovery, that's good practice."
  } else if (Math.abs(weightChange) < 2.5 && sortedHistory.length >= 3) {
    suggestion = "Your weights have been consistent. Consider increasing by 2.5-5kg to continue progressive overload."
  } else {
    suggestion = "Try to gradually increase either weight or reps for continued progress."
  }
  
  return {
    insight,
    suggestion,
    progressMetrics: {
      weightChange,
      weightChangePercent,
      repsChange,
      volumeChange,
      volumeChangePercent
    }
  }
}

/**
 * Calculate average metrics from a set of exercise data
 */
function calculateWorkoutMetrics(sets: Set[]) {
  if (!sets || sets.length === 0) {
    return {
      avgWeight: 0,
      avgReps: 0,
      totalVolume: 0
    }
  }
  
  const totalWeight = sets.reduce((sum, set) => sum + (set.weight ?? 0), 0)
  const totalReps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0)
  const totalVolume = sets.reduce((sum, set) => sum + ((set.weight ?? 0) * (set.reps ?? 0)), 0)
  
  return {
    avgWeight: totalWeight / sets.length,
    avgReps: totalReps / sets.length,
    totalVolume
  }
}

/**
 * Format a date string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
} 