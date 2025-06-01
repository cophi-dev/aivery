'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Dumbbell, Heart, Users, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface WeeklyRecommendation {
  id: string;
  type: 'strength' | 'cardio' | 'recovery' | 'cross-training';
  title: string;
  description: string;
  duration: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  action?: {
    text: string;
    href: string;
  };
}

interface WeeklyPlannerProps {
  metrics: {
    strengthVolumeLast7Days: number;
    cardioDurationLast7Days: number;
    cardioDistanceLast7Days: number;
    runningDistanceLast7Days: number;
    swimmingDistanceLast7Days: number;
    bikingDistanceLast7Days: number;
    workoutCount: number;
  };
}

export default function WeeklyPlanner({ metrics }: WeeklyPlannerProps) {
  const [recommendations, setRecommendations] = useState<WeeklyRecommendation[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);

  useEffect(() => {
    const generateRecommendations = () => {
      const newRecommendations: WeeklyRecommendation[] = [];
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate training balance
      const hasStrength = metrics.strengthVolumeLast7Days > 0;
      const hasCardio = metrics.cardioDistanceLast7Days > 0;
      const totalCardio = metrics.runningDistanceLast7Days + metrics.swimmingDistanceLast7Days + metrics.bikingDistanceLast7Days;
      const isHighVolume = metrics.workoutCount >= 6;
      const isLowVolume = metrics.workoutCount <= 2;

      // Today's recommendations (most important)
      if (!hasStrength && metrics.workoutCount < 5) {
        newRecommendations.push({
          id: 'today-strength',
          type: 'strength',
          title: 'Strength Training Today',
          description: 'Focus on compound movements: squats, deadlifts, or upper body pressing',
          duration: '45-60 min',
          priority: 'high',
          reasoning: 'Missing strength work this week',
          action: {
            text: 'Start Workout',
            href: '/workout/new?type=strength'
          }
        });
      } else if (!hasCardio && metrics.workoutCount < 5) {
        newRecommendations.push({
          id: 'today-cardio',
          type: 'cardio',
          title: 'Cardio Session Today',
          description: 'Easy to moderate intensity running, cycling, or swimming',
          duration: '30-45 min',
          priority: 'high',
          reasoning: 'Missing cardiovascular work this week',
          action: {
            text: 'Log Cardio',
            href: '/workout/new?type=cardio'
          }
        });
      } else if (isHighVolume) {
        newRecommendations.push({
          id: 'today-recovery',
          type: 'recovery',
          title: 'Recovery Day',
          description: 'Light stretching, yoga, or complete rest to let your body adapt',
          duration: '20-30 min',
          priority: 'high',
          reasoning: `${metrics.workoutCount} workouts this week - recovery is crucial`,
          action: {
            text: 'Plan Recovery',
            href: '/workout/new?type=recovery'
          }
        });
      }

      // Tomorrow's recommendations
      const tomorrow = (today + 1) % 7;
      
      if (tomorrow === 1) { // Monday
        newRecommendations.push({
          id: 'tomorrow-strength',
          type: 'strength',
          title: 'Monday: Week Starter',
          description: 'Begin the week with a solid strength session focusing on major muscle groups',
          duration: '45-60 min',
          priority: 'medium',
          reasoning: 'Monday is ideal for high-intensity training after weekend recovery'
        });
      } else if (tomorrow === 3) { // Wednesday
        newRecommendations.push({
          id: 'tomorrow-cardio',
          type: 'cardio',
          title: 'Wednesday: Cardio Focus',
          description: 'Mid-week cardiovascular training to maintain aerobic fitness',
          duration: '30-45 min',
          priority: 'medium',
          reasoning: 'Balanced training throughout the week'
        });
      } else if (tomorrow === 5) { // Friday
        if (metrics.workoutCount >= 4) {
          newRecommendations.push({
            id: 'tomorrow-recovery',
            type: 'recovery',
            title: 'Friday: Active Recovery',
            description: 'Light movement, stretching, or yoga to prepare for weekend activities',
            duration: '20-30 min',
            priority: 'medium',
            reasoning: 'Good weekly volume achieved - time to recover'
          });
        } else {
          newRecommendations.push({
            id: 'tomorrow-strength',
            type: 'strength',
            title: 'Friday: Final Push',
            description: 'End the week strong with a focused strength or conditioning session',
            duration: '45-60 min',
            priority: 'medium',
            reasoning: 'Need more volume to reach weekly targets'
          });
        }
      }

      // Weekend planning
      if (today >= 5) { // Friday, Saturday, or Sunday
        if (isLowVolume) {
          newRecommendations.push({
            id: 'weekend-catchup',
            type: 'strength',
            title: 'Weekend Catch-Up',
            description: 'Use weekend time for a longer, comprehensive training session',
            duration: '60-75 min',
            priority: 'high',
            reasoning: `Only ${metrics.workoutCount} workouts this week - weekend is perfect for catch-up`
          });
        } else {
          newRecommendations.push({
            id: 'weekend-fun',
            type: 'cross-training',
            title: 'Weekend Adventure',
            description: 'Try hiking, sports, or outdoor activities for enjoyable movement',
            duration: '60+ min',
            priority: 'low',
            reasoning: 'Good weekly volume - make it fun and social'
          });
        }
      }

      // Cross-training recommendations based on activity patterns
      if (totalCardio > 0) {
        const runningPercent = (metrics.runningDistanceLast7Days / totalCardio) * 100;
        if (runningPercent > 80) {
          newRecommendations.push({
            id: 'cross-training',
            type: 'cross-training',
            title: 'Cross-Training Session',
            description: 'Swimming, cycling, or rowing to balance your running focus',
            duration: '30-45 min',
            priority: 'medium',
            reasoning: `${runningPercent.toFixed(0)}% of cardio is running - variety prevents overuse injuries`
          });
        }
      }

      // Next week preparation
      if (today === 0) { // Sunday
        newRecommendations.push({
          id: 'next-week-prep',
          type: 'strength',
          title: 'Plan Next Week',
          description: 'Review this week\'s progress and plan training for the upcoming week',
          duration: '10 min',
          priority: 'low',
          reasoning: 'Planning helps maintain consistency and progression'
        });
      }

      setRecommendations(newRecommendations.slice(0, 4)); // Show top 4 recommendations
    };

    generateRecommendations();
  }, [metrics]);

  const handleCompleteRecommendation = (id: string) => {
    setCompletedToday(prev => [...prev, id]);
  };

  const getTypeIcon = (type: WeeklyRecommendation['type']) => {
    switch (type) {
      case 'strength':
        return <Dumbbell className="w-4 h-4" />;
      case 'cardio':
        return <Heart className="w-4 h-4" />;
      case 'recovery':
        return <Clock className="w-4 h-4" />;
      case 'cross-training':
        return <Users className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: WeeklyRecommendation['type']) => {
    switch (type) {
      case 'strength':
        return 'text-orange-600 dark:text-orange-400';
      case 'cardio':
        return 'text-red-600 dark:text-red-400';
      case 'recovery':
        return 'text-green-600 dark:text-green-400';
      case 'cross-training':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getPriorityColor = (priority: WeeklyRecommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-400 dark:border-l-red-400';
      case 'medium':
        return 'border-l-amber-400 dark:border-l-amber-400';
      case 'low':
        return 'border-l-emerald-400 dark:border-l-emerald-400';
      default:
        return 'border-l-gray-400 dark:border-l-gray-400';
    }
  };

  if (recommendations.length === 0) {
    return (
      <Card className="border-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-foreground">Weekly Planning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Log a few workouts to get personalized weekly training recommendations.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-foreground">Weekly Planning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => {
          const isCompleted = completedToday.includes(rec.id);
          
          return (
            <div 
              key={rec.id} 
              className={cn(
                "p-4 rounded-lg bg-background/40 backdrop-blur-sm border-l-4",
                getPriorityColor(rec.priority),
                isCompleted && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn("mt-0.5", getTypeColor(rec.type))}>
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : getTypeIcon(rec.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={cn(
                        "font-medium text-sm",
                        isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                      )}>
                        {rec.title}
                      </h4>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {rec.duration}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                    <p className="text-xs text-muted-foreground/80 italic">{rec.reasoning}</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  {rec.action && !isCompleted && (
                    <Link href={rec.action.href}>
                      <Button size="sm" variant="outline" className="text-xs">
                        {rec.action.text}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                  {rec.priority === 'high' && !isCompleted && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleCompleteRecommendation(rec.id)}
                      className="text-xs"
                    >
                      Mark Done
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Recommendations update based on your training patterns and weekly progress.
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 