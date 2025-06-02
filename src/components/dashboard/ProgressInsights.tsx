'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import InsightCard from './InsightCard';

interface DashboardMetrics {
  strengthVolumeLast7Days: number;
  cardioDurationLast7Days: number;
  cardioDistanceLast7Days: number;
  strengthVolumePrevious7Days: number;
  cardioDurationPrevious7Days: number;
  cardioDistancePrevious7Days: number;
  workoutCount: number;
  previousWorkoutCount: number;
  runningDistanceLast7Days: number;
  swimmingDistanceLast7Days: number;
  bikingDistanceLast7Days: number;
}

interface InsightItem {
  icon: string;
  title: string;
  description: string;
  variant: 'success' | 'warning' | 'info' | 'default';
  priority: number;
}

interface ProgressInsightsProps {
  metrics: DashboardMetrics;
  className?: string;
}

export default function ProgressInsights({ metrics, className }: ProgressInsightsProps) {
  const [insights, setInsights] = useState<InsightItem[]>([]);

  useEffect(() => {
    const generateInsights = () => {
      const newInsights: InsightItem[] = [];

      // 1. Strength Volume Analysis
      const strengthChange = metrics.strengthVolumePrevious7Days > 0 
        ? ((metrics.strengthVolumeLast7Days - metrics.strengthVolumePrevious7Days) / metrics.strengthVolumePrevious7Days) * 100
        : 0;

      if (strengthChange > 10) {
        newInsights.push({
          icon: '🏋️',
          title: 'Strength Volume Up',
          description: `+${Math.round(strengthChange)}% vs last week. You're lifting heavier!`,
          variant: 'success',
          priority: 1
        });
      } else if (strengthChange < -15) {
        newInsights.push({
          icon: '💪',
          title: 'Strength Focus Needed',
          description: `Volume down ${Math.abs(Math.round(strengthChange))}%. Time to get back to the weights!`,
          variant: 'warning',
          priority: 2
        });
      }

      // 2. Distance Analysis
      const distanceChange = metrics.cardioDistancePrevious7Days > 0 
        ? ((metrics.cardioDistanceLast7Days - metrics.cardioDistancePrevious7Days) / metrics.cardioDistancePrevious7Days) * 100
        : 0;

      if (distanceChange > 50) {
        newInsights.push({
          icon: '🏃',
          title: 'Distance Surged',
          description: `${Math.round(distanceChange)}% more cardio distance this week — nice focus!`,
          variant: 'success',
          priority: 1
        });
      } else if (distanceChange < -25) {
        newInsights.push({
          icon: '🚶',
          title: 'Cardio Dropping',
          description: `${Math.abs(Math.round(distanceChange))}% less distance. Maybe add a run this week?`,
          variant: 'info',
          priority: 3
        });
      }

      // 3. Running Focus Analysis (Overuse Warning)
      const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
      if (totalCardio > 0 && metrics.runningDistanceLast7Days > 0) {
        const runningPercent = (metrics.runningDistanceLast7Days / totalCardio) * 100;
        if (runningPercent >= 90 && totalCardio > 5) { // Only warn if significant distance AND high percentage
          newInsights.push({
            icon: '⚠️',
            title: 'Running Overload?',
            description: `${Math.round(runningPercent)}% of cardio is running. Add variety to prevent overuse.`,
            variant: 'warning',
            priority: 2
          });
        }
      }

      // 4. Workout Frequency Insights
      const sessionChange = metrics.previousWorkoutCount > 0 
        ? ((metrics.workoutCount - metrics.previousWorkoutCount) / metrics.previousWorkoutCount) * 100
        : 0;

      if (metrics.workoutCount >= 7) {
        newInsights.push({
          icon: '🔥',
          title: 'High Volume Week',
          description: `${metrics.workoutCount} sessions this week! Make sure you're recovering well.`,
          variant: 'warning',
          priority: 3
        });
      } else if (sessionChange > 20 && metrics.workoutCount > 3) {
        newInsights.push({
          icon: '📈',
          title: 'Consistency Building',
          description: `+${Math.round(sessionChange)}% more sessions. Great momentum!`,
          variant: 'success',
          priority: 1
        });
      } else if (metrics.workoutCount <= 2 && metrics.previousWorkoutCount > 2) {
        newInsights.push({
          icon: '🎯',
          title: 'Rebuild Momentum',
          description: `Only ${metrics.workoutCount} sessions this week. Let's get back on track!`,
          variant: 'info',
          priority: 2
        });
      }

      // 5. Balance Analysis
      const hasStrength = metrics.strengthVolumeLast7Days > 0;
      const hasCardio = metrics.cardioDistanceLast7Days > 0;
      
      if (hasStrength && !hasCardio && metrics.workoutCount >= 3) {
        newInsights.push({
          icon: '🏃‍♀️',
          title: 'Missing Cardio',
          description: 'Great strength work! Consider adding cardio for balance.',
          variant: 'info',
          priority: 4
        });
      } else if (hasCardio && !hasStrength && metrics.workoutCount >= 3) {
        newInsights.push({
          icon: '💪',
          title: 'Add Strength Training',
          description: 'Good cardio base! Strength training will improve overall fitness.',
          variant: 'info',
          priority: 4
        });
      }

      // Sort by priority (lower number = higher priority) and take top 3
      return newInsights
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3);
    };

    setInsights(generateInsights());
  }, [metrics]);

  if (insights.length === 0) {
    // Fallback insight for users with minimal data
    const hasAnyActivity = metrics.workoutCount > 0 || metrics.strengthVolumeLast7Days > 0 || metrics.cardioDistanceLast7Days > 0;
    
    if (!hasAnyActivity) {
      return (
        <motion.section 
          className={`mb-12 ${className}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-lg font-medium text-foreground mb-6">Progress Insights</h2>
          <InsightCard
            icon="🚀"
            title="Ready to Start"
            description="Log a few workouts to unlock personalized insights about your progress."
            variant="info"
          />
        </motion.section>
      );
    }
    
    return null;
  }

  return (
    <motion.section 
      className={`mb-12 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <h2 className="text-lg font-medium text-foreground mb-6">Progress Insights</h2>
      
      <div className="grid gap-4">
        {insights.map((insight, index) => (
          <InsightCard
            key={`${insight.title}-${index}`}
            icon={insight.icon}
            title={insight.title}
            description={insight.description}
            variant={insight.variant}
            delay={index * 0.1}
          />
        ))}
      </div>
    </motion.section>
  );
} 