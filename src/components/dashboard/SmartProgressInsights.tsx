'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, Award, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressInsight {
  type: 'improvement' | 'decline' | 'milestone' | 'opportunity';
  title: string;
  description: string;
  metric: string;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

interface SmartProgressInsightsProps {
  metrics: {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number;
    cardioDistanceLast7Days: number;
    strengthVolumePrevious7Days: number;
    cardioDurationPrevious7Days: number;
    cardioDistancePrevious7Days: number;
    runningDistanceLast7Days: number;
    swimmingDistanceLast7Days: number;
    bikingDistanceLast7Days: number;
    runningDistancePrevious7Days: number;
    swimmingDistancePrevious7Days: number;
    bikingDistancePrevious7Days: number;
    exercisePRs: any[];
    workoutCount: number;
  };
}

export default function SmartProgressInsights({ metrics }: SmartProgressInsightsProps) {
  const [insights, setInsights] = useState<ProgressInsight[]>([]);

  useEffect(() => {
    const generateInsights = () => {
      const newInsights: ProgressInsight[] = [];

      // Strength Volume Analysis
      const strengthChange = metrics.strengthVolumePrevious7Days > 0 
        ? ((metrics.strengthVolumeLast7Days - metrics.strengthVolumePrevious7Days) / metrics.strengthVolumePrevious7Days) * 100
        : 0;

      if (Math.abs(strengthChange) > 10) {
        newInsights.push({
          type: strengthChange > 0 ? 'improvement' : 'decline',
          title: strengthChange > 0 ? 'Strength Volume Increasing' : 'Strength Volume Declining',
          description: `Your lifting volume is ${Math.abs(strengthChange).toFixed(0)}% ${strengthChange > 0 ? 'higher' : 'lower'} than last week`,
          metric: `${(metrics.strengthVolumeLast7Days / 1000).toFixed(1)}t this week vs ${(metrics.strengthVolumePrevious7Days / 1000).toFixed(1)}t last week`,
          change: strengthChange,
          icon: strengthChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
          color: strengthChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
        });
      }

      // Cardio Analysis
      const cardioDistanceChange = metrics.cardioDistancePrevious7Days > 0 
        ? ((metrics.cardioDistanceLast7Days - metrics.cardioDistancePrevious7Days) / metrics.cardioDistancePrevious7Days) * 100
        : 0;

      if (Math.abs(cardioDistanceChange) > 15) {
        newInsights.push({
          type: cardioDistanceChange > 0 ? 'improvement' : 'decline',
          title: cardioDistanceChange > 0 ? 'Cardio Distance Up' : 'Cardio Distance Down',
          description: `${Math.abs(cardioDistanceChange).toFixed(0)}% ${cardioDistanceChange > 0 ? 'more' : 'less'} distance than last week`,
          metric: `${(metrics.cardioDistanceLast7Days / 1000).toFixed(1)}km this week`,
          change: cardioDistanceChange,
          icon: cardioDistanceChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
          color: cardioDistanceChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
        });
      }

      // Running Focus Analysis
      const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
      if (totalCardio > 0) {
        const runningPercent = (metrics.runningDistanceLast7Days / totalCardio) * 100;
        if (runningPercent > 80) {
          newInsights.push({
            type: 'opportunity',
            title: 'Heavy Running Focus',
            description: `${runningPercent.toFixed(0)}% of your cardio is running - consider cross-training`,
            metric: `${(metrics.runningDistanceLast7Days / 1000).toFixed(1)}km running of ${(totalCardio / 1000).toFixed(1)}km total`,
            icon: <Activity className="w-4 h-4" />,
            color: 'text-blue-600 dark:text-blue-400'
          });
        }
      }

      // PR Analysis
      if (metrics.exercisePRs && metrics.exercisePRs.length > 0) {
        const recentPRs = metrics.exercisePRs.filter(pr => {
          const prDate = new Date(pr.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return prDate >= weekAgo;
        });

        if (recentPRs.length > 0) {
          newInsights.push({
            type: 'milestone',
            title: 'Recent Personal Records',
            description: `Hit ${recentPRs.length} PR${recentPRs.length > 1 ? 's' : ''} this week - you're getting stronger!`,
            metric: recentPRs.map(pr => pr.exerciseName).join(', '),
            icon: <Award className="w-4 h-4" />,
            color: 'text-purple-600 dark:text-purple-400'
          });
        }
      }

      // Workout Frequency Insight
      if (metrics.workoutCount > 0) {
        if (metrics.workoutCount >= 6) {
          newInsights.push({
            type: 'opportunity',
            title: 'High Training Volume',
            description: `${metrics.workoutCount} workouts this week - make sure you're recovering`,
            metric: 'Consider a deload or rest day',
            icon: <Target className="w-4 h-4" />,
            color: 'text-orange-600 dark:text-orange-400'
          });
        } else if (metrics.workoutCount <= 2) {
          newInsights.push({
            type: 'opportunity',
            title: 'Room to Increase Volume',
            description: `Only ${metrics.workoutCount} workouts this week - you can probably do more`,
            metric: 'Aim for 3-5 sessions per week',
            icon: <Target className="w-4 h-4" />,
            color: 'text-blue-600 dark:text-blue-400'
          });
        }
      }

      // Balance Analysis
      const hasStrength = metrics.strengthVolumeLast7Days > 0;
      const hasCardio = metrics.cardioDistanceLast7Days > 0;
      
      if (hasStrength && !hasCardio) {
        newInsights.push({
          type: 'opportunity',
          title: 'Missing Cardio',
          description: 'Great strength work, but consider adding some cardio for balance',
          metric: 'Try 20-30 minutes of running or cycling',
          icon: <Activity className="w-4 h-4" />,
          color: 'text-blue-600 dark:text-blue-400'
        });
      } else if (hasCardio && !hasStrength) {
        newInsights.push({
          type: 'opportunity',
          title: 'Missing Strength Training',
          description: 'Good cardio base, but strength training will improve overall fitness',
          metric: 'Add 2-3 strength sessions per week',
          icon: <Target className="w-4 h-4" />,
          color: 'text-blue-600 dark:text-blue-400'
        });
      }

      setInsights(newInsights.slice(0, 3)); // Show top 3 insights
    };

    generateInsights();
  }, [metrics]);

  if (insights.length === 0) {
    return (
      <Card className="border-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-foreground">Progress Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Complete a few more workouts to see personalized insights about your progress.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-foreground">Progress Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, index) => (
          <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/40 backdrop-blur-sm">
            <div className={cn("mt-0.5", insight.color)}>
              {insight.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm text-foreground">{insight.title}</h4>
                {insight.change && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    insight.change > 0 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  )}>
                    {insight.change > 0 ? '+' : ''}{insight.change.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">{insight.description}</p>
              <p className="text-xs text-muted-foreground/80">{insight.metric}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 